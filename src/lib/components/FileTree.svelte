<script lang="ts">
	import { files, selectedFile, fileCommentCounts, toggleApproval } from '$lib/stores/files.ts';

	const statusColors: Record<string, string> = {
		added: 'text-accent-green',
		modified: 'text-accent-yellow',
		deleted: 'text-accent-red',
		renamed: 'text-accent-blue'
	};

	const statusLabels: Record<string, string> = {
		added: 'A',
		modified: 'M',
		deleted: 'D',
		renamed: 'R'
	};

	function selectFile(path: string) {
		$selectedFile = path;
	}

	function getFilename(path: string): string {
		return path.split('/').pop() || path;
	}

	function getDirectory(path: string): string {
		const parts = path.split('/');
		if (parts.length <= 1) return '';
		return parts.slice(0, -1).join('/');
	}

	function handleApprove(e: Event, path: string) {
		e.stopPropagation();
		toggleApproval(path);
	}
</script>

<div class="h-full overflow-y-auto">
	<div class="px-3 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
		Changed Files ({$files.length})
	</div>
	<div class="space-y-px">
		{#each $files as file}
			{@const isSelected = $selectedFile === file.path}
			{@const commentCount = $fileCommentCounts[file.path] || 0}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="w-full text-left px-3 py-1.5 flex items-center gap-2 text-sm hover:bg-hover/50 transition-colors cursor-pointer {isSelected ? 'bg-hover/80 text-primary' : 'text-secondary'} {file.approved ? 'opacity-60' : ''}"
				onclick={() => selectFile(file.path)}
			>
				<!-- Approve checkbox -->
				<button
					class="shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors {file.approved ? 'bg-green-600 border-green-600 text-white' : 'border-border-strong hover:border-accent-green text-transparent hover:text-accent-green'}"
					onclick={(e) => handleApprove(e, file.path)}
					title={file.approved ? 'Unapprove file' : 'Approve file'}
				>
					<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</button>

				<span class="font-mono text-xs font-bold w-4 text-center {statusColors[file.status]}">
					{statusLabels[file.status]}
				</span>
				<span class="truncate flex-1 {file.approved ? 'line-through decoration-muted' : ''}">
					{#if getDirectory(file.path)}
						<span class="text-muted">{getDirectory(file.path)}/</span>
					{/if}
					<span class="font-medium">{getFilename(file.path)}</span>
				</span>
				<span class="text-xs text-muted tabular-nums shrink-0">
					{#if file.additions > 0}
						<span class="text-accent-green">+{file.additions}</span>
					{/if}
					{#if file.deletions > 0}
						<span class="text-accent-red">-{file.deletions}</span>
					{/if}
				</span>
				{#if commentCount > 0}
					<span class="bg-accent-blue/20 text-accent-blue text-xs px-1.5 py-0.5 rounded-full font-medium">
						{commentCount}
					</span>
				{/if}
			</div>
		{/each}
	</div>
</div>
