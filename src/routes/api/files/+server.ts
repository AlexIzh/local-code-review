import { json } from '@sveltejs/kit';
import { getStatus, getWorktreeStatus, getBaseBranchInfo, stageFile, unstageFile, resetFile, resetHunk, clearBaseBranchCache } from '$lib/server/git.ts';
import type { DiffScope } from '$lib/types/index.ts';
import type { RequestHandler } from './$types.ts';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const scope = (url.searchParams.get('scope') || 'uncommitted') as DiffScope;

		if (scope === 'worktree') {
			clearBaseBranchCache();
			const [files, branchInfo] = await Promise.all([
				getWorktreeStatus(),
				getBaseBranchInfo()
			]);
			return json({ files, baseBranch: branchInfo.baseBranch, mergeBase: branchInfo.mergeBase });
		}

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
		} else if (action === 'reset') {
			await resetFile(path);
		} else if (action === 'reset-hunk') {
			const { hunkHeader } = body;
			if (!hunkHeader) return json({ error: 'Missing hunkHeader' }, { status: 400 });
			await resetHunk(path, hunkHeader);
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
