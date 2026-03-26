<script lang="ts">
	import { showExportDialog } from '$lib/stores/ui.ts';
	import { sendReviewToClaude } from '$lib/stores/terminal.ts';

	let exporting = $state(false);
	let result = $state<{ success: boolean; path?: string; message?: string; text?: string } | null>(null);
	let clipboardState = $state<'idle' | 'loading' | 'ready' | 'copied'>('idle');
	let pendingClipboardText = $state<string | null>(null);

	async function exportAs(format: string) {
		if (format === 'clipboard') {
			clipboardState = 'loading';
			pendingClipboardText = null;
			try {
				const res = await fetch('/api/export', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ format })
				});
				const data = await res.json();
				if (data?.text) {
					pendingClipboardText = data.text;
					// Ensure "Preparing..." is visible long enough for user to notice
					await new Promise((r) => setTimeout(r, 800));
					clipboardState = 'ready';
				} else {
					result = { success: false, message: 'No content to copy.' };
					clipboardState = 'idle';
				}
			} catch (err) {
				result = { success: false, message: String(err) };
				clipboardState = 'idle';
			}
			return;
		}

		exporting = true;
		result = null;
		try {
			if (format === 'claude') {
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
		} catch (err) {
			result = { success: false, message: String(err) };
		} finally {
			exporting = false;
		}
	}

	function copyNow() {
		if (!pendingClipboardText) return;
		navigator.clipboard.writeText(pendingClipboardText).then(() => {
			clipboardState = 'copied';
			pendingClipboardText = null;
			setTimeout(() => { clipboardState = 'idle'; }, 2000);
		}).catch(() => {
			const textarea = document.createElement('textarea');
			textarea.value = pendingClipboardText!;
			textarea.style.position = 'fixed';
			textarea.style.left = '-9999px';
			document.body.appendChild(textarea);
			textarea.focus();
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
			clipboardState = 'copied';
			pendingClipboardText = null;
			setTimeout(() => { clipboardState = 'idle'; }, 2000);
		});
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
		<div class="bg-panel border border-border-strong rounded-xl shadow-2xl w-full max-w-md mx-4" onclick={(e) => e.stopPropagation()}>
			<div class="px-5 py-4 border-b border-border">
				<h2 class="text-lg font-semibold text-primary">Export Review</h2>
				<p class="text-sm text-tertiary mt-1">Send your review comments to AI or save for reference</p>
			</div>

			<div class="p-5 space-y-2">
				<button
					class="w-full text-left px-4 py-3 rounded-lg border border-border-strong hover:bg-hover/50 transition-colors group"
					onclick={() => exportAs('claude')}
					disabled={exporting}
				>
					<div class="text-sm font-medium text-primary group-hover:opacity-80">Send to Claude Code</div>
					<div class="text-xs text-tertiary mt-0.5">Stream review to Claude with live output in terminal</div>
				</button>

				<button
					class="w-full text-left px-4 py-3 rounded-lg border transition-all {clipboardState === 'ready' ? 'border-accent-blue bg-accent-blue/10 ring-1 ring-accent-blue/30' : clipboardState === 'copied' ? 'border-accent-green bg-accent-green/10' : 'border-border-strong hover:bg-hover/50'} group"
					onclick={() => clipboardState === 'ready' ? copyNow() : exportAs('clipboard')}
					disabled={exporting || clipboardState === 'loading'}
				>
					{#if clipboardState === 'loading'}
						<div class="text-sm font-medium text-primary flex items-center gap-2">
							<span class="animate-spin">⏳</span> Preparing content...
						</div>
						<div class="text-xs text-tertiary mt-0.5">Generating review text</div>
					{:else if clipboardState === 'ready'}
						<div class="text-sm font-medium text-accent-blue flex items-center gap-2">
							📋 Content ready — click to copy
						</div>
						<div class="text-xs text-accent-blue/70 mt-0.5">Click now to copy to clipboard</div>
					{:else if clipboardState === 'copied'}
						<div class="text-sm font-medium text-accent-green flex items-center gap-2">
							✓ Copied to clipboard!
						</div>
					{:else}
						<div class="text-sm font-medium text-primary group-hover:opacity-80">Copy to Clipboard</div>
						<div class="text-xs text-tertiary mt-0.5">Copy structured review text for any AI tool</div>
					{/if}
				</button>

				<button
					class="w-full text-left px-4 py-3 rounded-lg border border-border-strong hover:bg-hover/50 transition-colors group"
					onclick={() => exportAs('json')}
					disabled={exporting}
				>
					<div class="text-sm font-medium text-primary group-hover:opacity-80">Export as JSON</div>
					<div class="text-xs text-tertiary mt-0.5">Save .lcr-review.json in project root</div>
				</button>

				<button
					class="w-full text-left px-4 py-3 rounded-lg border border-border-strong hover:bg-hover/50 transition-colors group"
					onclick={() => exportAs('markdown')}
					disabled={exporting}
				>
					<div class="text-sm font-medium text-primary group-hover:opacity-80">Export as Markdown</div>
					<div class="text-xs text-tertiary mt-0.5">Save .lcr-review.md in project root</div>
				</button>
			</div>

			{#if result}
				<div class="px-5 pb-3">
					<div class="text-sm rounded-lg px-3 py-2 {result.success ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}">
						{result.message || result.path || 'Done!'}
					</div>
				</div>
			{/if}

			<div class="px-5 py-3 border-t border-border flex justify-end">
				<button
					class="text-sm px-4 py-2 rounded text-tertiary hover:text-primary hover:bg-hover transition-colors"
					onclick={close}
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
