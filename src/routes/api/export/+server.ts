import { json } from '@sveltejs/kit';
import { exportJSON, exportMarkdown, exportToClaude, getExportPrompt } from '$lib/server/export.ts';
import type { RequestHandler } from './$types.ts';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { format } = body;

		switch (format) {
			case 'json': {
				const path = await exportJSON();
				return json({ success: true, path });
			}
			case 'markdown': {
				const path = await exportMarkdown();
				return json({ success: true, path });
			}
			case 'claude': {
				const result = await exportToClaude();
				return json(result);
			}
			case 'clipboard': {
				const text = getExportPrompt();
				return json({ success: true, text });
			}
			default:
				return json({ error: 'Unknown format' }, { status: 400 });
		}
	} catch (err) {
		return json({ error: String(err) }, { status: 500 });
	}
};
