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
		<div class="bg-panel border border-border-strong rounded-xl shadow-2xl w-full max-w-lg mx-4" onclick={(e) => e.stopPropagation()}>
			<div class="px-5 py-4 border-b border-border">
				<h2 class="text-lg font-semibold text-primary">Commit Changes</h2>
			</div>

			{#if result?.success}
				<div class="p-5">
					<div class="text-center">
						<div class="text-accent-green text-4xl mb-3">✓</div>
						<p class="text-primary font-medium">Committed successfully</p>
						<p class="text-tertiary text-sm mt-1">Hash: {result.hash}</p>
					</div>
				</div>
				<div class="px-5 py-3 border-t border-border flex justify-end">
					<button
						class="text-sm px-4 py-2 rounded bg-active text-primary hover:opacity-80 transition-colors"
						onclick={close}
					>
						Done
					</button>
				</div>
			{:else}
				<div class="p-5 space-y-4">
					<!-- Commit scope -->
					<div>
						<label class="block text-sm text-tertiary mb-2">What to commit</label>
						<div class="flex gap-2">
							<button
								class="flex-1 text-left px-3 py-2 rounded-lg border text-sm transition-colors {commitMode === 'approved' ? 'border-green-600 bg-accent-green/10 text-accent-green' : 'border-border-strong text-tertiary hover:border-border-strong'}"
								onclick={() => (commitMode = 'approved')}
							>
								<div class="font-medium">Approved files only</div>
								<div class="text-xs mt-0.5 opacity-70">{$approvedCount.approved} of {$approvedCount.total} files</div>
							</button>
							<button
								class="flex-1 text-left px-3 py-2 rounded-lg border text-sm transition-colors {commitMode === 'all' ? 'border-blue-600 bg-accent-blue/10 text-accent-blue' : 'border-border-strong text-tertiary hover:border-border-strong'}"
								onclick={() => (commitMode = 'all')}
							>
								<div class="font-medium">All changes</div>
								<div class="text-xs mt-0.5 opacity-70">{$approvedCount.total} files</div>
							</button>
						</div>
					</div>

					{#if commitMode === 'approved' && $approvedCount.approved === 0}
						<div class="text-sm rounded-lg px-3 py-2 bg-accent-yellow/10 text-accent-yellow">
							No files approved yet. Approve files in the sidebar first, or commit all changes.
						</div>
					{/if}

					<!-- Commit message -->
					<div>
						<label class="block text-sm text-tertiary mb-2" for="commit-msg">Commit message</label>
						<textarea
							id="commit-msg"
							bind:value={message}
							onkeydown={handleKeydown}
							class="w-full bg-surface text-primary border border-border-strong rounded-lg px-3 py-2 text-sm resize-y min-h-[100px] focus:outline-none focus:border-blue-500 placeholder:text-muted"
							placeholder="Describe your changes..."
							rows="4"
						></textarea>
					</div>

					{#if result?.error}
						<p class="text-accent-red text-sm">{result.error}</p>
					{/if}
				</div>

				<div class="px-5 py-3 border-t border-border flex items-center justify-between">
					<span class="text-xs text-muted">
						{navigator?.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to commit
					</span>
					<div class="flex gap-2">
						<button
							class="text-sm px-4 py-2 rounded text-tertiary hover:text-primary hover:bg-hover transition-colors"
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
