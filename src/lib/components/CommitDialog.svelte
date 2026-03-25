<script lang="ts">
	import { showCommitDialog } from '$lib/stores/ui.ts';
	import { approvedCount } from '$lib/stores/files.ts';

	let message = $state('');
	let commitMode = $state<'approved' | 'all'>('approved');
	let committing = $state(false);
	let result = $state<{ success: boolean; hash?: string; error?: string } | null>(null);

	async function handleCommit() {
		if (!message.trim()) return;
		committing = true;
		result = null;

		try {
			const res = await fetch('/api/commit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: message.trim(), mode: commitMode })
			});
			result = await res.json();
		} catch (err) {
			result = { success: false, error: String(err) };
		} finally {
			committing = false;
		}
	}

	function close() {
		$showCommitDialog = false;
		message = '';
		result = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			handleCommit();
		}
		if (e.key === 'Escape') close();
	}
</script>

{#if $showCommitDialog}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onclick={close}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl w-full max-w-lg mx-4" onclick={(e) => e.stopPropagation()}>
			<div class="px-5 py-4 border-b border-zinc-700">
				<h2 class="text-lg font-semibold text-zinc-200">Commit Changes</h2>
			</div>

			{#if result?.success}
				<div class="p-5">
					<div class="text-center">
						<div class="text-green-400 text-4xl mb-3">✓</div>
						<p class="text-zinc-200 font-medium">Committed successfully</p>
						<p class="text-zinc-400 text-sm mt-1">Hash: {result.hash}</p>
					</div>
				</div>
				<div class="px-5 py-3 border-t border-zinc-700 flex justify-end">
					<button
						class="text-sm px-4 py-2 rounded bg-zinc-600 text-white hover:bg-zinc-500 transition-colors"
						onclick={close}
					>
						Done
					</button>
				</div>
			{:else}
				<div class="p-5 space-y-4">
					<!-- Commit scope -->
					<div>
						<label class="block text-sm text-zinc-400 mb-2">What to commit</label>
						<div class="flex gap-2">
							<button
								class="flex-1 text-left px-3 py-2 rounded-lg border text-sm transition-colors {commitMode === 'approved' ? 'border-green-600 bg-green-600/10 text-green-400' : 'border-zinc-600 text-zinc-400 hover:border-zinc-500'}"
								onclick={() => (commitMode = 'approved')}
							>
								<div class="font-medium">Approved files only</div>
								<div class="text-xs mt-0.5 opacity-70">{$approvedCount.approved} of {$approvedCount.total} files</div>
							</button>
							<button
								class="flex-1 text-left px-3 py-2 rounded-lg border text-sm transition-colors {commitMode === 'all' ? 'border-blue-600 bg-blue-600/10 text-blue-400' : 'border-zinc-600 text-zinc-400 hover:border-zinc-500'}"
								onclick={() => (commitMode = 'all')}
							>
								<div class="font-medium">All changes</div>
								<div class="text-xs mt-0.5 opacity-70">{$approvedCount.total} files</div>
							</button>
						</div>
					</div>

					{#if commitMode === 'approved' && $approvedCount.approved === 0}
						<div class="text-sm rounded-lg px-3 py-2 bg-yellow-500/10 text-yellow-400">
							No files approved yet. Approve files in the sidebar first, or commit all changes.
						</div>
					{/if}

					<!-- Commit message -->
					<div>
						<label class="block text-sm text-zinc-400 mb-2" for="commit-msg">Commit message</label>
						<textarea
							id="commit-msg"
							bind:value={message}
							onkeydown={handleKeydown}
							class="w-full bg-zinc-900 text-zinc-200 border border-zinc-600 rounded-lg px-3 py-2 text-sm resize-y min-h-[100px] focus:outline-none focus:border-blue-500 placeholder:text-zinc-500"
							placeholder="Describe your changes..."
							rows="4"
						></textarea>
					</div>

					{#if result?.error}
						<p class="text-red-400 text-sm">{result.error}</p>
					{/if}
				</div>

				<div class="px-5 py-3 border-t border-zinc-700 flex items-center justify-between">
					<span class="text-xs text-zinc-500">
						{navigator?.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to commit
					</span>
					<div class="flex gap-2">
						<button
							class="text-sm px-4 py-2 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
							onclick={close}
						>
							Cancel
						</button>
						<button
							class="text-sm px-4 py-2 rounded bg-green-600 text-white hover:bg-green-500 transition-colors disabled:opacity-50"
							disabled={!message.trim() || committing || (commitMode === 'approved' && $approvedCount.approved === 0)}
							onclick={handleCommit}
						>
							{committing ? 'Committing...' : commitMode === 'approved' ? `Commit ${$approvedCount.approved} files` : 'Commit all'}
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
