import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki';

let highlighter: Highlighter | null = null;

async function getHighlighter(): Promise<Highlighter> {
	if (!highlighter) {
		highlighter = await createHighlighter({
			themes: ['github-dark', 'github-light'],
			langs: [] // Start empty, load on demand
		});
	}
	return highlighter;
}

/**
 * Highlight a full file and return a map of line number → HTML string.
 * Line numbers are 1-indexed.
 * Output uses CSS custom properties for dual-theme support:
 *   <span class="st" style="--sd:#dark;--sl:#light">text</span>
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

		const darkResult = hl.codeToTokens(code, {
			lang: language as BundledLanguage,
			theme: 'github-dark'
		});

		const lightResult = hl.codeToTokens(code, {
			lang: language as BundledLanguage,
			theme: 'github-light'
		});

		for (let i = 0; i < darkResult.tokens.length; i++) {
			const darkTokens = darkResult.tokens[i];
			const lightTokens = lightResult.tokens[i];
			let html = '';

			if (lightTokens && darkTokens.length === lightTokens.length) {
				// Both themes have matching tokens — use dual-theme spans
				for (let j = 0; j < darkTokens.length; j++) {
					const escaped = escapeHtml(darkTokens[j].content);
					const dc = darkTokens[j].color;
					const lc = lightTokens[j].color;
					if (dc || lc) {
						html += `<span class="st" style="--sd:${dc || 'inherit'};--sl:${lc || 'inherit'}">${escaped}</span>`;
					} else {
						html += escaped;
					}
				}
			} else {
				// Fallback: dark-only tokens (shouldn't normally happen)
				for (const token of darkTokens) {
					const escaped = escapeHtml(token.content);
					if (token.color) {
						html += `<span class="st" style="--sd:${token.color};--sl:${token.color}">${escaped}</span>`;
					} else {
						html += escaped;
					}
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
