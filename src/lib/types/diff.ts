export interface FileChange {
	path: string;
	oldPath?: string;
	status: 'added' | 'modified' | 'deleted' | 'renamed';
	staged: boolean;
	approved: boolean;
	additions: number;
	deletions: number;
}

export interface DiffFile {
	path: string;
	oldPath?: string;
	hunks: DiffHunk[];
	language: string;
}

export interface DiffHunk {
	header: string;
	oldStart: number;
	oldLines: number;
	newStart: number;
	newLines: number;
	lines: DiffLine[];
}

export interface DiffLine {
	type: 'add' | 'del' | 'context';
	content: string;
	html?: string;
	oldNumber?: number;
	newNumber?: number;
}

export type DiffScope = 'uncommitted' | 'worktree';
