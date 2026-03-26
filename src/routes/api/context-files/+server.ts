import { json } from '@sveltejs/kit';
import { addContextFile, removeContextFile, getContextFiles } from '$lib/server/review-store.ts';
import type { RequestHandler } from './$types.ts';

export const GET: RequestHandler = async () => {
	return json({ files: getContextFiles() });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { path, action } = body;

	if (!path) {
		return json({ error: 'Missing path' }, { status: 400 });
	}

	if (action === 'remove') {
		removeContextFile(path);
	} else {
		addContextFile(path);
	}

	return json({ files: getContextFiles() });
};
