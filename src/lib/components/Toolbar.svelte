<script lang="ts">
	import { viewMode, showCommitDialog, showExportDialog, theme } from '$lib/stores/ui.ts';
	import { stats, reviewStatus, submitReview } from '$lib/stores/review.ts';
	import { diffMode, diffScope, baseBranch, approvedCount, uncommittedCount, diffStats, loadAllDiffs, setDiffScope, loadUncommittedFiles } from '$lib/stores/files.ts';

	let showReviewMenu = $state(false);

	function openReviewMenu() {
		showReviewMenu = !showReviewMenu;
		if (showReviewMenu) loadUncommittedFiles();
	}

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

<header class="bg-panel border-b border-border px-4 py-2 flex items-center gap-3">
	<h1 class="text-sm font-semibold text-primary mr-4">Local Code Review</h1>

	<!-- View mode toggle -->
	<div class="flex bg-surface rounded overflow-hidden border border-border">
		<button
			class="text-xs px-3 py-1 transition-colors {$viewMode === 'unified' ? 'bg-active text-white' : 'text-tertiary hover:text-primary'}"
			onclick={() => ($viewMode = 'unified')}
		>
			Unified
		</button>
		<button
			class="text-xs px-3 py-1 transition-colors {$viewMode === 'split' ? 'bg-active text-white' : 'text-tertiary hover:text-primary'}"
			onclick={() => ($viewMode = 'split')}
		>
			Split
		</button>
	</div>

	<!-- Diff scope toggle -->
	<div class="flex bg-surface rounded overflow-hidden border border-border">
		<button
			class="text-xs px-3 py-1 transition-colors {$diffScope === 'uncommitted' ? 'bg-active text-white' : 'text-tertiary hover:text-primary'}"
			onclick={() => setDiffScope('uncommitted')}
		>
			Uncommitted
		</button>
		<button
			class="text-xs px-3 py-1 transition-colors {$diffScope === 'worktree' ? 'bg-active text-white' : 'text-tertiary hover:text-primary'}"
			onclick={() => setDiffScope('worktree')}
			title={$baseBranch ? `Comparing against ${$baseBranch}` : 'Show all branch changes'}
		>
			Worktree
		</button>
	</div>

	<!-- Diff mode toggle -->
	<div class="flex bg-surface rounded overflow-hidden border border-border">
		<button
			class="text-xs px-3 py-1 transition-colors {$diffMode === 'full' ? 'bg-active text-white' : 'text-tertiary hover:text-primary'}"
			onclick={() => setDiffMode('full')}
		>
			Full Diff
		</button>
		<button
			class="text-xs px-3 py-1 transition-colors {$diffMode === 'unstaged' ? 'bg-active text-white' : 'text-tertiary hover:text-primary'}"
			onclick={() => setDiffMode('unstaged')}
		>
			Needs Review
		</button>
	</div>

	<div class="flex-1"></div>

	<!-- Diff stats -->
	{#if $approvedCount.total > 0}
		<span class="text-xs text-tertiary flex items-center gap-2">
			<span><span class="text-accent-green">{$approvedCount.approved}</span>/{$approvedCount.total} approved</span>
			<span class="text-faint">|</span>
			<span class="text-accent-green">+{$diffStats.additions}</span>
			<span class="text-accent-red">-{$diffStats.deletions}</span>
			{#if $diffStats.unapprovedAdditions > 0 || $diffStats.unapprovedDeletions > 0}
				<span class="text-faint">|</span>
				<span class="text-accent-yellow">
					{$diffStats.unapprovedAdditions + $diffStats.unapprovedDeletions} lines to review
				</span>
			{/if}
		</span>
	{/if}

	<!-- Stats -->
	{#if $stats.totalComments > 0}
		<span class="text-xs text-tertiary">
			{$stats.totalComments} comment{$stats.totalComments !== 1 ? 's' : ''}
			{#if $stats.unresolvedThreads > 0}
				<span class="text-accent-yellow">({$stats.unresolvedThreads} unresolved)</span>
			{/if}
		</span>
	{/if}

	<!-- Status badge -->
	{#if $reviewStatus !== 'pending'}
		<span
			class="text-xs px-2 py-0.5 rounded-full {$reviewStatus === 'approved' ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-yellow/20 text-accent-yellow'}"
		>
			{$reviewStatus === 'approved' ? 'Approved' : 'Changes Requested'}
		</span>
	{/if}

	<!-- Theme toggle -->
	<button
		class="text-xs px-2 py-1.5 rounded border border-border-strong text-tertiary hover:text-primary hover:bg-hover transition-colors"
		onclick={() => theme.toggle()}
		title="Toggle theme"
	>
		{$theme === 'dark' ? '☀️' : '🌙'}
	</button>

	<!-- Export button -->
	<button
		class="text-xs px-3 py-1.5 rounded border border-border-strong text-secondary hover:bg-hover transition-colors"
		onclick={() => ($showExportDialog = true)}
	>
		Export
	</button>

	<!-- Review actions -->
	<div class="relative">
		<button
			class="text-xs px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-500 transition-colors"
			onclick={openReviewMenu}
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
			<div class="absolute right-0 top-full mt-1 bg-panel border border-border-strong rounded-lg shadow-xl z-20 py-1 min-w-[220px]">
				<button
					class="w-full text-left px-3 py-2 text-sm text-secondary hover:bg-hover transition-colors"
					onclick={() => { handleRequestChanges(); showReviewMenu = false; }}
				>
					<span class="text-accent-yellow mr-2">↻</span> Request Changes (send to AI)
				</button>
				<button
					class="w-full text-left px-3 py-2 text-sm transition-colors {$uncommittedCount.total === 0 ? 'text-muted cursor-not-allowed' : 'text-secondary hover:bg-hover'}"
					disabled={$uncommittedCount.total === 0}
					onclick={() => { handleApprove(); showReviewMenu = false; }}
				>
					<span class="text-accent-green mr-2">✓</span> Approve & Commit
					{#if $uncommittedCount.total === 0}
						<span class="text-xs text-muted ml-1">(no uncommitted changes)</span>
					{/if}
				</button>
			</div>
		{/if}
	</div>
</header>
