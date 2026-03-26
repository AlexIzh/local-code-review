import { writable, derived } from 'svelte/store';
import type { FileChange, DiffFile, DiffScope } from '$lib/types/index.ts';
import { checkOutdated } from './review.ts';

export type DiffMode = 'full' | 'unstaged';

export const files = writable<FileChange[]>([]);
export const uncommittedFiles = writable<FileChange[]>([]);
export const selectedFile = writable<string | null>(null);
export const diffFiles = writable<DiffFile[]>([]);
export const loading = writable(false);
export const diffMode = writable<DiffMode>('full');
export const diffScope = writable<DiffScope>('uncommitted');
export const baseBranch = writable<string | null>(null);

export const selectedDiff = derived([diffFiles, selectedFile], ([$diffFiles, $selectedFile]) => {
	if (!$selectedFile) return null;
	return $diffFiles.find((f) => f.path === $selectedFile) || null;
});

export const fileCommentCounts = writable<Record<string, number>>({});
export const contextFiles = writable<string[]>([]);

export async function loadContextFiles() {
	const res = await fetch('/api/context-files');
	const data = await res.json();
	if (data.files) contextFiles.set(data.files);
}

export async function toggleContextFile(path: string) {
	let current: string[] = [];
	contextFiles.subscribe((v) => (current = v))();
	const isContext = current.includes(path);
	const res = await fetch('/api/context-files', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path, action: isContext ? 'remove' : 'add' })
	});
	const data = await res.json();
	if (data.files) contextFiles.set(data.files);
}

export const approvedCount = derived(files, ($files) => {
	const approved = $files.filter((f) => f.approved).length;
	return { approved, total: $files.length };
});

export const uncommittedCount = derived(uncommittedFiles, ($uncommittedFiles) => {
	const approved = $uncommittedFiles.filter((f) => f.approved).length;
	return { approved, total: $uncommittedFiles.length };
});

export const diffStats = derived(files, ($files) => {
	let additions = 0;
	let deletions = 0;
	let unapprovedAdditions = 0;
	let unapprovedDeletions = 0;
	for (const f of $files) {
		additions += f.additions;
		deletions += f.deletions;
		if (!f.approved) {
			unapprovedAdditions += f.additions;
			unapprovedDeletions += f.deletions;
		}
	}
	return { additions, deletions, unapprovedAdditions, unapprovedDeletions };
});

export const selectedFileData = derived([files, selectedFile], ([$files, $selectedFile]) => {
	if (!$selectedFile) return null;
	return $files.find((f) => f.path === $selectedFile) || null;
});

function getStoreValue<T>(store: { subscribe: (fn: (v: T) => void) => () => void }): T {
	let value: T;
	store.subscribe((v) => (value = v))();
	return value!;
}

export async function loadFiles() {
	loading.set(true);
	try {
		const scope = getStoreValue(diffScope);

		if (scope === 'worktree') {
			const res = await fetch('/api/files?scope=worktree');
			const data = await res.json();
			files.set(data.files);
			baseBranch.set(data.baseBranch);
		} else {
			const res = await fetch('/api/files');
			const data = await res.json();
			const fileList = Array.isArray(data) ? data : data.files || [];
			files.set(fileList);
			uncommittedFiles.set(fileList);
			baseBranch.set(null);
		}

		// Auto-select first file
		const fileList = getStoreValue(files);
		if (fileList.length > 0) {
			const current = getStoreValue(selectedFile);
			if (!current || !fileList.find((f) => f.path === current)) {
				selectedFile.set(fileList[0].path);
			}
		} else {
			selectedFile.set(null);
		}
	} finally {
		loading.set(false);
	}
}

export async function loadUncommittedFiles() {
	const res = await fetch('/api/files');
	const data = await res.json();
	uncommittedFiles.set(Array.isArray(data) ? data : []);
}

export async function loadAllDiffs(mode?: DiffMode) {
	const currentMode = mode || getStoreValue(diffMode);
	const currentScope = getStoreValue(diffScope);
	const res = await fetch(`/api/diff?mode=${currentMode}&scope=${currentScope}`);
	const data = await res.json();
	if (data.files) {
		diffFiles.set(data.files);
	}
	// Check if any comment threads are outdated after refreshing diff
	checkOutdated().catch(() => {});
}

export async function setDiffScope(scope: DiffScope) {
	diffScope.set(scope);
	// Reset to full diff mode when switching scope
	diffMode.set('full');
	await loadFiles();
	await loadAllDiffs('full');
}

export async function approveFile(path: string) {
	const scope = getStoreValue(diffScope);
	await fetch('/api/files', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path, action: 'approve', scope })
	});
	await loadFiles();
	await loadAllDiffs();
}

export async function unapproveFile(path: string) {
	const scope = getStoreValue(diffScope);
	await fetch('/api/files', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path, action: 'unapprove', scope })
	});
	await loadFiles();
	await loadAllDiffs();
}

export async function resetFile(path: string) {
	await fetch('/api/files', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path, action: 'reset' })
	});
	await loadFiles();
	await loadAllDiffs();
	// If the reset file was selected and is now gone, select another
	if (getStoreValue(selectedFile) === path) {
		const remaining = getStoreValue(files);
		selectedFile.set(remaining.length > 0 ? remaining[0].path : null);
	}
}

export async function resetHunk(path: string, hunkHeader: string) {
	await fetch('/api/files', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path, action: 'reset-hunk', hunkHeader })
	});
	await loadFiles();
	await loadAllDiffs();
}

export async function toggleApproval(path: string) {
	const file = getStoreValue(files).find((f) => f.path === path);
	if (file?.approved) {
		await unapproveFile(path);
	} else {
		await approveFile(path);
	}
}
