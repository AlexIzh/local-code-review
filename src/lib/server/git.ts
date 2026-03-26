import simpleGit, { type SimpleGit } from 'simple-git';
import type { FileChange, DiffFile, DiffHunk, DiffLine, DiffScope } from '$lib/types/index.ts';
import { getWorktreeApprovals } from './review-store.ts';

let git: SimpleGit;

export function getGit(): SimpleGit {
	if (!git) {
		const repoDir = process.env.LCR_REPO_DIR || process.cwd();
		git = simpleGit(repoDir);
	}
	return git;
}

export function getRepoDir(): string {
	return process.env.LCR_REPO_DIR || process.cwd();
}

export async function getStatus(): Promise<FileChange[]> {
	const g = getGit();
	const status = await g.status();
	const files: FileChange[] = [];
	const seen = new Set<string>();

	// Helper to add a file only once
	function addFile(path: string, fileStatus: FileChange['status'], staged: boolean, oldPath?: string) {
		if (seen.has(path)) return;
		seen.add(path);
		files.push({ path, oldPath, status: fileStatus, staged, approved: staged, additions: 0, deletions: 0 });
	}

	// Staged new files
	for (const f of status.created) {
		addFile(f, 'added', true);
	}
	// Untracked files (not staged)
	for (const f of status.not_added) {
		addFile(f, 'added', false);
	}
	for (const f of status.modified) {
		addFile(f, 'modified', false);
	}
	for (const f of status.deleted) {
		addFile(f, 'deleted', false);
	}
	for (const f of status.renamed) {
		addFile(f.to, 'renamed', false, f.from);
	}
	// Mark staged files as both staged and approved
	for (const f of status.staged) {
		const existing = files.find((x) => x.path === f);
		if (existing) {
			existing.staged = true;
			existing.approved = true;
		}
	}

	// Get numstat for additions/deletions
	try {
		const hasCommits = await hasHead();
		if (hasCommits) {
			const diffStat = await g.diff(['HEAD', '--numstat']);
			for (const line of diffStat.split('\n')) {
				const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
				if (match) {
					const [, adds, dels, path] = match;
					const file = files.find((f) => f.path === path);
					if (file) {
						file.additions = adds === '-' ? 0 : parseInt(adds, 10);
						file.deletions = dels === '-' ? 0 : parseInt(dels, 10);
					}
				}
			}
		}
	} catch {
		// numstat may fail for initial commits
	}

	return files;
}

async function hasHead(): Promise<boolean> {
	const g = getGit();
	try {
		await g.revparse(['HEAD']);
		return true;
	} catch {
		return false;
	}
}

export async function getDiff(filePath?: string): Promise<string> {
	const g = getGit();
	const hasCommits = await hasHead();
	let result = '';

	if (hasCommits) {
		// Show all changes (staged + unstaged) relative to HEAD
		const args = ['HEAD'];
		if (filePath) args.push('--', filePath);
		try {
			result = await g.diff(args);
		} catch {
			result = '';
		}
	}

	// Also get untracked files as diffs
	const status = await g.status();
	const untrackedFiles = filePath
		? status.not_added.filter((f) => f === filePath)
		: status.not_added;

	for (const f of untrackedFiles) {
		try {
			const { readFile } = await import('fs/promises');
			const { join } = await import('path');
			const content = await readFile(join(getRepoDir(), f), 'utf-8');
			const lines = content.split('\n');
			// Build a synthetic diff for untracked files
			const header = `diff --git a/${f} b/${f}\nnew file mode 100644\n--- /dev/null\n+++ b/${f}\n@@ -0,0 +1,${lines.length} @@\n`;
			const body = lines.map((l) => '+' + l).join('\n');
			result += '\n' + header + body + '\n';
		} catch {
			// Skip files that can't be read (binary, etc.)
		}
	}

	// For repos with no commits, also get staged files
	if (!hasCommits) {
		const stagedFiles = filePath
			? status.created.filter((f) => f === filePath)
			: status.created;

		for (const f of stagedFiles) {
			try {
				const { readFile } = await import('fs/promises');
				const { join } = await import('path');
				const content = await readFile(join(getRepoDir(), f), 'utf-8');
				const lines = content.split('\n');
				const header = `diff --git a/${f} b/${f}\nnew file mode 100644\n--- /dev/null\n+++ b/${f}\n@@ -0,0 +1,${lines.length} @@\n`;
				const body = lines.map((l) => '+' + l).join('\n');
				result += '\n' + header + body + '\n';
			} catch {
				// Skip files that can't be read
			}
		}
	}

	return result;
}

