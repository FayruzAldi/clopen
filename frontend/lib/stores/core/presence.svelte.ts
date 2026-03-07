/**
 * Presence Store
 * Shared reactive state for project presence (active users)
 * Subscribes once to projectStatusService, shared across all components
 *
 * Also provides unified helpers for status indicators so all components
 * read from one place (merges backend presence + frontend app state).
 */

import { projectStatusService, type ProjectStatus } from '$frontend/lib/services/project/status.service';
import { userStore } from '$frontend/lib/stores/features/user.svelte';
import { appState } from '$frontend/lib/stores/core/app.svelte';

// Shared reactive state
export const presenceState = $state<{
	statuses: Map<string, ProjectStatus>;
}>({
	statuses: new Map()
});

let subscribed = false;

/**
 * Initialize presence subscription (call once at app level)
 * Automatically excludes the current user from activeUsers
 */
export function initPresence() {
	if (subscribed) return;
	subscribed = true;

	projectStatusService.onStatusUpdate((statuses) => {
		const currentUserId = userStore.currentUser?.id;
		const statusMap = new Map<string, ProjectStatus>();
		statuses.forEach((status) => {
			statusMap.set(status.projectId, {
				...status,
				activeUsers: currentUserId
					? status.activeUsers.filter((u) => u.userId !== currentUserId)
					: status.activeUsers
			});
		});
		presenceState.statuses = statusMap;
	});
}

/**
 * Get presence status for a specific project
 */
export function getProjectPresence(projectId: string): ProjectStatus | undefined {
	return presenceState.statuses.get(projectId);
}

// ========================================
// UNIFIED STATUS HELPERS
// ========================================

/**
 * Check if a chat session is waiting for user input.
 * Merges two sources so the result is always up-to-date:
 *   1. Frontend appState.sessionStates (instant, set by chat stream events)
 *   2. Backend presenceState (works for background / other-project sessions)
 */
export function isSessionWaitingInput(chatSessionId: string, projectId?: string): boolean {
	// Frontend app state — immediate for the active session
	if (appState.sessionStates[chatSessionId]?.isWaitingInput) return true;

	// Backend presence — covers background & cross-project sessions
	if (projectId) {
		const status = presenceState.statuses.get(projectId);
		if (status?.streams?.some(
			(s: any) => s.status === 'active' && s.chatSessionId === chatSessionId && s.isWaitingInput
		)) return true;
	} else {
		// No projectId provided — search all projects
		for (const status of presenceState.statuses.values()) {
			if (status.streams?.some(
				(s: any) => s.status === 'active' && s.chatSessionId === chatSessionId && s.isWaitingInput
			)) return true;
		}
	}

	return false;
}

/**
 * Get the status indicator color for a project.
 * - Gray  (bg-slate-500/30) : no active streams (idle)
 * Priority (highest wins when multiple sessions exist):
 * - Green (bg-emerald-500)  : at least one stream actively processing
 * - Amber (bg-amber-500)    : all active streams waiting for user input
 * - Gray  (bg-slate-500/30) : no active streams (idle)
 *
 * Merges backend presence with frontend app state for accuracy.
 */
export function getProjectStatusColor(projectId: string): string {
	const status = presenceState.statuses.get(projectId);
	if (!status?.streams) return 'bg-slate-500/30';

	const activeStreams = status.streams.filter((s: any) => s.status === 'active');
	if (activeStreams.length === 0) return 'bg-slate-500/30';

	// Green wins: at least one stream is actively processing (not waiting)
	const hasProcessing = activeStreams.some((s: any) =>
		!s.isWaitingInput && !appState.sessionStates[s.chatSessionId]?.isWaitingInput
	);
	if (hasProcessing) return 'bg-emerald-500';

	// All active streams are waiting for input
	return 'bg-amber-500';
}
