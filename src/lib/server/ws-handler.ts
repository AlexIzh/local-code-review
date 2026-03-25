import type { Server as HttpServer } from 'http';
import { WebSocketServer, type WebSocket } from 'ws';
import {
	startSession,
	sendInput,
	sendReviewPrompt,
	resize,
	killSession,
	isAlive,
	getBufferedOutput,
	onData,
	onExit
} from './pty-session.ts';

export function attachWebSocket(server: HttpServer, appPort?: number): void {
	const wss = new WebSocketServer({ noServer: true });

	server.on('upgrade', (req, socket, head) => {
		if (req.url === '/ws/terminal') {
			wss.handleUpgrade(req, socket, head, (ws) => {
				wss.emit('connection', ws, req);
			});
		}
		// Don't destroy other upgrade requests — Vite HMR uses WebSocket too
	});

	wss.on('connection', async (ws: WebSocket) => {
		// Don't start session yet — wait for first resize message with correct dimensions.
		// If session is already running, send buffered output immediately.
		const buffered = isAlive() ? getBufferedOutput() : null;
		if (buffered) {
			ws.send(JSON.stringify({ type: 'output', data: buffered }));
		}

		// Forward PTY output to WebSocket
		const unsubData = onData((data) => {
			if (ws.readyState === ws.OPEN) {
				ws.send(JSON.stringify({ type: 'output', data }));
			}
		});

		const unsubExit = onExit((code) => {
			if (ws.readyState === ws.OPEN) {
				ws.send(JSON.stringify({ type: 'exit', code }));
			}
		});

		// Handle messages from client
		ws.on('message', async (raw) => {
			try {
				const msg = JSON.parse(raw.toString());

				switch (msg.type) {
					case 'input':
						sendInput(msg.data);
						break;

					case 'review': {
						// Fetch the review prompt via HTTP to ensure we use the same
						// module instance as the SvelteKit API routes
						const port = appPort || (() => { const a = server.address(); return typeof a === 'object' && a ? a.port : 5173; })();
						try {
							const res = await fetch(`http://localhost:${port}/api/export`, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ format: 'clipboard' })
							});
							const result = await res.json();
							if (!result.success || !result.text || result.text === 'No review comments.') {
								ws.send(JSON.stringify({
									type: 'output',
									data: '\r\n\x1b[33m⚠ No review comments to send. Add comments first.\x1b[0m\r\n'
								}));
								break;
							}
							if (!isAlive()) {
								// Session should already be started by resize on connect.
								// If somehow not, start with defaults and wait.
								await startSession(80, 24);
								await new Promise((r) => setTimeout(r, 2000));
							}
							sendReviewPrompt(result.text);
						} catch (err) {
							ws.send(JSON.stringify({
								type: 'output',
								data: `\r\n\x1b[31mFailed to fetch review: ${err}\x1b[0m\r\n`
							}));
						}
						break;
					}

					case 'resize':
						if (msg.cols && msg.rows) {
							if (!isAlive()) {
								// First resize — start session with correct dimensions
								try {
									await startSession(msg.cols, msg.rows);
									const buf = getBufferedOutput();
									if (buf) ws.send(JSON.stringify({ type: 'output', data: buf }));
								} catch (err) {
									ws.send(JSON.stringify({
										type: 'output',
										data: `\r\n\x1b[31mFailed to start terminal: ${err}\x1b[0m\r\n`
									}));
								}
							} else {
								resize(msg.cols, msg.rows);
							}
						}
						break;

					case 'stop':
						killSession();
						break;

					case 'restart':
						killSession();
						// Ask client to send dimensions so we restart with correct size
						ws.send(JSON.stringify({ type: 'request-resize' }));
						break;
				}
			} catch (err) {
				console.error('WS message error:', err);
			}
		});

		ws.on('close', () => {
			unsubData();
			unsubExit();
		});
	});
}
