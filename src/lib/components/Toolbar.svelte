<script lang="ts">
	import { viewMode, showCommitDialog, showExportDialog } from '$lib/stores/ui.ts';
	import { stats, reviewStatus, submitReview } from '$lib/stores/review.ts';
	import { diffMode, approvedCount, diffStats, loadAllDiffs } from '$lib/stores/files.ts';

	let showReviewMenu = $state(false);

	async function handleApprove() {
		await submitReview('approved');
		$showCommitDialog = true;
	}

	async function handleRequestChanges() {
		await submitReview('changes_requested');
		$showExportDialog = true;
	}

	async function setDiffMode(mode: 'full' | 'unstaged') {
		$diffMode = mode;
		await loadAllDiffs(mode);
	}
</script>

<header class="bg-zinc-800 border-b border-zinc-700 px-4 py-2 flex items-center gap-3">
	<h1 class="text-sm font-semibold text-zinc-200 mr-4">Local Code Review</h1>

	<!-- View mode toggle -->
	<div class="flex bg-zinc-900 rounded overflow-hidden border border-zinc-700">
		<button
			class="text-xs px-3 py-1 transition-colors {$viewMode === 'unified' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}"
			onclick={() => ($viewMode = 'unified')}
		>
			Unified
		</button>
		<button
			class="text-xs px-3 py-1 transition-colors {$viewMode === 'split' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}"
			onclick={() => ($viewMode = 'split')}
		>
			Split
		</button>
	</div>

	<!-- Diff mode toggle -->
	<div class="flex bg-zinc-900 rounded overflow-hidden border border-zinc-700">
		<button
			class="text-xs px-3 py-1 transition-colors {$diffMode === 'full' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}"
			onclick={() => setDiffMode('full')}
		>
			Full Diff
		</button>
		<button
			class="text-xs px-3 py-1 transition-colors {$diffMode === 'unstaged' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}"
			onclick={() => setDiffMode('unstaged')}
		>
			Needs Review
		</button>
	</div>

	<div class="flex-1"></div>

	<!-- Diff stats -->
	{#if $approvedCount.total > 0}
		<span class="text-xs text-zinc-400 flex items-center gap-2">
			<span><span class="text-green-400">{$approvedCount.approved}</span>/{$approvedCount.total} approved</span>
			<span class="text-zinc-600">|</span>
			<span class="text-green-400">+{$diffStats.additions}</span>
			<span class="text-red-400">-{$diffStats.deletions}</span>
			{#if $diffStats.unapprovedAdditions > 0 || $diffStats.unapprovedDeletions > 0}
				<span class="text-zinc-600">|</span>
				<span class="text-yellow-400">
					{$diffStats.unapprovedAdditions + $diffStats.unapprovedDeletions} lines to review
				</span>
			{/if}
		</span>
	{/if}

	<!-- Stats -->
	{#if $stats.totalComments > 0}
		<span class="text-xs text-zinc-400">
			{$stats.totalComments} comment{$stats.totalComments !== 1 ? 's' : ''}
			{#if $stats.unresolvedThreads > 0}
				<span class="text-yellow-400">({$stats.unresolvedThreads} unresolved)</span>
			{/if}
		</span>
	{/if}

	<!-- Status badge -->
	{#if $reviewStatus !== 'pending'}
		<span
			class="text-xs px-2 py-0.5 rounded-full {$reviewStatus === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}"
		>
			{$reviewStatus === 'approved' ? 'Approved' : 'Changes Requested'}
		</span>
	{/if}

	<!-- Export button -->
	<button
		class="text-xs px-3 py-1.5 rounded border border-zinc-600 text-zinc-300 hover:bg-zinc-700 transition-colors"
		onclick={() => ($showExportDialog = true)}
	>
		Export
	</button>

	<!-- Review actions -->
	<div class="relative">
		<button
			class="text-xs px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-500 transition-colors"
			onclick={() => (showReviewMenu = !showReviewMenu)}
		>
			Review ▾
		</button>

		{#if showReviewMenu}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="fixed inset-0 z-10"
				onclick={() => (showReviewMenu = false)}
			></div>
			<div class="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl z-20 py-1 min-w-[220px]">
				<button
					class="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
					onclick={() => { handleRequestChanges(); showReviewMenu = false; }}
				>
					<span class="text-yellow-400 mr-2">↻</span> Request Changes (send to AI)
				</button>
				<button
					class="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
					onclick={() => { handleApprove(); showReviewMenu = false; }}
				>
					<span class="text-green-400 mr-2">✓</span> Approve & Commit
				</button>
			</div>
		{/if}
	</div>
</header>
