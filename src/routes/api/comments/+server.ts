import { json } from '@sveltejs/kit';
import {
	addComment,
	getThreads,
	resolveThread,
	deleteComment,
	deleteThread,
	getStats,
	markOutdated
} from '$lib/server/review-store.ts';
import { getRepoDir } from '$lib/server/git.ts';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { RequestHandler } from './$types.ts';

export const GET: RequestHandler = async ({ url }) => {
	const filePath = url.searchParams.get('file') || undefined;
	const threads = getThreads(filePath);
	const stats = getStats();
	return json({ threads, stats });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { filePath, lineNumber, side, text, type, threadId, originalLineContent } = body;

	if (!filePath || lineNumber === undefined || !text) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	const thread = addComment(filePath, lineNumber, side || 'new', text, type || 'comment', threadId, originalLineContent);
	return json(thread);
};

export const PATCH: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { threadId, action } = body;

	if (action === 'resolve' && threadId) {
		resolveThread(threadId);
		return json({ success: true });
	}

	if (action === 'check-outdated') {
		const threads = getThreads();
		const repoDir = getRepoDir();
		const fileCache = new Map<string, string[]>();
		let outdatedCount = 0;

		for (const thread of threads) {
			if (!thread.originalLineContent || thread.resolved) continue;

			// Read file content (cached)
			let lines = fileCache.get(thread.filePath);
			if (!lines) {
				try {
					const content = await readFile(join(repoDir, thread.filePath), 'utf-8');
					lines = content.split('\n');
					fileCache.set(thread.filePath, lines);
				} catch {
					continue;
				}
			}

			// Check if the line content still matches
			const lineIdx = thread.lineNumber - 1;
			if (lineIdx >= 0 && lineIdx < lines.length) {
				const currentContent = lines[lineIdx].trim();
				const originalContent = thread.originalLineContent.trim();
				const isOutdated = currentContent !== originalContent;
				if (isOutdated !== thread.outdated) {
					markOutdated(thread.id, isOutdated);
					if (isOutdated) outdatedCount++;
				}
			} else {
				// Line no longer exists — outdated
				if (!thread.outdated) {
					markOutdated(thread.id, true);
					outdatedCount++;
				}
			}
		}

		return json({ success: true, outdatedCount, threads: getThreads() });
	}

	return json({ error: 'Unknown action' }, { status: 400 });
};

export const DELETE: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { commentId, threadId } = body;

	if (threadId) {
		deleteThread(threadId);
		return json({ success: true });
	}

	if (commentId) {
		deleteComment(commentId);
		return json({ success: true });
	}

	return json({ error: 'Missing commentId or threadId' }, { status: 400 });
};