export function parseDiff(raw: string): DiffFile[] {
	if (!raw.trim()) return [];

	const files: DiffFile[] = [];
	const fileChunks = raw.split(/^diff --git /m).filter(Boolean);

	for (const chunk of fileChunks) {
		const lines = chunk.split('\n');
		let path = '';
		let oldPath: string | undefined;

		// Parse file header
		const headerMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/);
		if (headerMatch) {
			oldPath = headerMatch[1];
			path = headerMatch[2];
			if (oldPath === path) oldPath = undefined;
		}

		const language = getLanguage(path);
		const hunks: DiffHunk[] = [];
		let currentHunk: DiffHunk | null = null;
		let oldLineNum = 0;
		let newLineNum = 0;

		for (const line of lines) {
			const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
			if (hunkMatch) {
				const oldStart = parseInt(hunkMatch[1], 10);
				const oldLines = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
				const newStart = parseInt(hunkMatch[3], 10);
				const newLines = hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1;
				currentHunk = {
					header: line,
					oldStart,
					oldLines,
					newStart,
					newLines,
					lines: []
				};
				hunks.push(currentHunk);
				oldLineNum = oldStart;
				newLineNum = newStart;
				continue;
			}

			if (!currentHunk) continue;

			if (line.startsWith('+')) {
				currentHunk.lines.push({
					type: 'add',
					content: line.substring(1),
					newNumber: newLineNum++
				});
			} else if (line.startsWith('-')) {
				currentHunk.lines.push({
					type: 'del',
					content: line.substring(1),
					oldNumber: oldLineNum++
				});
			} else if (line.startsWith(' ') || line === '') {
				// Only treat as context if we're inside a hunk and it looks like a context line
				if (line.startsWith(' ')) {
					currentHunk.lines.push({
						type: 'context',
						content: line.substring(1),
						oldNumber: oldLineNum++,
						newNumber: newLineNum++
					});
				}
			} else if (line.startsWith('\\')) {
				// "No newline at end of file" marker — skip
			}
		}

		if (path) {
			files.push({ path, oldPath, hunks, language });
		}
	}

	return files;
}

