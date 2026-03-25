import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki';

let highlighter: Highlighter | null = null;

async function getHighlighter(): Promise<Highlighter> {
	if (!highlighter) {
		highlighter = await createHighlighter({
			themes: ['github-dark'],
			langs: [] // Start empty, load on demand
		});
	}
	return highlighter;
}

/**
 * Highlight a full file and return a map of line number → HTML string.
 * Line numbers are 1-indexed.
 */
export async function highlightLines(
	code: string,
	language: string
): Promise<Map<number, string>> {
	const lineMap = new Map<number, string>();

	if (language === 'text' || !code.trim()) {
		return lineMap;
	}

	try {
		const hl = await getHighlighter();

		// Load language on demand if not already loaded
		const loadedLangs = hl.getLoadedLanguages();
		if (!loadedLangs.includes(language as BundledLanguage)) {
			try {
				await hl.loadLanguage(language as BundledLanguage);
			} catch {
				// Language not supported by Shiki — return unhighlighted
				return lineMap;
			}
		}

		const result = hl.codeToTokens(code, {
			lang: language as BundledLanguage,
			theme: 'github-dark'
		});

		for (let i = 0; i < result.tokens.length; i++) {
			const lineTokens = result.tokens[i];
			let html = '';
			for (const token of lineTokens) {
				const escaped = escapeHtml(token.content);
				if (token.color) {
					html += `<span style="color:${token.color}">${escaped}</span>`;
				} else {
					html += escaped;
				}
			}
			lineMap.set(i + 1, html);
		}
	} catch {
		// Fallback: no highlighting
	}

	return lineMap;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
