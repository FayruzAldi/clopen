<script lang="ts">
	import { authStore } from '$frontend/lib/stores/features/auth.svelte';
	import { addNotification } from '$frontend/lib/stores/ui/notification.svelte';
	import Icon from '../../common/Icon.svelte';
	import Dialog from '../../common/Dialog.svelte';
	import ws from '$frontend/lib/utils/ws';
	import { debug } from '$shared/utils/logger';

	interface Invite {
		id: string;
		role: string;
		label: string | null;
		max_uses: number;
		use_count: number;
		expires_at: string | null;
		created_at: string;
	}

	let invites = $state<Invite[]>([]);
	let loading = $state(true);

	// Create invite state
	let showCreateDialog = $state(false);
	let newInviteLabel = $state('');
	let newInviteMaxUses = $state(1);
	let newInviteExpiresDays = $state(7);
	let isCreating = $state(false);

	// Generated invite URL
	let generatedInviteURL = $state('');
	let showInviteResult = $state(false);

	// Revoke state
	let showRevokeConfirm = $state(false);
	let inviteToRevoke = $state<Invite | null>(null);

	async function loadInvites() {
		loading = true;
		try {
			invites = await ws.http('auth:list-invites', {});
		} catch (error) {
			debug.error('settings', 'Failed to load invites:', error);
		} finally {
			loading = false;
		}
	}

	function openCreateDialog() {
		newInviteLabel = '';
		newInviteMaxUses = 1;
		newInviteExpiresDays = 7;
		showCreateDialog = true;
	}

	async function createInvite() {
		isCreating = true;
		try {
			const result = await ws.http('auth:create-invite', {
				label: newInviteLabel.trim() || undefined,
				maxUses: newInviteMaxUses,
				expiresInDays: newInviteExpiresDays
			});

			// Build invite URL
			const baseURL = window.location.origin;
			generatedInviteURL = `${baseURL}/#invite/${result.inviteToken}`;
			showCreateDialog = false;
			showInviteResult = true;

			addNotification({ type: 'success', title: 'Created', message: 'Invite link created' });
			await loadInvites();
		} catch (error) {
			debug.error('settings', 'Failed to create invite:', error);
			addNotification({ type: 'error', title: 'Error', message: 'Failed to create invite' });
		} finally {
			isCreating = false;
		}
	}

	function copyInviteURL() {
		navigator.clipboard.writeText(generatedInviteURL);
		addNotification({ type: 'success', title: 'Copied', message: 'Invite link copied to clipboard' });
	}

	function confirmRevoke(invite: Invite) {
		inviteToRevoke = invite;
		showRevokeConfirm = true;
	}

	async function revokeInvite() {
		if (!inviteToRevoke) return;
		try {
			await ws.http('auth:revoke-invite', { id: inviteToRevoke.id });
			addNotification({ type: 'success', title: 'Revoked', message: 'Invite link has been revoked' });
			showRevokeConfirm = false;
			inviteToRevoke = null;
			await loadInvites();
		} catch (error) {
			debug.error('settings', 'Failed to revoke invite:', error);
			addNotification({ type: 'error', title: 'Error', message: 'Failed to revoke invite' });
		}
	}

	function isExpired(invite: Invite): boolean {
		return invite.expires_at !== null && new Date(invite.expires_at) < new Date();
	}

	function isUsedUp(invite: Invite): boolean {
		return invite.max_uses > 0 && invite.use_count >= invite.max_uses;
	}

	// Load on mount
	$effect(() => {
		if (authStore.isAdmin) {
			loadInvites();
		}
	});
</script>

