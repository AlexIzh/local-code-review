import { writable, get } from 'svelte/store';

export const terminalOpen = writable(false);
export const terminalHeight = writable(300);

// Pending review to send once WS connects
let pendingReview = false;

function getWsInstance(): WebSocket | null {
	if (typeof globalThis === 'undefined') return null;
	return (globalThis as any).__lcr_ws || null;
}

export function getWs(): WebSocket | null {
	return getWsInstance();
}

export function hasPendingReview(): boolean {
	if (pendingReview) {
		pendingReview = false;
		return true;
	}
	return false;
}

export async function sendReviewToClaude(): Promise<{ success: boolean; message: string }> {
	const ws = getWsInstance();

	// If WS is already connected, send immediately
	if (ws?.readyState === WebSocket.OPEN) {
		terminalOpen.set(true);
		ws.send(JSON.stringify({ type: 'review' }));
		return { success: true, message: 'Review sent.' };
	}

	// Otherwise, open the terminal and queue the review
	// The TerminalPanel will check for pending review on WS connect
	pendingReview = true;
	terminalOpen.set(true);
	return { success: true, message: 'Opening terminal...' };
}

export async function stopClaudeSession(): Promise<void> {
	const ws = getWsInstance();
	if (ws?.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify({ type: 'stop' }));
	}
}

export async function restartSession(): Promise<void> {
	const ws = getWsInstance();
	if (ws?.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify({ type: 'restart' }));
	}
}

export function toggleTerminal() {
	terminalOpen.update((v) => !v);
}

// Persist terminal height to localStorage
if (typeof window !== 'undefined') {
	const saved = localStorage.getItem('lcr-terminal-height');
	if (saved) terminalHeight.set(Number(saved));
	terminalHeight.subscribe((h) => localStorage.setItem('lcr-terminal-height', String(h)));
}
