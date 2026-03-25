<script lang="ts">
	import type { DiffFile, DiffLine, DiffHunk } from '$lib/types/index.ts';
	import type { ReviewThread } from '$lib/types/index.ts';
	import { viewMode, commentingLine } from '$lib/stores/ui.ts';
	import { threadsByFile } from '$lib/stores/review.ts';
	import CommentEditor from './CommentEditor.svelte';
	import CommentThread from './CommentThread.svelte';

	interface Props {
		file: DiffFile;
	}

	let { file }: Props = $props();

	// Track expanded context lines per hunk boundary
	let expandedLines = $state<Map<string, DiffLine[]>>(new Map());

	let fileThreads = $derived($threadsByFile.get(file.path) || []);

	function getThreadsForLine(lineNumber: number, side: 'old' | 'new'): ReviewThread[] {
		return fileThreads.filter((t) => t.lineNumber === lineNumber && t.side === side);
	}

	function startComment(lineNumber: number, side: 'old' | 'new', originalLineContent?: string) {
		$commentingLine = { filePath: file.path, lineNumber, side, originalLineContent };
	}

	function isCommenting(lineNumber: number, side: 'old' | 'new'): boolean {
		const c = $commentingLine;
		return c !== null && c.filePath === file.path && c.lineNumber === lineNumber && c.side === side;
	}

	function getLineKey(line: DiffLine): number {
		if (line.type === 'del') return line.oldNumber!;
		return line.newNumber!;
	}

	function getLineSide(line: DiffLine): 'old' | 'new' {
		return line.type === 'del' ? 'old' : 'new';
	}

	function lineBg(type: string): string {
		if (type === 'add') return 'bg-diff-add';
		if (type === 'del') return 'bg-diff-del';
		return '';
	}

	const EXPAND_COUNT = 20;

	// Get the effective end line of a hunk (including its after-expansion)
	function getHunkEndLine(hunkIndex: number): number {
		const hunk = file.hunks[hunkIndex];
		const afterLines = expandedLines.get(`after-${hunkIndex}`) || [];
		if (afterLines.length > 0) {
			return afterLines[afterLines.length - 1].newNumber || afterLines[afterLines.length - 1].oldNumber || 0;
		}
		return hunk.newStart + hunk.newLines - 1;
	}

	// Get the effective start line of a hunk (including its before-expansion)
	function getHunkStartLine(hunkIndex: number): number {
		const hunk = file.hunks[hunkIndex];
		const beforeLines = expandedLines.get(`before-${hunkIndex}`) || [];
		if (beforeLines.length > 0) {
			return beforeLines[0].newNumber || beforeLines[0].oldNumber || 0;
		}
		return hunk.newStart;
	}

	async function expandBefore(hunkIndex: number) {
		const key = `before-${hunkIndex}`;
		const existing = expandedLines.get(key) || [];
		const currentFirstLine = getHunkStartLine(hunkIndex);

		// Don't expand past the previous hunk's end
		let minLine = 1;
		if (hunkIndex > 0) {
			minLine = getHunkEndLine(hunkIndex - 1) + 1;
		}

		const endLine = currentFirstLine - 1;
		const startLine = Math.max(minLine, endLine - EXPAND_COUNT + 1);
		if (startLine > endLine) return;

		const res = await fetch(`/api/context?file=${encodeURIComponent(file.path)}&start=${startLine}&end=${endLine}`);
		const data = await res.json();
		if (data.lines) {
			const newMap = new Map(expandedLines);
			newMap.set(key, [...data.lines, ...existing]);
			expandedLines = newMap;
		}
	}

	async function expandAfter(hunkIndex: number) {
		const key = `after-${hunkIndex}`;
		const existing = expandedLines.get(key) || [];
		const currentLastLine = getHunkEndLine(hunkIndex);

		// Don't expand past the next hunk's start
		let maxLine = Infinity;
		if (hunkIndex < file.hunks.length - 1) {
			maxLine = getHunkStartLine(hunkIndex + 1) - 1;
		}

		const startLine = currentLastLine + 1;
		const endLine = Math.min(startLine + EXPAND_COUNT - 1, maxLine);
		if (startLine > endLine) return;

		const res = await fetch(`/api/context?file=${encodeURIComponent(file.path)}&start=${startLine}&end=${endLine}`);
		const data = await res.json();
		if (data.lines && data.lines.length > 0) {
			const newMap = new Map(expandedLines);
			newMap.set(key, [...existing, ...data.lines]);
			expandedLines = newMap;
		}
	}

	function getExpandedBefore(hunkIndex: number): DiffLine[] {
		return expandedLines.get(`before-${hunkIndex}`) || [];
	}

	function getExpandedAfter(hunkIndex: number): DiffLine[] {
		return expandedLines.get(`after-${hunkIndex}`) || [];
	}

	function canExpandBefore(hunkIndex: number): boolean {
		const currentStart = getHunkStartLine(hunkIndex);
		let minLine = 1;
		if (hunkIndex > 0) {
			minLine = getHunkEndLine(hunkIndex - 1) + 1;
		}
		return currentStart > minLine;
	}

	function canExpandAfter(hunkIndex: number): boolean {
		const currentEnd = getHunkEndLine(hunkIndex);
		if (hunkIndex < file.hunks.length - 1) {
			const nextStart = getHunkStartLine(hunkIndex + 1);
			return currentEnd < nextStart - 1;
		}
		return true; // last hunk — can always try
	}

	// Hide the hunk header when the previous hunk's expanded area
	// reaches right up to this hunk (no gap left)
	function shouldShowHeader(hunkIndex: number): boolean {
		if (hunkIndex === 0) return true; // always show first header
		return canExpandBefore(hunkIndex);
	}
