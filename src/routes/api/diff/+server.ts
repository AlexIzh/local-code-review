import { json } from '@sveltejs/kit';
import { getDiffByMode, parseDiff, getFileContent, getBaseBranchInfo } from '$lib/server/git.ts';
import type { DiffMode } from '$lib/server/git.ts';
import type { DiffFile, DiffScope } from '$lib/types/index.ts';
import { highlightLines } from '$lib/server/highlighter.ts';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getRepoDir } from '$lib/server/git.ts';
import type { RequestHandler } from './$types.ts';

async function applyHighlighting(files: DiffFile[], oldRef: string = 'HEAD'): Promise<void> {
	for (const file of files) {
		// Get the full new file content for accurate highlighting
		let newContent = '';
		let oldContent = '';

		try {
			// Try reading the working tree version (new content)
			newContent = await readFile(join(getRepoDir(), file.path), 'utf-8');
		} catch {
			// File might be deleted
		}

		try {
			// Get the old version (HEAD or merge-base for worktree scope)
			oldContent = await getFileContent(file.path, oldRef);
		} catch {
			// File might be new
		}

		// Highlight both versions
		const [newHighlighted, oldHighlighted] = await Promise.all([
			newContent ? highlightLines(newContent, file.language) : Promise.resolve(new Map<number, string>()),
			oldContent ? highlightLines(oldContent, file.language) : Promise.resolve(new Map<number, string>())
		]);

		// Apply highlighted HTML to diff lines
		for (const hunk of file.hunks) {
			for (const line of hunk.lines) {
				if (line.type === 'add' && line.newNumber !== undefined) {
					line.html = newHighlighted.get(line.newNumber);
				} else if (line.type === 'del' && line.oldNumber !== undefined) {
					line.html = oldHighlighted.get(line.oldNumber);
				} else if (line.type === 'context' && line.newNumber !== undefined) {
					line.html = newHighlighted.get(line.newNumber);
				}
			}
		}
	}
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const filePath = url.searchParams.get('file') || undefined;
		const mode = (url.searchParams.get('mode') || 'full') as DiffMode;
		const scope = (url.searchParams.get('scope') || 'uncommitted') as DiffScope;
		const raw = await getDiffByMode(mode, filePath, scope);
		const parsed = parseDiff(raw);

		// Determine the old ref for syntax highlighting
		let oldRef = 'HEAD';
		if (scope === 'worktree') {
			const { mergeBase } = await getBaseBranchInfo();
			if (mergeBase) oldRef = mergeBase;
		}

		// Apply syntax highlighting
		await applyHighlighting(parsed, oldRef);

		return json({ files: parsed, raw });
	} catch (err) {
		return json({ error: String(err) }, { status: 500 });
	}
};
