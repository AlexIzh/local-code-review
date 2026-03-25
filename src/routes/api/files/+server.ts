import { json } from '@sveltejs/kit';
import { getStatus, stageFile, unstageFile } from '$lib/server/git.ts';
import type { RequestHandler } from './$types.ts';

export const GET: RequestHandler = async () => {
	try {
		const files = await getStatus();
		return json(files);
	} catch (err) {
		return json({ error: String(err) }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { path, action } = body;

		if (!path || !action) {
			return json({ error: 'Missing path or action' }, { status: 400 });
		}

		if (action === 'approve') {
			await stageFile(path);
		} else if (action === 'unapprove') {
			await unstageFile(path);
		} else {
			return json({ error: 'Unknown action' }, { status: 400 });
		}

		// Return updated file list
		const files = await getStatus();
		return json(files);
	} catch (err) {
		return json({ error: String(err) }, { status: 500 });
	}
};
