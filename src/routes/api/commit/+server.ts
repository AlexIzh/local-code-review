import { json } from '@sveltejs/kit';
import { commitStaged, commitAll } from '$lib/server/git.ts';
import { clearAll } from '$lib/server/review-store.ts';
import type { RequestHandler } from './$types.ts';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { message, mode } = body;

		if (!message?.trim()) {
			return json({ error: 'Commit message is required' }, { status: 400 });
		}

		let hash: string;
		if (mode === 'approved') {
			// Commit only staged (approved) files
			hash = await commitStaged(message.trim());
		} else {
			// Commit all changes
			hash = await commitAll(message.trim());
		}

		clearAll();
		return json({ success: true, hash });
	} catch (err) {
		return json({ error: String(err) }, { status: 500 });
	}
};
