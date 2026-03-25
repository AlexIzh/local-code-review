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
			<aside class="w-72 shrink-0 bg-zinc-800/50 border-r border-zinc-700 overflow-hidden flex flex-col">
				<FileTree />
			</aside>
		{/if}

		<!-- Main diff area -->
		<main class="flex-1 overflow-y-auto">
			{#if loading}
				<div class="flex items-center justify-center h-full text-zinc-500">
					<div class="text-center">
						<div class="text-2xl mb-2 animate-pulse">⏳</div>
						<p class="text-sm">Loading changes...</p>
					</div>
				</div>
			{:else if error}
				<div class="flex items-center justify-center h-full text-red-400">
					<div class="text-center max-w-md">
						<div class="text-2xl mb-2">⚠️</div>
						<p class="text-sm">{error}</p>
					</div>
				</div>
			{:else if $files.length === 0}
				<div class="flex items-center justify-center h-full text-zinc-500">
					<div class="text-center">
						<div class="text-4xl mb-3">✨</div>
						<p class="font-medium text-zinc-300">No uncommitted changes</p>
						<p class="text-sm mt-1">Make some changes and come back to review them</p>
					</div>
				</div>
			{:else if $selectedDiff}
				<!-- File header -->
				<div class="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur border-b border-zinc-700 px-4 py-2 flex items-center gap-2">
					<button
						class="shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors {$selectedFileData?.approved ? 'bg-green-600 border-green-600 text-white' : 'border-zinc-500 hover:border-green-400 text-transparent hover:text-green-400'}"
						onclick={() => toggleApproval($selectedDiff!.path)}
						title={$selectedFileData?.approved ? 'Unapprove file' : 'Approve file'}
					>
						<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					</button>
					<span class="font-mono text-sm text-zinc-200">{$selectedDiff.path}</span>
					<span class="text-xs text-zinc-500">({$selectedDiff.language})</span>
					{#if $selectedFileData}
						<span class="text-xs tabular-nums">
							{#if $selectedFileData.additions > 0}
								<span class="text-green-400">+{$selectedFileData.additions}</span>
							{/if}
							{#if $selectedFileData.deletions > 0}
								<span class="text-red-400 ml-1">-{$selectedFileData.deletions}</span>
							{/if}
						</span>
					{/if}
					{#if $selectedFileData?.approved}
						<span class="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Approved</span>
					{/if}
				</div>
				<DiffView file={$selectedDiff} />
			{:else}
				<div class="flex items-center justify-center h-full text-zinc-500">
					<p class="text-sm">Select a file from the sidebar</p>
				</div>
			{/if}
		</main>
	</div>

	<TerminalPanel />
</div>

<CommitDialog />
<ExportDialog />