function getLanguage(filePath: string): string {
	const ext = filePath.split('.').pop()?.toLowerCase() || '';
	const map: Record<string, string> = {
		ts: 'typescript',
		tsx: 'tsx',
		js: 'javascript',
		jsx: 'jsx',
		py: 'python',
		rb: 'ruby',
		go: 'go',
		rs: 'rust',
		java: 'java',
		kt: 'kotlin',
		kts: 'kotlin',
		swift: 'swift',
		cs: 'csharp',
		fs: 'fsharp',
		php: 'php',
		r: 'r',
		lua: 'lua',
		dart: 'dart',
		scala: 'scala',
		groovy: 'groovy',
		pl: 'perl',
		pm: 'perl',
		ex: 'elixir',
		exs: 'elixir',
		erl: 'erlang',
		hs: 'haskell',
		clj: 'clojure',
		css: 'css',
		scss: 'scss',
		less: 'less',
		html: 'html',
		htm: 'html',
		xml: 'xml',
		svg: 'xml',
		svelte: 'svelte',
		vue: 'vue',
		json: 'json',
		jsonc: 'jsonc',
		yaml: 'yaml',
		yml: 'yaml',
		toml: 'toml',
		ini: 'ini',
		md: 'markdown',
		mdx: 'mdx',
		sh: 'bash',
		bash: 'bash',
		zsh: 'bash',
		fish: 'fish',
		ps1: 'powershell',
		sql: 'sql',
		graphql: 'graphql',
		gql: 'graphql',
		proto: 'proto',
		c: 'c',
		cpp: 'cpp',
		cc: 'cpp',
		cxx: 'cpp',
		h: 'c',
		hpp: 'cpp',
		m: 'objective-c',
		mm: 'objective-cpp',
		zig: 'zig',
		nim: 'nim',
		tf: 'hcl',
		dockerfile: 'dockerfile',
		makefile: 'makefile',
		cmake: 'cmake'
	};
	// Also check filename (no extension)
	const filename = filePath.split('/').pop()?.toLowerCase() || '';
	const filenameMap: Record<string, string> = {
		dockerfile: 'dockerfile',
		makefile: 'makefile',
		gemfile: 'ruby',
		rakefile: 'ruby',
		podfile: 'ruby'
	};
	return map[ext] || filenameMap[filename] || 'text';
}

export async function getFileContent(filePath: string, ref: string = 'HEAD'): Promise<string> {
	const g = getGit();
	try {
		return await g.show([`${ref}:${filePath}`]);
	} catch {
		return '';
	}
}

export async function stageFile(filePath: string): Promise<void> {
	const g = getGit();
	await g.add(filePath);
}

export async function unstageFile(filePath: string): Promise<void> {
	const g = getGit();
	const hasCommits = await hasHead();
	if (hasCommits) {
		await g.raw(['reset', 'HEAD', '--', filePath]);
	} else {
		await g.raw(['rm', '--cached', filePath]);
	}
}

export async function stageAll(): Promise<void> {
	const g = getGit();
	await g.add('-A');
}

export async function resetFile(filePath: string): Promise<void> {
	const g = getGit();
	const status = await g.status();

	// Check if it's an untracked/new file
	if (status.not_added.includes(filePath) || status.created.includes(filePath)) {
		// Remove the file
		const { unlink } = await import('fs/promises');
		const { join } = await import('path');
		await unlink(join(getRepoDir(), filePath));
		// If it was staged, also remove from index
		if (status.created.includes(filePath)) {
			await g.raw(['rm', '--cached', filePath]);
		}
	} else {
		// Modified or deleted file: restore to HEAD version
		await g.checkout(['HEAD', '--', filePath]);
	}
}

export async function resetHunk(filePath: string, hunkHeader: string): Promise<void> {
	const g = getGit();
	// Get the full diff for this file, then construct a reverse patch for just this hunk
	const diff = await g.diff(['HEAD', '--', filePath]);
	const hunks = diff.split(/(?=^@@)/m);
	const fileHeader = hunks[0] || '';

	// Find the matching hunk
	const targetHunk = hunks.find((h) => h.startsWith(hunkHeader));
	if (!targetHunk) return;

	// Build a patch with just this hunk and apply in reverse
	const patch = fileHeader + targetHunk;
	const { writeFile, unlink } = await import('fs/promises');
	const { join } = await import('path');
	const { tmpdir } = await import('os');
	const patchFile = join(tmpdir(), `lcr-patch-${Date.now()}.patch`);
	await writeFile(patchFile, patch);
	try {
		await g.raw(['apply', '--reverse', patchFile]);
	} finally {
		await unlink(patchFile).catch(() => {});
	}
}

export async function commitStaged(message: string): Promise<string> {
	const g = getGit();
	const result = await g.commit(message);
	return result.commit;
}

export async function commitAll(message: string): Promise<string> {
	const g = getGit();
	await g.add('-A');
	const result = await g.commit(message);
	return result.commit;
}

