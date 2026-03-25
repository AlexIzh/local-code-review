import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type ViewMode = 'unified' | 'split';
export type Theme = 'light' | 'dark';

export const viewMode = writable<ViewMode>('unified');

function createThemeStore() {
	const initial: Theme = browser
		? (localStorage.getItem('lcr-theme') as Theme) || 'dark'
		: 'dark';

	const { subscribe, set } = writable<Theme>(initial);

	return {
		subscribe,
		set(value: Theme) {
			if (browser) {
				localStorage.setItem('lcr-theme', value);
				document.documentElement.setAttribute('data-theme', value);
			}
			set(value);
		},
		toggle() {
			let current: Theme = 'dark';
			subscribe((v) => (current = v))();
			const next = current === 'dark' ? 'light' : 'dark';
			this.set(next);
		}
	};
}

export const theme = createThemeStore();
export const sidebarOpen = writable(true);
export const showCommitDialog = writable(false);
export const showExportDialog = writable(false);
export const commentingLine = writable<{
	filePath: string;
	lineNumber: number;
	side: 'old' | 'new';
	originalLineContent?: string;
} | null>(null);
