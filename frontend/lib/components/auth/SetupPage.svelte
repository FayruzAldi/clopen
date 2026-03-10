<script lang="ts">
	import { authStore } from '$frontend/lib/stores/features/auth.svelte';

	let name = $state('');
	let error = $state('');
	let isLoading = $state(false);
	let showPAT = $state(false);
	let patCopied = $state(false);

	async function handleSetup() {
		if (!name.trim()) {
			error = 'Please enter a display name';
			return;
		}

		error = '';
		isLoading = true;

		try {
			await authStore.setup(name.trim());
			showPAT = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Setup failed';
		} finally {
			isLoading = false;
		}
	}

	async function copyPAT() {
		if (authStore.personalAccessToken) {
			await navigator.clipboard.writeText(authStore.personalAccessToken);
			patCopied = true;
			setTimeout(() => { patCopied = false; }, 2000);
		}
	}

	function handleContinue() {
		authStore.completeSetup();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !showPAT) {
			handleSetup();
		}
	}
</script>

<div class="fixed inset-0 z-[9999] bg-white dark:bg-slate-950 flex items-center justify-center">
	<div class="flex flex-col items-center gap-6 text-center px-4 max-w-md w-full">
		<!-- Logo -->
		<div>
			<img src="/favicon.svg" alt="Clopen" class="w-16 h-16 rounded-2xl shadow-xl" />
		</div>

		<div class="space-y-1">
			<h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">Welcome to Clopen</h1>
			<p class="text-sm text-slate-500 dark:text-slate-400">Create your admin account to get started</p>
		</div>

		{#if !showPAT}
			<!-- Setup Form -->
			<div class="w-full space-y-4">
				<div class="text-left">
					<label for="name" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
						Display Name
					</label>
					<input
						id="name"
						type="text"
						bind:value={name}
						onkeydown={handleKeydown}
						placeholder="Enter your name"
						disabled={isLoading}
						class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
					/>
				</div>

				{#if error}
					<p class="text-sm text-red-500">{error}</p>
				{/if}

				<button
					onclick={handleSetup}
					disabled={isLoading || !name.trim()}
					class="w-full py-2 px-4 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isLoading ? 'Creating...' : 'Create Admin Account'}
				</button>
			</div>
		{:else}
			<!-- PAT Display -->
			<div class="w-full space-y-4">
				<div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
					<p class="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
						Your Personal Access Token
					</p>
					<p class="text-xs text-amber-700 dark:text-amber-300 mb-3">
						Save this token — you'll need it to log in on other devices. It won't be shown again.
					</p>
					<div class="flex items-center gap-2">
						<code class="flex-1 px-3 py-2 rounded bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-xs font-mono text-slate-900 dark:text-slate-100 select-all break-all">
							{authStore.personalAccessToken}
						</code>
						<button
							onclick={copyPAT}
							class="shrink-0 px-3 py-2 rounded bg-amber-100 dark:bg-amber-900 hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs font-medium transition-colors"
						>
							{patCopied ? 'Copied!' : 'Copy'}
						</button>
					</div>
				</div>

				<button
					onclick={handleContinue}
					class="w-full py-2 px-4 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
				>
					Continue to Clopen
				</button>
			</div>
		{/if}
	</div>
</div>
