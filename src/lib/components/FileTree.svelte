<script lang="ts">
	import { files, selectedFile, fileCommentCounts, toggleApproval, resetFile, contextFiles, toggleContextFile } from '$lib/stores/files.ts';

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

	let contextMenu = $state<{ x: number; y: number; path: string; status: string } | null>(null);
	let confirmingReset = $state<string | null>(null);
	let contextFileInput = $state('');
	let showContextInput = $state(false);
	let collapsedDirs = $state<Set<string>>(new Set());

	interface FileGroup {
		dir: string;
		files: typeof $files;
	}

	let groupedFiles = $derived.by(() => {
		const groups = new Map<string, typeof $files>();
		for (const file of $files) {
			const dir = getDirectory(file.path) || '.';
			if (!groups.has(dir)) groups.set(dir, []);
			groups.get(dir)!.push(file);
		}
		// Sort groups by directory name
		const sorted: FileGroup[] = [];
		for (const [dir, files] of groups) {
			sorted.push({ dir, files });
		}
		sorted.sort((a, b) => a.dir.localeCompare(b.dir));
		return sorted;
	});

	function toggleDir(dir: string) {
		const next = new Set(collapsedDirs);
		if (next.has(dir)) {
			next.delete(dir);
		} else {
			next.add(dir);
		}
		collapsedDirs = next;
	}

	async function addContextFromInput() {
		if (!contextFileInput.trim()) return;
		await toggleContextFile(contextFileInput.trim());
		contextFileInput = '';
		showContextInput = false;
	}

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

	function handleContextMenu(e: MouseEvent, path: string, status: string) {
		e.preventDefault();
		e.stopPropagation();
		contextMenu = { x: e.clientX, y: e.clientY, path, status };
	}

	function closeContextMenu() {
		contextMenu = null;
	}

	function handleReset(path: string) {
		contextMenu = null;
		confirmingReset = path;
	}

	async function confirmReset() {
		if (confirmingReset) {
			await resetFile(confirmingReset);
			confirmingReset = null;
		}
	}
</script>

