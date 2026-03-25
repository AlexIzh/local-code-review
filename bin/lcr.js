#!/usr/bin/env node

import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { createServer } from 'http';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2);
const repoDir = resolve(args[0] || process.cwd());

// Check if directory is a git repo
if (!existsSync(join(repoDir, '.git'))) {
	console.error('Error: Not a git repository. Run this command from within a git repo.');
	process.exit(1);
}

// Set repo dir for the server
process.env.LCR_REPO_DIR = repoDir;

// Find the build directory
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const buildPath = join(__dirname, '..', 'build');

if (!existsSync(join(buildPath, 'handler.js'))) {
	console.error('Error: Build not found. Run `npm run build` first.');
	process.exit(1);
}

// Import the SvelteKit handler
const { handler } = await import(join(buildPath, 'handler.js'));

const DEFAULT_PORT = 5678;
const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);

const server = createServer(handler);

// Attach WebSocket for terminal
try {
	const wsHandler = await import(join(buildPath, 'server', 'chunks', 'ws-handler.js'));
	wsHandler.attachWebSocket(server);
} catch {
	// ws-handler may be bundled differently — try alternative import
	try {
		const { attachWebSocket } = await import('../src/lib/server/ws-handler.ts');
		attachWebSocket(server);
	} catch (err) {
		console.warn('  Warning: Could not attach terminal WebSocket:', err.message);
	}
}

server.listen(port, '127.0.0.1', async () => {
	const url = `http://localhost:${port}`;
	console.log(`\n  Local Code Review`);
	console.log(`  Reviewing: ${repoDir}`);
	console.log(`  Server:    ${url}\n`);

	// Open browser
	try {
		const open = await import('open');
		await open.default(url);
	} catch {
		console.log(`  Open ${url} in your browser`);
	}
});

server.on('error', (err) => {
	if (err.code === 'EADDRINUSE') {
		console.error(`Port ${port} is in use. Try: PORT=${port + 1} lcr`);
		process.exit(1);
	}
	throw err;
});

// Graceful shutdown
process.on('SIGINT', () => {
	console.log('\n  Shutting down...');
	server.close();
	process.exit(0);
});

process.on('SIGTERM', () => {
	server.close();
	process.exit(0);
});
