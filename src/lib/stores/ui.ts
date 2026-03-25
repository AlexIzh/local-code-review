import { writable } from 'svelte/store';

export type ViewMode = 'unified' | 'split';

export const viewMode = writable<ViewMode>('unified');
export const sidebarOpen = writable(true);
export const showCommitDialog = writable(false);
export const showExportDialog = writable(false);
export const commentingLine = writable<{
	filePath: string;
	lineNumber: number;
	side: 'old' | 'new';
	originalLineContent?: string;
} | null>(null);
