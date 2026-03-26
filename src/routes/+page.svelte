<script lang="ts">
	import { onMount } from 'svelte';
	import FileTree from '$lib/components/FileTree.svelte';
	import DiffView from '$lib/components/DiffView.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import CommitDialog from '$lib/components/CommitDialog.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import TerminalPanel from '$lib/components/TerminalPanel.svelte';
	import { files, selectedFile, selectedDiff, selectedFileData, loadFiles, loadAllDiffs, toggleApproval } from '$lib/stores/files.ts';
	import { loadComments } from '$lib/stores/review.ts';
	import { sidebarOpen } from '$lib/stores/ui.ts';
	import { toggleTerminal } from '$lib/stores/terminal.ts';

	let loading = $state(true);
	let error = $state<string | null>(null);
	let sidebarWidth = $state(288); // 18rem default
	let isResizingSidebar = $state(false);

	function startSidebarResize(e: MouseEvent) {
		e.preventDefault();
		isResizingSidebar = true;
		const startX = e.clientX;
		const startWidth = sidebarWidth;

		function onMouseMove(e: MouseEvent) {
			const newWidth = startWidth + (e.clientX - startX);
			sidebarWidth = Math.max(200, Math.min(600, newWidth));
		}

		function onMouseUp() {
			isResizingSidebar = false;
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
		}

		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
	}

	onMount(async () => {
		try {
			await loadFiles();
			await loadAllDiffs();
			await loadComments();
		} catch (err) {
			error = String(err);
		} finally {
			loading = false;
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

		const fileList = $files;
		const currentIdx = fileList.findIndex((f) => f.path === $selectedFile);

		if (e.key === 'j' && currentIdx < fileList.length - 1) {
			e.preventDefault();
			$selectedFile = fileList[currentIdx + 1].path;
		}
		if (e.key === 'k' && currentIdx > 0) {
			e.preventDefault();
			$selectedFile = fileList[currentIdx - 1].path;
		}
		if (e.key === 'b') {
			e.preventDefault();
			$sidebarOpen = !$sidebarOpen;
		}
		if (e.key === '`') {
			e.preventDefault();
			toggleTerminal();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="h-full flex flex-col">
	<Toolbar />

	<div class="flex-1 flex overflow-hidden">
		<!-- Sidebar -->
		{#if $sidebarOpen}
			<aside class="shrink-0 bg-panel/50 border-r border-border overflow-hidden flex flex-col relative" style="width: {sidebarWidth}px">
				<FileTree />
				<!-- Resize handle -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-accent-blue/50 transition-colors {isResizingSidebar ? 'bg-accent-blue/50' : ''}"
					onmousedown={startSidebarResize}
				></div>
			</aside>
		{/if}

		<!-- Main diff area -->
		<main class="flex-1 overflow-y-auto">
			{#if loading}
				<div class="flex items-center justify-center h-full text-muted">
					<div class="text-center">
						<div class="text-2xl mb-2 animate-pulse">⏳</div>
						<p class="text-sm">Loading changes...</p>
					</div>
				</div>
			{:else if error}
				<div class="flex items-center justify-center h-full text-accent-red">
					<div class="text-center max-w-md">
						<div class="text-2xl mb-2">⚠️</div>
						<p class="text-sm">{error}</p>
					</div>
				</div>
			{:else if $files.length === 0}
				<div class="flex items-center justify-center h-full text-muted">
					<div class="text-center">
						<div class="text-4xl mb-3">✨</div>
						<p class="font-medium text-secondary">No uncommitted changes</p>
						<p class="text-sm mt-1">Make some changes and come back to review them</p>
					</div>
				</div>
			{:else if $selectedDiff}
				<!-- File header -->
				<div class="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-4 py-2 flex items-center gap-2">
					<button
						class="shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors {$selectedFileData?.approved ? 'bg-green-600 border-green-600 text-white' : 'border-border-strong hover:border-accent-green text-transparent hover:text-accent-green'}"
						onclick={() => toggleApproval($selectedDiff!.path)}
						title={$selectedFileData?.approved ? 'Unapprove file' : 'Approve file'}
					>
						<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					</button>
					<span class="font-mono text-sm text-primary">{$selectedDiff.path}</span>
					<span class="text-xs text-muted">({$selectedDiff.language})</span>
					{#if $selectedFileData}
						<span class="text-xs tabular-nums">
							{#if $selectedFileData.additions > 0}
								<span class="text-accent-green">+{$selectedFileData.additions}</span>
							{/if}
							{#if $selectedFileData.deletions > 0}
								<span class="text-accent-red ml-1">-{$selectedFileData.deletions}</span>
							{/if}
						</span>
					{/if}
					{#if $selectedFileData?.approved}
						<span class="text-xs px-2 py-0.5 rounded-full bg-accent-green/20 text-accent-green">Approved</span>
					{/if}
				</div>
				<DiffView file={$selectedDiff} />
			{:else}
				<div class="flex items-center justify-center h-full text-muted">
					<p class="text-sm">Select a file from the sidebar</p>
				</div>
			{/if}
		</main>
	</div>

	<TerminalPanel />
</div>

<CommitDialog />
<ExportDialog />
