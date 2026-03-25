import { writable, derived } from 'svelte/store';
import type { ReviewThread, Review } from '$lib/types/index.ts';
import { fileCommentCounts } from './files.ts';

export const threads = writable<ReviewThread[]>([]);
export const reviewStatus = writable<Review['status']>('pending');

export const threadsByFile = derived(threads, ($threads) => {
	const map = new Map<string, ReviewThread[]>();
	for (const t of $threads) {
		const existing = map.get(t.filePath) || [];
		existing.push(t);
		map.set(t.filePath, existing);
	}
	return map;
});

export const stats = derived(threads, ($threads) => {
	const files = new Set($threads.map((t) => t.filePath));
	return {
		totalThreads: $threads.length,
		totalComments: $threads.reduce((sum, t) => sum + t.comments.length, 0),
		filesWithComments: files.size,
		unresolvedThreads: $threads.filter((t) => !t.resolved).length
	};
});

export async function loadComments(filePath?: string) {
	const params = filePath ? `?file=${encodeURIComponent(filePath)}` : '';
	const res = await fetch(`/api/comments${params}`);
	const data = await res.json();
	if (data.threads) {
		if (filePath) {
			// Merge with existing threads for other files
			threads.update((existing) => {
				const otherFiles = existing.filter((t) => t.filePath !== filePath);
				return [...otherFiles, ...data.threads];
			});
		} else {
			threads.set(data.threads);
		}
	}
	// Update comment counts
	updateCommentCounts();
}

function updateCommentCounts() {
	threads.subscribe(($threads) => {
		const counts: Record<string, number> = {};
		for (const t of $threads) {
			counts[t.filePath] = (counts[t.filePath] || 0) + 1;
		}
		fileCommentCounts.set(counts);
	})();
}

export async function addComment(
	filePath: string,
	lineNumber: number,
	side: 'old' | 'new',
	text: string,
	type: 'comment' | 'suggestion' | 'question' = 'comment',
	threadId?: string,
	originalLineContent?: string
) {
	const res = await fetch('/api/comments', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ filePath, lineNumber, side, text, type, threadId, originalLineContent })
	});
	const thread = await res.json();
	if (thread.id) {
		threads.update((existing) => {
			const idx = existing.findIndex((t) => t.id === thread.id);
			if (idx >= 0) {
				existing[idx] = thread;
				return [...existing];
			}
			return [...existing, thread];
		});
		updateCommentCounts();
	}
	return thread;
}

export async function resolveThread(threadId: string) {
	await fetch('/api/comments', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ threadId, action: 'resolve' })
	});
	threads.update((existing) => {
		const thread = existing.find((t) => t.id === threadId);
		if (thread) thread.resolved = !thread.resolved;
		return [...existing];
	});
}

export async function deleteThread(threadId: string) {
	await fetch('/api/comments', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ threadId })
	});
	threads.update((existing) => existing.filter((t) => t.id !== threadId));
	updateCommentCounts();
}

export async function checkOutdated() {
	const res = await fetch('/api/comments', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'check-outdated' })
	});
	const data = await res.json();
	if (data.threads) {
		threads.set(data.threads);
		updateCommentCounts();
	}
	return data.outdatedCount || 0;
}

export async function submitReview(status: Review['status'], summary?: string) {
	const res = await fetch('/api/review', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ status, summary })
	});
	const review = await res.json();
	reviewStatus.set(review.status);
	return review;
}