export async function commit(message: string): Promise<string> {
	const g = getGit();
	const result = await g.commit(message);
	return result.commit;
}

export type DiffMode = 'full' | 'unstaged';

export async function getDiffByMode(mode: DiffMode, filePath?: string, scope?: DiffScope): Promise<string> {
	if (mode === 'unstaged') {
		return getUnstagedDiff(filePath);
	}
	if (scope === 'worktree') {
		return getWorktreeDiff(filePath);
	}
	return getDiff(filePath);
}

async function getUnstagedDiff(filePath?: string): Promise<string> {
	const g = getGit();
	// git diff (no args) shows working tree vs index (unstaged changes only)
	const args: string[] = [];
	if (filePath) args.push('--', filePath);
	try {
		let result = await g.diff(args);

		// Also include untracked files (they are always "unstaged")
		const status = await g.status();
		const untrackedFiles = filePath
			? status.not_added.filter((f) => f === filePath)
			: status.not_added;

		for (const f of untrackedFiles) {
			try {
				const { readFile } = await import('fs/promises');
				const { join } = await import('path');
				const content = await readFile(join(getRepoDir(), f), 'utf-8');
				const lines = content.split('\n');
				const header = `diff --git a/${f} b/${f}\nnew file mode 100644\n--- /dev/null\n+++ b/${f}\n@@ -0,0 +1,${lines.length} @@\n`;
				const body = lines.map((l) => '+' + l).join('\n');
				result += '\n' + header + body + '\n';
			} catch {
				// Skip binary files
			}
		}

		return result;
	} catch {
		return '';
	}
}

// --- Worktree (branch) diff support ---

let cachedBaseBranchInfo: { baseBranch: string | null; mergeBase: string | null } | null = null;

