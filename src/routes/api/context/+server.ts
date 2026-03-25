import { json } from '@sveltejs/kit';
import { getRepoDir } from '$lib/server/git.ts';
import { highlightLines } from '$lib/server/highlighter.ts';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { RequestHandler } from './$types.ts';

function getLanguage(filePath: string): string {
	const ext = filePath.split('.').pop()?.toLowerCase() || '';
	// Simplified — the full map is in git.ts but we just need the extension here
	const map: Record<string, string> = {
		ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
		py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
		swift: 'swift', kt: 'kotlin', cs: 'csharp', php: 'php',
		css: 'css', scss: 'scss', html: 'html', svelte: 'svelte', vue: 'vue',
		json: 'json', yaml: 'yaml', yml: 'yaml', md: 'markdown',
		sh: 'bash', sql: 'sql', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
		m: 'objective-c', dart: 'dart', lua: 'lua', r: 'r', scala: 'scala',
		ex: 'elixir', hs: 'haskell', toml: 'toml', xml: 'xml'
	};
	return map[ext] || 'text';
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const filePath = url.searchParams.get('file');
		const startLine = parseInt(url.searchParams.get('start') || '1', 10);
		const endLine = parseInt(url.searchParams.get('end') || '20', 10);

		if (!filePath) {
			return json({ error: 'file parameter required' }, { status: 400 });
		}

		const fullPath = join(getRepoDir(), filePath);
		const content = await readFile(fullPath, 'utf-8');
		const allLines = content.split('\n');
		const language = getLanguage(filePath);

		// Highlight the full file
		const highlighted = await highlightLines(content, language);

		// Extract requested range (1-indexed)
		const start = Math.max(1, startLine);
		const end = Math.min(allLines.length, endLine);
		const lines = [];

		for (let i = start; i <= end; i++) {
			lines.push({
				type: 'context' as const,
				content: allLines[i - 1],
				html: highlighted.get(i),
				oldNumber: i,
				newNumber: i
			});
		}

		return json({ lines, totalLines: allLines.length });
	} catch (err) {
		return json({ error: String(err) }, { status: 500 });
	}
};
