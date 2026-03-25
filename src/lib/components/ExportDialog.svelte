<script lang="ts">
	import { showExportDialog } from '$lib/stores/ui.ts';
	import { sendReviewToClaude } from '$lib/stores/terminal.ts';

	let exporting = $state(false);
	let result = $state<{ success: boolean; path?: string; message?: string; text?: string } | null>(null);

	async function exportAs(format: string) {
		exporting = true;
		result = null;
		try {
			if (format === 'claude') {
				// Use terminal panel with streaming
				const res = await sendReviewToClaude();
				if (res.success) {
					$showExportDialog = false;
					return;
				}
				result = res;
				return;
			}

			const res = await fetch('/api/export', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ format })
			});
			result = await res.json();

			if (format === 'clipboard' && result?.text) {
				await navigator.clipboard.writeText(result.text);
				result = { success: true, message: 'Copied to clipboard!' };
			}
		} catch (err) {
			result = { success: false, message: String(err) };
		} finally {
			exporting = false;
		}
	}

	function close() {
		$showExportDialog = false;
		result = null;
	}
</script>

{#if $showExportDialog}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onclick={close}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl w-full max-w-md mx-4" onclick={(e) => e.stopPropagation()}>
			<div class="px-5 py-4 border-b border-zinc-700">
				<h2 class="text-lg font-semibold text-zinc-200">Export Review</h2>
				<p class="text-sm text-zinc-400 mt-1">Send your review comments to AI or save for reference</p>
			</div>

			<div class="p-5 space-y-2">
				<button
					class="w-full text-left px-4 py-3 rounded-lg border border-zinc-600 hover:bg-zinc-700/50 transition-colors group"
					onclick={() => exportAs('claude')}
					disabled={exporting}
				>
					<div class="text-sm font-medium text-zinc-200 group-hover:text-white">Send to Claude Code</div>
					<div class="text-xs text-zinc-400 mt-0.5">Stream review to Claude with live output in terminal</div>
				</button>

				<button
					class="w-full text-left px-4 py-3 rounded-lg border border-zinc-600 hover:bg-zinc-700/50 transition-colors group"
					onclick={() => exportAs('clipboard')}
					disabled={exporting}
				>
					<div class="text-sm font-medium text-zinc-200 group-hover:text-white">Copy to Clipboard</div>
					<div class="text-xs text-zinc-400 mt-0.5">Copy structured review text for any AI tool</div>
				</button>

				<button
					class="w-full text-left px-4 py-3 rounded-lg border border-zinc-600 hover:bg-zinc-700/50 transition-colors group"
					onclick={() => exportAs('json')}
					disabled={exporting}
				>
					<div class="text-sm font-medium text-zinc-200 group-hover:text-white">Export as JSON</div>
					<div class="text-xs text-zinc-400 mt-0.5">Save .lcr-review.json in project root</div>
				</button>

				<button
					class="w-full text-left px-4 py-3 rounded-lg border border-zinc-600 hover:bg-zinc-700/50 transition-colors group"
					onclick={() => exportAs('markdown')}
					disabled={exporting}
				>
					<div class="text-sm font-medium text-zinc-200 group-hover:text-white">Export as Markdown</div>
					<div class="text-xs text-zinc-400 mt-0.5">Save .lcr-review.md in project root</div>
				</button>
			</div>

			{#if result}
				<div class="px-5 pb-3">
					<div class="text-sm rounded-lg px-3 py-2 {result.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
						{result.message || result.path || 'Done!'}
					</div>
				</div>
			{/if}

			<div class="px-5 py-3 border-t border-zinc-700 flex justify-end">
				<button
					class="text-sm px-4 py-2 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
					onclick={close}
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