</script>

<div class="diff-view font-mono text-sm">
	{#each file.hunks as hunk, hunkIndex}
		{@const beforeLines = getExpandedBefore(hunkIndex)}
		{@const afterLines = getExpandedAfter(hunkIndex)}

		<!-- Hunk header — hidden when merged with previous hunk -->
		{#if shouldShowHeader(hunkIndex)}
			<div class="bg-panel text-muted text-xs border-y border-border select-none flex items-center">
				{#if canExpandBefore(hunkIndex)}
					<button
						class="text-accent-blue hover:opacity-75 hover:bg-hover transition-colors px-3 py-1"
						onclick={() => expandBefore(hunkIndex)}
						title="Show {EXPAND_COUNT} more lines above"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
						</svg>
					</button>
				{/if}
				<span class="flex-1 px-2 py-1">{hunk.header}</span>
			</div>
		{/if}

		{#if $viewMode === 'unified'}
			<!-- Expanded lines before hunk -->
			{#each beforeLines as line}
				{@const lineNum = line.newNumber || line.oldNumber || 0}
				<div class="diff-line group flex hover:bg-hover/20 relative">
					<button class="absolute left-0 top-0 w-5 h-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-accent-blue z-10 transition-opacity" onclick={() => startComment(lineNum, 'new', line.content)} title="Add comment">+</button>
					<span class="w-12 shrink-0 text-right pr-2 text-faint select-none text-xs leading-6 pl-5">{line.oldNumber ?? ''}</span>
					<span class="w-12 shrink-0 text-right pr-2 text-faint select-none text-xs leading-6 border-r border-border">{line.newNumber ?? ''}</span>
					<span class="w-6 shrink-0 text-center select-none leading-6"> </span>
					<span class="flex-1 whitespace-pre-wrap break-all leading-6 pr-4">{#if line.html}{@html line.html}{:else}{line.content || ' '}{/if}</span>
				</div>
			{/each}

			<!-- Actual hunk lines -->
			{#each hunk.lines as line}
				{@const lineNum = getLineKey(line)}
				{@const side = getLineSide(line)}
				{@const lineThreads = getThreadsForLine(lineNum, side)}
				<div class="diff-line group flex hover:bg-hover/20 relative {lineBg(line.type)}">
					<button class="absolute left-0 top-0 w-5 h-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-accent-blue z-10 transition-opacity" onclick={() => startComment(lineNum, side, line.content)} title="Add comment">+</button>
					<span class="w-12 shrink-0 text-right pr-2 text-faint select-none text-xs leading-6 pl-5">{line.oldNumber ?? ''}</span>
					<span class="w-12 shrink-0 text-right pr-2 text-faint select-none text-xs leading-6 border-r border-border">{line.newNumber ?? ''}</span>
					<span class="w-6 shrink-0 text-center select-none leading-6 {line.type === 'add' ? 'text-accent-green' : line.type === 'del' ? 'text-accent-red' : ''}">{line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}</span>
					<span class="flex-1 whitespace-pre-wrap break-all leading-6 pr-4">{#if line.html}{@html line.html}{:else}{line.content || ' '}{/if}</span>
				</div>
				{#each lineThreads as thread}<CommentThread {thread} />{/each}
				{#if isCommenting(lineNum, side)}<CommentEditor filePath={file.path} lineNumber={lineNum} {side} originalLineContent={$commentingLine?.originalLineContent} />{/if}
			{/each}

			<!-- Expanded lines after hunk -->
			{#each afterLines as line}
				{@const lineNum = line.newNumber || line.oldNumber || 0}
				<div class="diff-line group flex hover:bg-hover/20 relative">
					<button class="absolute left-0 top-0 w-5 h-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-accent-blue z-10 transition-opacity" onclick={() => startComment(lineNum, 'new', line.content)} title="Add comment">+</button>
					<span class="w-12 shrink-0 text-right pr-2 text-faint select-none text-xs leading-6 pl-5">{line.oldNumber ?? ''}</span>
					<span class="w-12 shrink-0 text-right pr-2 text-faint select-none text-xs leading-6 border-r border-border">{line.newNumber ?? ''}</span>
					<span class="w-6 shrink-0 text-center select-none leading-6"> </span>
					<span class="flex-1 whitespace-pre-wrap break-all leading-6 pr-4">{#if line.html}{@html line.html}{:else}{line.content || ' '}{/if}</span>
				</div>
			{/each}

			<!-- Expand down button below hunk content -->
			{#if canExpandAfter(hunkIndex)}
				<div class="flex items-center border-b border-border/50 bg-panel/30 hover:bg-panel/60 transition-colors">
					<button
						class="text-accent-blue hover:opacity-75 transition-colors px-3 py-0.5 flex items-center gap-2 text-xs"
						onclick={() => expandAfter(hunkIndex)}
						title="Show {EXPAND_COUNT} more lines below"
					>
						<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
						Expand
					</button>
				</div>
			{/if}
		{:else}
			<!-- SPLIT VIEW -->
			<!-- Expanded before -->
			{#each beforeLines as line}
				<div class="flex">
					<div class="w-1/2 border-r border-border">
						<div class="diff-line flex leading-6">
							<span class="w-12 shrink-0 text-right pr-2 text-faint select-none text-xs leading-6 pl-5">{line.oldNumber ?? ''}</span>
							<span class="w-6 shrink-0 text-center select-none leading-6"> </span>
							<span class="flex-1 whitespace-pre-wrap break-all leading-6 pr-2">{#if line.html}{@html line.html}{:else}{line.content || ' '}{/if}</span>
						</div>
					</div>
					<div class="w-1/2">
						<div class="diff-line flex leading-6">
							<span class="w-12 shrink-0 text-right pr-2 text-faint select-none text-xs leading-6 pl-5">{line.newNumber ?? ''}</span>
							<span class="w-6 shrink-0 text-center select-none leading-6"> </span>
							<span class="flex-1 whitespace-pre-wrap break-all leading-6 pr-2">{#if line.html}{@html line.html}{:else}{line.content || ' '}{/if}</span>
						</div>
					</div>
				</div>
			{/each}

			<!-- Split hunk lines -->
			{@const pairs = buildSplitPairs(hunk.lines)}
			{#each pairs as pair}
				{@const oldThreads = pair.old ? getThreadsForLine(pair.old.oldNumber!, 'old') : []}
				{@const newThreads = pair.new ? getThreadsForLine(pair.new.newNumber!, 'new') : []}
				<div class="flex">
					<div class="w-1/2 border-r border-border">
						{#if pair.old}
							<div class="diff-line group flex hover:bg-hover/20 relative {pair.old.type === 'del' ? 'bg-diff-del' : ''}">
								<button class="absolute left-0 top-0 w-5 h-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-accent-blue z-10 transition-opacity" onclick={() => startComment(pair.old!.oldNumber!, 'old', pair.old!.content)} title="Add comment">+</button>
								<span class="w-12 shrink-0 text-right pr-2 text-faint select-none text-xs leading-6 pl-5">{pair.old.oldNumber ?? ''}</span>
								<span class="w-6 shrink-0 text-center select-none leading-6 {pair.old.type === 'del' ? 'text-accent-red' : ''}">{pair.old.type === 'del' ? '-' : ' '}</span>
								<span class="flex-1 whitespace-pre-wrap break-all leading-6 pr-2">{#if pair.old.html}{@html pair.old.html}{:else}{pair.old.content || ' '}{/if}</span>
							</div>
						{:else}<div class="diff-line flex bg-panel/20 leading-6">&nbsp;</div>{/if}
					</div>
					<div class="w-1/2">
						{#if pair.new}
							<div class="diff-line group flex hover:bg-hover/20 relative {pair.new.type === 'add' ? 'bg-diff-add' : ''}">
								<button class="absolute left-0 top-0 w-5 h-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-accent-blue z-10 transition-opacity" onclick={() => startComment(pair.new!.newNumber!, 'new', pair.new!.content)} title="Add comment">+</button>
								<span class="w-12 shrink-0 text-right pr-2 text-faint select-none text-xs leading-6 pl-5">{pair.new.newNumber ?? ''}</span>
								<span class="w-6 shrink-0 text-center select-none leading-6 {pair.new.type === 'add' ? 'text-accent-green' : ''}">{pair.new.type === 'add' ? '+' : ' '}</span>
								<span class="flex-1 whitespace-pre-wrap break-all leading-6 pr-2">{#if pair.new.html}{@html pair.new.html}{:else}{pair.new.content || ' '}{/if}</span>
							</div>
						{:else}<div class="diff-line flex bg-panel/20 leading-6">&nbsp;</div>{/if}
					</div>
				</div>
				{#if oldThreads.length > 0 || newThreads.length > 0}
					<div class="flex">
						<div class="w-1/2 border-r border-border">
							{#each oldThreads as thread}<CommentThread {thread} />{/each}
							{#if pair.old && isCommenting(pair.old.oldNumber!, 'old')}<CommentEditor filePath={file.path} lineNumber={pair.old.oldNumber!} side="old" originalLineContent={$commentingLine?.originalLineContent} />{/if}
						</div>
						<div class="w-1/2">
							{#each newThreads as thread}<CommentThread {thread} />{/each}
							{#if pair.new && isCommenting(pair.new.newNumber!, 'new')}<CommentEditor filePath={file.path} lineNumber={pair.new.newNumber!} side="new" originalLineContent={$commentingLine?.originalLineContent} />{/if}
						</div>
					</div>
				{/if}
			{/each}

			<!-- Expanded after -->
			{#each afterLines as line}
				<div class="flex">
					<div class="w-1/2 border-r border-border">
						<div class="diff-line flex leading-6">
							<span class="w-12 shrink-0 text-right pr-2 text-faint select-none text-xs leading-6 pl-5">{line.oldNumber ?? ''}</span>
							<span class="w-6 shrink-0 text-center select-none leading-6"> </span>
							<span class="flex-1 whitespace-pre-wrap break-all leading-6 pr-2">{#if line.html}{@html line.html}{:else}{line.content || ' '}{/if}</span>
						</div>
					</div>
					<div class="w-1/2">
						<div class="diff-line flex leading-6">
							<span class="w-12 shrink-0 text-right pr-2 text-faint select-none text-xs leading-6 pl-5">{line.newNumber ?? ''}</span>
							<span class="w-6 shrink-0 text-center select-none leading-6"> </span>
							<span class="flex-1 whitespace-pre-wrap break-all leading-6 pr-2">{#if line.html}{@html line.html}{:else}{line.content || ' '}{/if}</span>
						</div>
					</div>
				</div>
			{/each}

			{#if canExpandAfter(hunkIndex)}
				<div class="flex items-center border-b border-border/50 bg-panel/30 hover:bg-panel/60 transition-colors">
					<button
						class="text-accent-blue hover:opacity-75 transition-colors px-3 py-0.5 flex items-center gap-2 text-xs"
						onclick={() => expandAfter(hunkIndex)}
						title="Show {EXPAND_COUNT} more lines below"
					>
						<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
						Expand
					</button>
				</div>
			{/if}
		{/if}
	{/each}
</div>

<script lang="ts" module>
	import type { DiffLine as DL } from '$lib/types/index.ts';

	interface SplitPair {
		old: DL | null;
		new: DL | null;
	}

	function buildSplitPairs(lines: DL[]): SplitPair[] {
		const pairs: SplitPair[] = [];
		const dels: DL[] = [];
		const adds: DL[] = [];

		function flushPending() {
			const max = Math.max(dels.length, adds.length);
			for (let i = 0; i < max; i++) {
				pairs.push({
					old: dels[i] || null,
					new: adds[i] || null
				});
			}
			dels.length = 0;
			adds.length = 0;
		}

		for (const line of lines) {
			if (line.type === 'context') {
				flushPending();
				pairs.push({ old: line, new: line });
			} else if (line.type === 'del') {
				dels.push(line);
			} else if (line.type === 'add') {
				adds.push(line);
			}
		}
		flushPending();
		return pairs;
	}
</script>