<div class="h-full overflow-y-auto">
	<div class="px-3 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
		Changed Files ({$files.length})
	</div>
	<div class="space-y-px">
		{#each groupedFiles as group}
			{@const isCollapsed = collapsedDirs.has(group.dir)}
			{@const dirFileCount = group.files.length}
			<!-- Directory header -->
			{#if groupedFiles.length > 1}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-secondary cursor-pointer hover:bg-hover/30 transition-colors select-none"
					onclick={() => toggleDir(group.dir)}
				>
					<span class="w-4 text-center transition-transform {isCollapsed ? '' : 'rotate-90'}">▸</span>
					<span class="truncate font-mono">{group.dir}</span>
					<span class="text-muted/60 ml-1">({dirFileCount})</span>
				</div>
			{/if}

			<!-- Files in this directory -->
			{#if !isCollapsed}
				{#each group.files as file}
					{@const isSelected = $selectedFile === file.path}
					{@const commentCount = $fileCommentCounts[file.path] || 0}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="w-full text-left py-1.5 flex items-center gap-2 text-sm hover:bg-hover/50 transition-colors cursor-pointer group {isSelected ? 'bg-hover/80 text-primary' : 'text-secondary'} {file.approved ? 'opacity-60' : ''} {groupedFiles.length > 1 ? 'pl-7 pr-3' : 'px-3'}"
						onclick={() => selectFile(file.path)}
						oncontextmenu={(e) => handleContextMenu(e, file.path, file.status)}
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
						<!-- More actions button -->
						<button
							class="shrink-0 opacity-0 group-hover:opacity-100 text-muted hover:text-primary transition-all text-xs px-0.5"
							onclick={(e) => { e.stopPropagation(); handleContextMenu(e, file.path, file.status); }}
							title="More actions"
						>
							⋯
						</button>
					</div>
				{/each}
			{/if}
		{/each}
	</div>
</div>

<!-- Context files section -->
{#if $contextFiles.length > 0 || showContextInput}
	<div class="px-3 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider border-t border-border mt-2">
		Context Files ({$contextFiles.length})
	</div>
	<div class="space-y-px px-1">
		{#each $contextFiles as ctxFile}
			<div class="flex items-center gap-2 px-2 py-1 text-xs text-secondary">
				<span class="text-muted">📎</span>
				<span class="truncate flex-1 font-mono">{ctxFile}</span>
				<button
					class="text-muted hover:text-accent-red transition-colors shrink-0"
					onclick={() => toggleContextFile(ctxFile)}
					title="Remove from context"
				>✗</button>
			</div>
		{/each}
	</div>
{/if}
{#if showContextInput}
	<div class="px-3 py-2">
		<input
			type="text"
			class="w-full bg-surface text-primary border border-border-strong rounded px-2 py-1 text-xs focus:outline-none focus:border-accent-blue placeholder:text-muted"
			placeholder="path/to/file.ts"
			bind:value={contextFileInput}
			onkeydown={(e) => { if (e.key === 'Enter') addContextFromInput(); if (e.key === 'Escape') showContextInput = false; }}
		/>
	</div>
{/if}
<div class="px-3 py-1">
	<button
		class="text-xs text-muted hover:text-secondary transition-colors"
		onclick={() => (showContextInput = !showContextInput)}
	>
		+ Add context file
	</button>
</div>

<!-- Context menu -->
{#if contextMenu}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50" onclick={closeContextMenu}></div>
	<div
		class="fixed z-50 bg-panel border border-border-strong rounded-lg shadow-xl py-1 min-w-[180px]"
		style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
	>
		<button
			class="w-full text-left px-3 py-1.5 text-sm text-secondary hover:bg-hover transition-colors"
			onclick={() => { toggleApproval(contextMenu!.path); closeContextMenu(); }}
		>
			{$files.find(f => f.path === contextMenu!.path)?.approved ? '✗ Unapprove' : '✓ Approve'}
		</button>
		<button
			class="w-full text-left px-3 py-1.5 text-sm text-secondary hover:bg-hover transition-colors"
			onclick={() => { toggleContextFile(contextMenu!.path); closeContextMenu(); }}
		>
			{$contextFiles.includes(contextMenu!.path) ? '✗ Remove from context' : '📎 Add as context'}
		</button>
		<div class="border-t border-border my-1"></div>
		<button
			class="w-full text-left px-3 py-1.5 text-sm text-accent-red hover:bg-hover transition-colors"
			onclick={() => handleReset(contextMenu!.path)}
		>
			{contextMenu.status === 'added' ? '🗑 Delete file' : '↩ Reset file'}
		</button>
	</div>
{/if}

<!-- Reset confirmation dialog -->
{#if confirmingReset}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onclick={() => (confirmingReset = null)}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="bg-panel border border-border-strong rounded-lg p-4 max-w-md shadow-xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-primary font-medium mb-2">Reset file?</h3>
			<p class="text-sm text-secondary mb-1">
				{$files.find(f => f.path === confirmingReset)?.status === 'added'
					? 'This will delete the file:'
					: 'This will discard all changes in:'}
			</p>
			<p class="text-sm text-primary font-mono mb-4">{confirmingReset}</p>
			<p class="text-xs text-accent-red mb-4">This action cannot be undone.</p>
			<div class="flex justify-end gap-2">
				<button
					class="text-sm px-3 py-1.5 rounded text-secondary hover:text-primary hover:bg-hover transition-colors"
					onclick={() => (confirmingReset = null)}
				>
					Cancel
				</button>
				<button
					class="text-sm px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-500 transition-colors"
					onclick={confirmReset}
				>
					{$files.find(f => f.path === confirmingReset)?.status === 'added' ? 'Delete' : 'Reset'}
				</button>
			</div>
		</div>
	</div>
{/if}
