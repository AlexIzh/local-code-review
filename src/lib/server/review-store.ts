import type { ReviewThread, ReviewComment, Review } from '$lib/types/index.ts';
import { randomUUID } from 'crypto';

const threads = new Map<string, ReviewThread>();
let reviewStatus: 'pending' | 'approved' | 'changes_requested' = 'pending';
let reviewSummary: string | undefined;
const contextFiles = new Set<string>();

export function addContextFile(filePath: string): void {
	contextFiles.add(filePath);
}

export function removeContextFile(filePath: string): void {
	contextFiles.delete(filePath);
}

export function getContextFiles(): string[] {
	return Array.from(contextFiles);
}

export function addComment(
	filePath: string,
	lineNumber: number,
	side: 'old' | 'new',
	body: string,
	type: 'comment' | 'suggestion' | 'question' = 'comment',
	threadId?: string,
	originalLineContent?: string
): ReviewThread {
	const comment: ReviewComment = {
		id: randomUUID(),
		filePath,
		lineNumber,
		side,
		body,
		type,
		createdAt: new Date().toISOString()
	};

	if (threadId && threads.has(threadId)) {
		const thread = threads.get(threadId)!;
		thread.comments.push(comment);
		return thread;
	}

	const thread: ReviewThread = {
		id: randomUUID(),
		filePath,
		lineNumber,
		side,
		comments: [comment],
		resolved: false,
		outdated: false,
		originalLineContent
	};
	threads.set(thread.id, thread);
	return thread;
}

export function getThreads(filePath?: string): ReviewThread[] {
	const all = Array.from(threads.values());
	if (filePath) return all.filter((t) => t.filePath === filePath);
	return all;
}

export function getThread(threadId: string): ReviewThread | undefined {
	return threads.get(threadId);
}

export function resolveThread(threadId: string): boolean {
	const thread = threads.get(threadId);
	if (!thread) return false;
	thread.resolved = !thread.resolved;
	return true;
}

export function deleteComment(commentId: string): boolean {
	for (const [threadId, thread] of threads) {
		const idx = thread.comments.findIndex((c) => c.id === commentId);
		if (idx !== -1) {
			thread.comments.splice(idx, 1);
			if (thread.comments.length === 0) {
				threads.delete(threadId);
			}
			return true;
		}
	}
	return false;
}

export function deleteThread(threadId: string): boolean {
	return threads.delete(threadId);
}

export function getReview(): Review {
	return {
		id: 'current',
		threads: Array.from(threads.values()),
		status: reviewStatus,
		createdAt: new Date().toISOString(),
		summary: reviewSummary
	};
}

export function setReviewStatus(status: 'pending' | 'approved' | 'changes_requested'): void {
	reviewStatus = status;
}

export function setReviewSummary(summary: string): void {
	reviewSummary = summary;
}

export function clearAll(): void {
	threads.clear();
	reviewStatus = 'pending';
	reviewSummary = undefined;
	contextFiles.clear();
}

export function markOutdated(threadId: string, outdated: boolean): boolean {
	const thread = threads.get(threadId);
	if (!thread) return false;
	thread.outdated = outdated;
	return true;
}

export function getStats(): { totalThreads: number; totalComments: number; filesWithComments: number } {
	const all = Array.from(threads.values());
	const files = new Set(all.map((t) => t.filePath));
	return {
		totalThreads: all.length,
		totalComments: all.reduce((sum, t) => sum + t.comments.length, 0),
		filesWithComments: files.size
	};
}
