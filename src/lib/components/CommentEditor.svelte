<script lang="ts">
	import { commentingLine } from '$lib/stores/ui.ts';
	import { addComment } from '$lib/stores/review.ts';

	interface Props {
		filePath: string;
		lineNumber: number;
		side: 'old' | 'new';
		threadId?: string;
		originalLineContent?: string;
		onclose?: () => void;
	}

	let { filePath, lineNumber, side, threadId, originalLineContent, onclose }: Props = $props();

	let text = $state('');
	let commentType = $state<'comment' | 'suggestion' | 'question'>('comment');
	let submitting = $state(false);
	let textarea: HTMLTextAreaElement | undefined = $state();

	$effect(() => {
		textarea?.focus();
	});

	async function submit() {
		if (!text.trim()) return;
		submitting = true;
		try {
			await addComment(filePath, lineNumber, side, text.trim(), commentType, threadId, originalLineContent);
			text = '';
			$commentingLine = null;
			onclose?.();
		} finally {
			submitting = false;
		}
	}

	function cancel() {
		$commentingLine = null;
		onclose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			submit();
		}
		if (e.key === 'Escape') {
			cancel();
		}
	}
</script>

<div class="bg-zinc-800 border border-zinc-600 rounded-lg p-3 my-1 mx-2">
	<div class="flex gap-1 mb-2">
		{#each ['comment', 'suggestion', 'question'] as type}
			{@const active = commentType === type}
			<button
				class="text-xs px-2 py-1 rounded transition-colors {active ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700'}"
				onclick={() => (commentType = type as typeof commentType)}
			>
				{type === 'comment' ? '💬' : type === 'suggestion' ? '💡' : '❓'}
				{type}
			</button>
		{/each}
	</div>
	<textarea
		bind:this={textarea}
		bind:value={text}
		onkeydown={handleKeydown}
		placeholder="Leave a {commentType}..."
		class="w-full bg-zinc-900 text-zinc-200 border border-zinc-600 rounded px-3 py-2 text-sm resize-y min-h-[80px] focus:outline-none focus:border-blue-500 placeholder:text-zinc-500"
		rows="3"
	></textarea>
	<div class="flex items-center justify-between mt-2">
		<span class="text-xs text-zinc-500">
			{navigator?.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to submit
		</span>
		<div class="flex gap-2">
			<button
				class="text-xs px-3 py-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
				onclick={cancel}
			>
				Cancel
			</button>
			<button
				class="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
				disabled={!text.trim() || submitting}
				onclick={submit}
			>
				{submitting ? 'Adding...' : 'Add ' + commentType}
			</button>
		</div>
	</div>
</div>
