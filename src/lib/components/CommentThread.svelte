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

<div class="border-l-2 {thread.outdated ? 'border-accent-yellow/60 opacity-75' : thread.resolved ? 'border-border-strong opacity-60' : 'border-accent-blue'} bg-panel/50 rounded-r-lg my-1 mx-2">
	{#if thread.outdated}
		<div class="px-3 py-1.5 bg-accent-yellow/20 border-b border-border flex items-center gap-2">
			<span class="text-xs font-medium text-accent-yellow">Outdated</span>
			<span class="text-xs text-accent-yellow/70">The code this comment was on has changed</span>
		</div>
	{/if}
	{#each thread.comments as comment, i}
		<div class="px-3 py-2 {i > 0 ? 'border-t border-border' : ''}">
			<div class="flex items-center gap-2 mb-1">
				<span class="text-sm">{typeIcons[comment.type]}</span>
				<span class="text-xs font-medium text-secondary capitalize">{comment.type}</span>
				<span class="text-xs text-muted">{formatTime(comment.createdAt)}</span>
				<span class="text-xs text-faint">Line {comment.lineNumber}</span>
			</div>
			<p class="text-sm text-primary whitespace-pre-wrap">{comment.body}</p>
		</div>
	{/each}

	<div class="px-3 py-2 border-t border-border flex gap-2">
		<button
			class="text-xs text-tertiary hover:text-accent-blue transition-colors"
			onclick={() => (replying = !replying)}
		>
			Reply
		</button>
		<button
			class="text-xs text-tertiary hover:text-accent-green transition-colors"
			onclick={() => resolveThread(thread.id)}
		>
			{thread.resolved ? 'Unresolve' : 'Resolve'}
		</button>
		<button
			class="text-xs text-tertiary hover:text-accent-red transition-colors"
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
