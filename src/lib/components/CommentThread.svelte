<script lang="ts">
	import type { ReviewThread } from '$lib/types/index.ts';
	import { resolveThread, deleteThread } from '$lib/stores/review.ts';
	import CommentEditor from './CommentEditor.svelte';

	interface Props {
		thread: ReviewThread;
	}

	let { thread }: Props = $props();
	let replying = $state(false);

	const typeIcons: Record<string, string> = {
		comment: '💬',
		suggestion: '💡',
		question: '❓'
	};

	function formatTime(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<div class="border-l-2 {thread.outdated ? 'border-yellow-500/60 opacity-75' : thread.resolved ? 'border-zinc-600 opacity-60' : 'border-blue-500'} bg-zinc-800/50 rounded-r-lg my-1 mx-2">
	{#if thread.outdated}
		<div class="px-3 py-1.5 bg-yellow-900/20 border-b border-zinc-700 flex items-center gap-2">
			<span class="text-xs font-medium text-yellow-400">Outdated</span>
			<span class="text-xs text-yellow-500/70">The code this comment was on has changed</span>
		</div>
	{/if}
	{#each thread.comments as comment, i}
		<div class="px-3 py-2 {i > 0 ? 'border-t border-zinc-700' : ''}">
			<div class="flex items-center gap-2 mb-1">
				<span class="text-sm">{typeIcons[comment.type]}</span>
				<span class="text-xs font-medium text-zinc-300 capitalize">{comment.type}</span>
				<span class="text-xs text-zinc-500">{formatTime(comment.createdAt)}</span>
				<span class="text-xs text-zinc-600">Line {comment.lineNumber}</span>
			</div>
			<p class="text-sm text-zinc-200 whitespace-pre-wrap">{comment.body}</p>
		</div>
	{/each}

	<div class="px-3 py-2 border-t border-zinc-700 flex gap-2">
		<button
			class="text-xs text-zinc-400 hover:text-blue-400 transition-colors"
			onclick={() => (replying = !replying)}
		>
			Reply
		</button>
		<button
			class="text-xs text-zinc-400 hover:text-green-400 transition-colors"
			onclick={() => resolveThread(thread.id)}
		>
			{thread.resolved ? 'Unresolve' : 'Resolve'}
		</button>
		<button
			class="text-xs text-zinc-400 hover:text-red-400 transition-colors"
			onclick={() => deleteThread(thread.id)}
		>
			Delete
		</button>
	</div>

	{#if replying}
		<div class="px-2 pb-2">
			<CommentEditor
				filePath={thread.filePath}
				lineNumber={thread.lineNumber}
				side={thread.side}
				threadId={thread.id}
				onclose={() => (replying = false)}
			/>
		</div>
	{/if}
</div>
