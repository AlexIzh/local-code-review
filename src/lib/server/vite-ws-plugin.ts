import type { Plugin } from 'vite';
import { createServer } from 'http';

export function terminalWebSocket(): Plugin {
	let wsServer: ReturnType<typeof createServer> | null = null;

	return {
		name: 'terminal-websocket',
		configureServer(server) {
			server.httpServer?.once('listening', () => {
				const addr = server.httpServer?.address();
				const vitePort = typeof addr === 'object' && addr ? addr.port : 5173;
				const wsPort = parseInt(process.env.VITE_LCR_WS_PORT || String(vitePort + 1000), 10);

				wsServer = createServer();

				import('./ws-handler.ts').then(({ attachWebSocket }) => {
					attachWebSocket(wsServer!, vitePort);
					wsServer!.listen(wsPort, '127.0.0.1', () => {
						console.log(`  Terminal WebSocket on ws://localhost:${wsPort}/ws/terminal`);
					});
					wsServer!.on('error', (err: any) => {
						if (err.code === 'EADDRINUSE') {
							console.error(`  Terminal WebSocket port ${wsPort} in use. Set LCR_WS_PORT to a different port.`);
						}
					});
				}).catch((err) => {
					console.error('Failed to attach terminal WebSocket:', err);
				});
			});
		},
		closeBundle() {
			wsServer?.close();
		}
	};
}