{#if authStore.isAdmin}
<div class="py-1">
	<h3 class="text-base font-bold text-slate-900 dark:text-slate-100 mb-1.5">Invite Links</h3>
	<p class="text-sm text-slate-600 dark:text-slate-500 mb-5">Create and manage invite links for new team members</p>

	{#if loading}
		<div class="flex items-center justify-center gap-3 py-8 text-slate-600 dark:text-slate-500 text-sm">
			<div class="w-5 h-5 border-2 border-violet-500/20 border-t-violet-600 rounded-full animate-spin"></div>
			<span>Loading invites...</span>
		</div>
	{:else}
		<div class="flex flex-col gap-2">
			{#if invites.length === 0}
				<div class="flex items-center gap-2 px-3 py-2.5 bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
					<Icon name="lucide:link" class="w-4 h-4 text-slate-400 shrink-0" />
					<span class="text-xs text-slate-500">No invite links created yet</span>
				</div>
			{:else}
				{#each invites as invite (invite.id)}
					{@const expired = isExpired(invite)}
					{@const usedUp = isUsedUp(invite)}
					{@const inactive = expired || usedUp}
					<div class="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-slate-900 border rounded-lg group
						{inactive ? 'border-slate-200 dark:border-slate-800 opacity-60' : 'border-slate-200 dark:border-slate-700'}">
						<Icon name="lucide:link" class="w-4 h-4 shrink-0
							{inactive ? 'text-slate-400' : 'text-violet-500'}" />
						<div class="flex-1 min-w-0">
							<div class="text-xs font-medium text-slate-900 dark:text-slate-100">
								{invite.label || 'Unnamed invite'}
							</div>
							<div class="text-2xs text-slate-500">
								{invite.use_count}/{invite.max_uses > 0 ? invite.max_uses : 'unlimited'} uses
								{#if invite.expires_at}
									&middot; {expired ? 'Expired' : `Expires ${new Date(invite.expires_at).toLocaleDateString()}`}
								{/if}
							</div>
						</div>
						{#if inactive}
							<span class="text-2xs font-medium text-slate-400 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
								{expired ? 'Expired' : 'Used up'}
							</span>
						{/if}
						{#if !inactive}
							<button
								type="button"
								onclick={() => confirmRevoke(invite)}
								class="flex items-center justify-center w-7 h-7 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
								title="Revoke invite"
							>
								<Icon name="lucide:x" class="w-3.5 h-3.5" />
							</button>
						{/if}
					</div>
				{/each}
			{/if}

			<button
				type="button"
				onclick={openCreateDialog}
				class="inline-flex items-center gap-1.5 py-2 px-3.5 mt-1 bg-violet-500/10 dark:bg-violet-500/10 border border-violet-500/20 dark:border-violet-500/25 rounded-lg text-violet-600 dark:text-violet-400 text-xs font-semibold cursor-pointer transition-all duration-150 hover:bg-violet-500/20 hover:border-violet-600/40 self-start"
			>
				<Icon name="lucide:plus" class="w-3.5 h-3.5" />
				Create Invite Link
			</button>
		</div>
	{/if}
</div>

<!-- Create Invite Dialog -->
<Dialog
	bind:isOpen={showCreateDialog}
	onClose={() => { showCreateDialog = false; }}
	title="Create Invite Link"
	type="info"
	message="Create a link to invite a new team member."
	bind:inputValue={newInviteLabel}
	inputPlaceholder="Label (optional), e.g. 'For John'"
	confirmText={isCreating ? 'Creating...' : 'Create'}
	cancelText="Cancel"
	showCancel={true}
	confirmDisabled={isCreating}
	onConfirm={createInvite}
/>

<!-- Invite Result Dialog (shows generated URL) -->
<Dialog
	bind:isOpen={showInviteResult}
	onClose={() => { showInviteResult = false; generatedInviteURL = ''; }}
	title="Invite Link Created"
	type="info"
	message={generatedInviteURL}
	confirmText="Copy Link"
	showCancel={false}
	onConfirm={() => { copyInviteURL(); showInviteResult = false; generatedInviteURL = ''; }}
/>

<!-- Revoke Confirmation -->
<Dialog
	bind:isOpen={showRevokeConfirm}
	onClose={() => { showRevokeConfirm = false; inviteToRevoke = null; }}
	title="Revoke Invite"
	type="warning"
	message={`Revoke invite "${inviteToRevoke?.label || 'Unnamed'}"? Anyone with this link will no longer be able to join.`}
	confirmText="Revoke"
	cancelText="Cancel"
	showCancel={true}
	onConfirm={revokeInvite}
/>
{/if}
