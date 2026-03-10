/**
 * Snapshot Restore Handler (v2 - Session-Scoped with Conflict Detection)
 *
 * Two-phase restore:
 * 1. Check conflicts: detect files modified by other sessions
 * 2. Execute restore: undo session-scoped changes, respecting conflict resolutions
 */

import { t } from 'elysia';
import { createRouter } from '$shared/utils/ws-server';
import { messageQueries, sessionQueries, projectQueries, checkpointQueries } from '../../lib/database/queries';
import { snapshotService } from '../../lib/snapshot/snapshot-service';
import { debug } from '$shared/utils/logger';
import {
	buildCheckpointTree,
	getCheckpointPathToRoot,
	findSessionEnd,
	INITIAL_NODE_ID
} from '../../lib/snapshot/helpers';
import { ws } from '$backend/lib/utils/ws';

export const restoreHandler = createRouter()
	/**
	 * Phase 1: Check for conflicts before restore.
	 * Frontend calls this first, and if conflicts exist, shows a modal.
	 */
	.http('snapshot:check-conflicts', {
		data: t.Object({
			messageId: t.String(),
			sessionId: t.String()
		}),
		response: t.Object({
			hasConflicts: t.Boolean(),
			conflicts: t.Array(t.Object({
				filepath: t.String(),
				modifiedBySessionId: t.String(),
				modifiedBySnapshotId: t.String(),
				modifiedAt: t.String(),
				restoreContent: t.Optional(t.String()),
				currentContent: t.Optional(t.String())
			})),
			checkpointsToUndo: t.Array(t.String())
		})
	}, async ({ data }) => {
		const { messageId, sessionId } = data;

		debug.log('snapshot', `Checking restore conflicts for checkpoint ${messageId} in session ${sessionId}`);

		// Resolve project path for reading file contents
		let projectPath: string | undefined;
		const session = sessionQueries.getById(sessionId);
		if (session) {
			const project = projectQueries.getById(session.project_id);
			if (project) projectPath = project.path;
		}

		const result = await snapshotService.checkRestoreConflicts(
			sessionId,
			messageId === INITIAL_NODE_ID ? null : messageId,
			projectPath
		);

		debug.log('snapshot', `Conflict check: ${result.conflicts.length} conflicts, ${result.checkpointsToUndo.length} checkpoints to undo`);

		return result;
	})

	/**
	 * Phase 2: Execute restore with optional conflict resolutions.
	 */
	.http('snapshot:restore', {
		data: t.Object({
			messageId: t.String(),
			sessionId: t.String(),
			conflictResolutions: t.Optional(t.Record(t.String(), t.Union([
				t.Literal('restore'),
				t.Literal('keep')
			])))
		}),
		response: t.Object({
			restoredTo: t.Object({
				messageId: t.String(),
				timestamp: t.String()
			}),
			filesRestored: t.Optional(t.Number()),
			filesSkipped: t.Optional(t.Number())
		})
	}, async ({ data }) => {
		const { messageId, sessionId, conflictResolutions } = data;
		const isInitialRestore = messageId === INITIAL_NODE_ID;

		debug.log('snapshot', `RESTORE - ${isInitialRestore ? 'Restoring to initial state' : 'Moving HEAD to checkpoint'}`);
		debug.log('snapshot', `Target: ${messageId}`);
		debug.log('snapshot', `Session: ${sessionId}`);

		// Handle restore to initial state (before any messages)
		if (isInitialRestore) {
			// Clear HEAD (no messages active)
			sessionQueries.clearHead(sessionId);
			debug.log('snapshot', 'HEAD cleared (initial state)');

			// Clear latest_sdk_session_id so next chat starts fresh
			const db = (await import('../../lib/database')).getDatabase();
			db.prepare(`UPDATE chat_sessions SET latest_sdk_session_id = NULL WHERE id = ?`).run(sessionId);

			// Clear checkpoint_tree_state
			checkpointQueries.deleteForSession(sessionId);

			// Restore file system: revert ALL session changes
			let filesRestored = 0;
			let filesSkipped = 0;

			const session = sessionQueries.getById(sessionId);
			if (session) {
				const project = projectQueries.getById(session.project_id);
				if (project) {
					const result = await snapshotService.restoreSessionScoped(
						project.path,
						sessionId,
						null, // null = restore to initial (before all snapshots)
						conflictResolutions
					);
					filesRestored = result.restoredFiles;
					filesSkipped = result.skippedFiles;
				}
			}

			// Broadcast messages-changed
			try {
				ws.emit.chatSession(sessionId, 'chat:messages-changed', {
					sessionId,
					reason: 'restore',
					timestamp: new Date().toISOString()
				});
			} catch (err) {
				debug.error('snapshot', 'Failed to broadcast messages-changed:', err);
			}

			return {
				restoredTo: {
					messageId: INITIAL_NODE_ID,
					timestamp: new Date().toISOString()
				},
				filesRestored,
				filesSkipped
			};
		}

		// Regular checkpoint restore
		// 1. Get the checkpoint message
		const checkpointMessage = messageQueries.getById(messageId);
		if (!checkpointMessage) {
			throw new Error('Checkpoint message not found');
		}

		// 2. Get current HEAD
		const currentHead = sessionQueries.getHead(sessionId);
		debug.log('snapshot', `Current HEAD: ${currentHead}`);

		// 3. Get all messages and build checkpoint tree
		const allMessages = messageQueries.getAllBySessionId(sessionId);
		const { parentMap } = buildCheckpointTree(allMessages);

		// 4. Find session end (last message of checkpoint's session)
		const sessionEnd = findSessionEnd(checkpointMessage, allMessages);
		debug.log('snapshot', `Session end: ${sessionEnd.id}`);

		// 5. Update HEAD to session end
		sessionQueries.updateHead(sessionId, sessionEnd.id);
		debug.log('snapshot', `HEAD updated to: ${sessionEnd.id}`);

		// 5b. Update latest_sdk_session_id so resume works correctly
		{
			let walkId: string | null = sessionEnd.id;
			let foundSdkSessionId: string | null = null;
			const msgLookup = new Map(allMessages.map(m => [m.id, m]));

			while (walkId) {
				const walkMsg = msgLookup.get(walkId);
				if (!walkMsg) break;

				try {
					const sdk = JSON.parse(walkMsg.sdk_message);
					if (sdk.session_id) {
						foundSdkSessionId = sdk.session_id;
						break;
					}
				} catch { /* skip */ }

				walkId = walkMsg.parent_message_id || null;
			}

			if (foundSdkSessionId) {
				sessionQueries.updateLatestSdkSessionId(sessionId, foundSdkSessionId);
				debug.log('snapshot', `latest_sdk_session_id updated to: ${foundSdkSessionId}`);
			}
		}

		// 6. Update checkpoint_tree_state for ancestors
		const checkpointPath = getCheckpointPathToRoot(messageId, parentMap);
		if (checkpointPath.length > 1) {
			checkpointQueries.updateActiveChildrenAlongPath(sessionId, checkpointPath);
		}

		// 7. Restore file system state using session-scoped restore
		let filesRestored = 0;
		let filesSkipped = 0;

		const session = sessionQueries.getById(sessionId);
		if (session) {
			const project = projectQueries.getById(session.project_id);
			if (project) {
				const result = await snapshotService.restoreSessionScoped(
					project.path,
					sessionId,
					messageId,
					conflictResolutions
				);
				filesRestored = result.restoredFiles;
				filesSkipped = result.skippedFiles;
			}
		}

		// 8. Broadcast messages-changed
		try {
			ws.emit.chatSession(sessionId, 'chat:messages-changed', {
				sessionId,
				reason: 'restore',
				timestamp: new Date().toISOString()
			});
		} catch (err) {
			debug.error('snapshot', 'Failed to broadcast messages-changed:', err);
		}

		return {
			restoredTo: {
				messageId: sessionEnd.id,
				timestamp: sessionEnd.timestamp
			},
			filesRestored,
			filesSkipped
		};
	});
