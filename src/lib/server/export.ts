import { writeFile } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';
import type { ReviewExport, ReviewExportFile, ReviewExportThread } from '$lib/types/index.ts';
import { readFile } from 'fs/promises';
import { getRepoDir, getRepoInfo, getStatus, getFileContent } from './git.ts';
import { getReview, getThreads, getContextFiles } from './review-store.ts';

export async function buildExport(): Promise<ReviewExport> {
	const { branch, repoName } = await getRepoInfo();
	const review = getReview();
	const changedFiles = await getStatus();

	const files: ReviewExportFile[] = [];

	for (const file of changedFiles) {
		const fileThreads = getThreads(file.path);
		if (fileThreads.length === 0) continue;

		let content = '';
		try {
			content = await getFileContent(file.path);
		} catch {
			// file might be new
		}
		const contentLines = content.split('\n');

		const threads: ReviewExportThread[] = fileThreads.map((t) => {
			const start = Math.max(0, t.lineNumber - 3);
			const end = Math.min(contentLines.length, t.lineNumber + 2);
			const codeContext = contentLines.slice(start, end).join('\n');

			return {
				lineNumber: t.lineNumber,
				side: t.side,
				codeContext,
				comments: t.comments.map((c) => ({ body: c.body, type: c.type }))
			};
		});

		files.push({
			path: file.path,
			status: file.status,
			threads
		});
	}

	return {
		version: '1.0',
		repository: repoName,
		branch,
		exportedAt: new Date().toISOString(),
		review: {
			status: review.status,
			summary: review.summary,
			files
		}
	};
}

export async function exportJSON(): Promise<string> {
	const data = await buildExport();
	const filePath = join(getRepoDir(), '.lcr-review.json');
	await writeFile(filePath, JSON.stringify(data, null, 2));
	return filePath;
}

export async function exportMarkdown(): Promise<string> {
	const data = await buildExport();
	const lines: string[] = [
		`# Code Review: ${data.repository}`,
		``,
		`**Branch:** ${data.branch}`,
		`**Status:** ${data.review.status}`,
		`**Date:** ${data.exportedAt}`,
		``
	];

	if (data.review.summary) {
		lines.push(`## Summary`, ``, data.review.summary, ``);
	}

	for (const file of data.review.files) {
		lines.push(`## ${file.path} (${file.status})`, ``);
		for (const thread of file.threads) {
			lines.push(`### Line ${thread.lineNumber} (${thread.side})`, ``);
			if (thread.codeContext) {
				lines.push('```', thread.codeContext, '```', ``);
			}
			for (const comment of thread.comments) {
				const prefix = comment.type === 'suggestion' ? '💡' : comment.type === 'question' ? '❓' : '💬';
				lines.push(`${prefix} **${comment.type}:** ${comment.body}`, ``);
			}
		}
	}

	const filePath = join(getRepoDir(), '.lcr-review.md');
	await writeFile(filePath, lines.join('\n'));
	return filePath;
}

import { statSync } from 'fs';
import { execSync } from 'child_process';

export function findClaude(): string {
	const paths = [
		join(process.env.HOME || '', '.local', 'bin', 'claude'),
		'/usr/local/bin/claude',
		'/opt/homebrew/bin/claude'
	];
	for (const p of paths) {
		try {
			statSync(p);
			return p;
		} catch {}
	}
	try {
		return execSync('which claude', { encoding: 'utf-8' }).trim();
	} catch {}
	return 'claude';
}

export async function exportToClaude(): Promise<{ success: boolean; message: string }> {
	const data = await buildExport();

	if (data.review.files.length === 0) {
		return { success: false, message: 'No review comments to send. Add comments first.' };
	}

	const prompt = await buildClaudePrompt(data);
	const claudePath = findClaude();

	return new Promise((resolve) => {
		const child = spawn(claudePath, ['-p'], {
			cwd: getRepoDir(),
			stdio: ['pipe', 'pipe', 'pipe'],
			env: {
				...process.env,
				PATH: `${join(process.env.HOME || '', '.local', 'bin')}:/usr/local/bin:/opt/homebrew/bin:${process.env.PATH || ''}`
			}
		});

		child.stdin.write(prompt);
		child.stdin.end();

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
		child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

		child.on('close', (code) => {
			if (code === 0) {
				resolve({ success: true, message: stdout || 'Review sent to Claude Code successfully.' });
			} else {
				resolve({
					success: false,
					message: stderr || stdout || `Claude Code exited with code ${code}`
				});
			}
		});

		child.on('error', (err) => {
			resolve({
				success: false,
				message: `Failed to launch Claude Code: ${err.message}. Make sure 'claude' CLI is installed.`
			});
		});
	});
}

export async function buildClaudePrompt(data: ReviewExport): Promise<string> {
	const lines: string[] = [
		'I have completed a code review of the current changes. Please address each review comment below by making the necessary changes to the codebase.',
		''
	];

	if (data.review.summary) {
		lines.push(`Overall review summary: ${data.review.summary}`, '');
	}

	for (const file of data.review.files) {
		lines.push(`File: ${file.path} (${file.status})`);
		for (const thread of file.threads) {
			lines.push(`  Line ${thread.lineNumber}:`);
			if (thread.codeContext) {
				lines.push(`  Context:`, `  \`\`\``, `  ${thread.codeContext}`, `  \`\`\``);
			}
			for (const comment of thread.comments) {
				lines.push(`  [${comment.type.toUpperCase()}]: ${comment.body}`);
			}
			lines.push('');
		}
	}

	// Include context files for additional reference
	const contextFilePaths = getContextFiles();
	if (contextFilePaths.length > 0) {
		lines.push('', '--- Additional Context Files ---', '');
		lines.push('The following files are provided as additional context for your reference when making changes:', '');
		const repoDir = getRepoDir();
		for (const filePath of contextFilePaths) {
			try {
				const content = await readFile(join(repoDir, filePath), 'utf-8');
				lines.push(`File: ${filePath}`, '```', content, '```', '');
			} catch {
				lines.push(`File: ${filePath} (could not read)`, '');
			}
		}
	}

	return lines.join('\n');
}

export function getExportPrompt(): string {
	// For clipboard copy — same as Claude prompt but returned as string
	const review = getReview();
	if (review.threads.length === 0) return 'No review comments.';

	const lines: string[] = [
		'Code review comments:',
		''
	];

	const fileGroups = new Map<string, typeof review.threads>();
	for (const thread of review.threads) {
		const existing = fileGroups.get(thread.filePath) || [];
		existing.push(thread);
		fileGroups.set(thread.filePath, existing);
	}

	for (const [path, threads] of fileGroups) {
		lines.push(`File: ${path}`);
		for (const thread of threads) {
			lines.push(`  Line ${thread.lineNumber} (${thread.side}):`);
			for (const comment of thread.comments) {
				lines.push(`    [${comment.type}]: ${comment.body}`);
			}
		}
		lines.push('');
	}

	return lines.join('\n');
}