export async function getBaseBranchInfo(): Promise<{ baseBranch: string | null; mergeBase: string | null }> {
	if (cachedBaseBranchInfo) return cachedBaseBranchInfo;

	const g = getGit();
	const currentBranch = (await g.revparse(['--abbrev-ref', 'HEAD'])).trim();

	// Detached HEAD — can't determine base branch
	if (currentBranch === 'HEAD') {
		cachedBaseBranchInfo = { baseBranch: null, mergeBase: null };
		return cachedBaseBranchInfo;
	}

	const candidates = ['main', 'master', 'development', 'develop'];
	let bestBranch: string | null = null;
	let bestMergeBase: string | null = null;
	let bestTimestamp = 0;

	for (const branch of candidates) {
		try {
			// Check if branch exists locally
			await g.raw(['rev-parse', '--verify', branch]);

			// Skip if we're on this branch
			if (branch === currentBranch) continue;

			const mergeBase = (await g.raw(['merge-base', 'HEAD', branch])).trim();
			// Get the timestamp of the merge-base to pick the most recent one
			const timestamp = parseInt(
				(await g.raw(['log', '-1', '--format=%ct', mergeBase])).trim(),
				10
			);

			if (timestamp > bestTimestamp) {
				bestTimestamp = timestamp;
				bestBranch = branch;
				bestMergeBase = mergeBase;
			}
		} catch {
			// Branch doesn't exist or merge-base failed — skip
		}
	}

	// Fallback: try upstream tracking branch
	if (!bestBranch) {
		try {
			const upstream = (await g.raw(['rev-parse', '--abbrev-ref', '@{upstream}'])).trim();
			// upstream is e.g. "origin/main" — extract the local branch name
			const localName = upstream.replace(/^[^/]+\//, '');
			if (localName !== currentBranch) {
				const mergeBase = (await g.raw(['merge-base', 'HEAD', upstream])).trim();
				bestBranch = localName;
				bestMergeBase = mergeBase;
			}
		} catch {
			// No upstream configured — skip
		}
	}

	cachedBaseBranchInfo = { baseBranch: bestBranch, mergeBase: bestMergeBase };
	return cachedBaseBranchInfo;
}

async function getWorktreeDiff(filePath?: string): Promise<string> {
	const g = getGit();
	const { mergeBase } = await getBaseBranchInfo();
	if (!mergeBase) return getDiff(filePath); // Fallback to regular diff

	const args = [mergeBase];
	if (filePath) args.push('--', filePath);
	let result = '';
	try {
		result = await g.diff(args);
	} catch {
		result = '';
	}

	// Also include untracked files (same as getDiff)
	const status = await g.status();
	const untrackedFiles = filePath
		? status.not_added.filter((f) => f === filePath)
		: status.not_added;

	for (const f of untrackedFiles) {
		try {
			const { readFile } = await import('fs/promises');
			const { join } = await import('path');
			const content = await readFile(join(getRepoDir(), f), 'utf-8');
			const lines = content.split('\n');
			const header = `diff --git a/${f} b/${f}\nnew file mode 100644\n--- /dev/null\n+++ b/${f}\n@@ -0,0 +1,${lines.length} @@\n`;
			const body = lines.map((l) => '+' + l).join('\n');
			result += '\n' + header + body + '\n';
		} catch {
			// Skip files that can't be read
		}
	}

	return result;
}

export async function getWorktreeStatus(): Promise<FileChange[]> {
	const g = getGit();
	const { mergeBase } = await getBaseBranchInfo();
	if (!mergeBase) return getStatus(); // Fallback

	// Run all independent git calls in parallel
	const [nameStatus, gitStatus, diffStat] = await Promise.all([
		g.diff(['--name-status', mergeBase]),
		g.status(),
		g.diff([mergeBase, '--numstat']).catch(() => '')
	]);

	const files: FileChange[] = [];
	const seen = new Set<string>();

	// Parse files changed between merge-base and working tree
	for (const line of nameStatus.split('\n')) {
		if (!line.trim()) continue;
		const match = line.match(/^([AMDRC])\d*\t(.+?)(?:\t(.+))?$/);
		if (!match) continue;
		const [, statusChar, filePath, newPath] = match;
		const path = newPath || filePath;
		if (seen.has(path)) continue;
		seen.add(path);

		let status: FileChange['status'] = 'modified';
		let oldPath: string | undefined;
		if (statusChar === 'A') status = 'added';
		else if (statusChar === 'D') status = 'deleted';
		else if (statusChar === 'R' || statusChar === 'C') {
			status = 'renamed';
			oldPath = filePath;
		}

		files.push({ path, oldPath, status, staged: false, approved: false, additions: 0, deletions: 0 });
	}

	// Include untracked files
	for (const f of gitStatus.not_added) {
		if (seen.has(f)) continue;
		seen.add(f);
		files.push({ path: f, status: 'added', staged: false, approved: false, additions: 0, deletions: 0 });
	}

	// Merge staging info from git status + worktree approvals
	const stagedSet = new Set([...gitStatus.created, ...gitStatus.staged]);
	const approvals = getWorktreeApprovals();
	for (const file of files) {
		if (stagedSet.has(file.path) || approvals.has(file.path)) {
			file.staged = true;
			file.approved = true;
		}
	}

	// Apply numstat additions/deletions
	for (const line of diffStat.split('\n')) {
		const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
		if (match) {
			const [, adds, dels, path] = match;
			const file = files.find((f) => f.path === path);
			if (file) {
				file.additions = adds === '-' ? 0 : parseInt(adds, 10);
				file.deletions = dels === '-' ? 0 : parseInt(dels, 10);
			}
		}
	}

	return files;
}

export async function getRepoInfo(): Promise<{ branch: string; repoName: string }> {
	const g = getGit();
	const branch = await g.revparse(['--abbrev-ref', 'HEAD']);
	const repoDir = getRepoDir();
	const repoName = repoDir.split('/').pop() || 'unknown';
	return { branch: branch.trim(), repoName };
}
