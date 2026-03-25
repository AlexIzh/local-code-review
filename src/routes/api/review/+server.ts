import { json } from '@sveltejs/kit';
import { getReview, setReviewStatus, setReviewSummary } from '$lib/server/review-store.ts';
import type { RequestHandler } from './$types.ts';

export const GET: RequestHandler = async () => {
	return json(getReview());
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { status, summary } = body;

	if (status) {
		setReviewStatus(status);
	}
	if (summary !== undefined) {
		setReviewSummary(summary);
	}

	return json(getReview());
};
