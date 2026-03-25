import { join } from 'path';
import { EventEmitter } from 'events';
import { findClaude } from './export.ts';
import { getRepoDir } from './git.ts';

// node-pty is a native module — dynamic import to avoid bundling issues
let pty: typeof import('node-pty') | null = null;
async function getPty() {
	if (!pty) {
		pty = await import('node-pty');
	}
	return pty;
}

type IPty = import('node-pty').IPty;

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

let ptyProcess: IPty | null = null;
let outputBuffer: string[] = [];
const MAX_BUFFER = 50000; // characters to keep for reconnection

export async function startSession(cols?: number, rows?: number): Promise<void> {
	if (ptyProcess) return; // already running

	try {
		const nodePty = await getPty();
		const claudePath = findClaude();
		const repoDir = getRepoDir();
		const shell = process.env.SHELL || '/bin/zsh';
		const homeBin = join(process.env.HOME || '', '.local', 'bin');

		// Filter out undefined env values — node-pty/posix_spawnp requires all strings
		const cleanEnv: Record<string, string> = {};
		for (const [k, v] of Object.entries(process.env)) {
			if (v !== undefined) cleanEnv[k] = v;
		}
		cleanEnv.PATH = `${homeBin}:/usr/local/bin:/opt/homebrew/bin:${cleanEnv.PATH || ''}`;
		cleanEnv.TERM = 'xterm-256color';

		ptyProcess = nodePty.spawn(shell, ['-l'], {
			name: 'xterm-256color',
			cols: cols || 80,
			rows: rows || 24,
			cwd: repoDir,
			env: cleanEnv
		});

		ptyProcess.onData((data) => {
			outputBuffer.push(data);
			while (outputBuffer.join('').length > MAX_BUFFER) {
				outputBuffer.shift();
			}
			emitter.emit('data', data);
		});

		ptyProcess.onExit(({ exitCode }) => {
			ptyProcess = null;
			emitter.emit('exit', exitCode);
		});

		// Give shell a moment to init, then start claude
		setTimeout(() => {
			if (ptyProcess) {
				ptyProcess.write(`${claudePath}\r`);
			}
		}, 500);
	} catch (err) {
		console.error('Failed to start PTY session:', err);
		emitter.emit('data', `\r\n\x1b[31mFailed to start terminal: ${err}\x1b[0m\r\n`);
	}
}

export function sendInput(data: string): void {
	if (ptyProcess) {
		ptyProcess.write(data);
	}
}

export function sendReviewPrompt(prompt: string): void {
	if (!ptyProcess) return;

	// Write the prompt text, then send Enter after a short delay
	// to ensure the terminal has processed all the text
	ptyProcess.write(prompt);
	setTimeout(() => {
		if (ptyProcess) {
			ptyProcess.write('\r');
		}
	}, 200);
}

export function resize(cols: number, rows: number): void {
	if (ptyProcess) {
		ptyProcess.resize(cols, rows);
	}
}

export function killSession(): void {
	if (ptyProcess) {
		ptyProcess.kill();
		ptyProcess = null;
	}
	outputBuffer = [];
}

export function isAlive(): boolean {
	return ptyProcess !== null;
}

export function getBufferedOutput(): string {
	return outputBuffer.join('');
}

export function onData(listener: (data: string) => void): () => void {
	emitter.on('data', listener);
	return () => emitter.off('data', listener);
}

export function onExit(listener: (code: number) => void): () => void {
	emitter.on('exit', listener);
	return () => emitter.off('exit', listener);
}

// Cleanup on process exit
process.on('SIGTERM', () => killSession());
process.on('SIGINT', () => killSession());
