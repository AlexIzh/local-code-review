<script lang="ts">
	import {
		terminalOpen,
		terminalHeight,
		sendReviewToClaude,
		stopClaudeSession,
		restartSession,
		hasPendingReview
	} from '$lib/stores/terminal.ts';
	import { theme } from '$lib/stores/ui.ts';
	import { onDestroy } from 'svelte';

	let isResizing = $state(false);
	let minimized = $state(false);
	let connected = $state(false);
	let initError = $state<string | null>(null);

	let term: any = null;
	let fitAddon: any = null;
	let ws: WebSocket | null = null;
	let resizeObserver: ResizeObserver | null = null;

	const terminalThemes: Record<string, Record<string, string>> = {
		dark: {
			background: '#1e1e1e',
			foreground: '#d4d4d4',
			cursor: '#d4d4d4',
			selectionBackground: '#264f78',
			black: '#1e1e1e',
			red: '#f44747',
			green: '#6a9955',
			yellow: '#d7ba7d',
			blue: '#569cd6',
			magenta: '#c586c0',
			cyan: '#4ec9b0',
			white: '#d4d4d4',
			brightBlack: '#808080',
			brightRed: '#f44747',
			brightGreen: '#6a9955',
			brightYellow: '#d7ba7d',
			brightBlue: '#569cd6',
			brightMagenta: '#c586c0',
			brightCyan: '#4ec9b0',
			brightWhite: '#ffffff'
		},
		light: {
			background: '#f8f8f8',
			foreground: '#383a42',
			cursor: '#383a42',
			selectionBackground: '#add6ff',
			black: '#383a42',
			red: '#e45649',
			green: '#50a14f',
			yellow: '#c18401',
			blue: '#4078f2',
			magenta: '#a626a4',
			cyan: '#0184bc',
			white: '#fafafa',
			brightBlack: '#a0a1a7',
			brightRed: '#e45649',
			brightGreen: '#50a14f',
			brightYellow: '#c18401',
			brightBlue: '#4078f2',
			brightMagenta: '#a626a4',
			brightCyan: '#0184bc',
			brightWhite: '#ffffff'
		}
	};

	// React to theme changes
	$effect(() => {
		if (term) {
			term.options.theme = terminalThemes[$theme];
		}
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		ws?.close();
		ws = null;
		term?.dispose();
		term = null;
	});

	// Svelte action — runs when the DOM element is actually mounted
	function terminalAction(node: HTMLDivElement) {
		initTerminal(node);
		return {
			destroy() {
				resizeObserver?.disconnect();
				resizeObserver = null;
			}
		};
	}

	async function initTerminal(node: HTMLDivElement) {
		try {
			const [{ Terminal }, { FitAddon }] = await Promise.all([
				import('@xterm/xterm'),
				import('@xterm/addon-fit')
			]);
			await import('@xterm/xterm/css/xterm.css');

			term = new Terminal({
				cursorBlink: true,
				fontSize: 13,
				fontFamily: 'Menlo, Monaco, "Courier New", monospace',
				theme: terminalThemes[$theme],
				allowProposedApi: true
			});

			fitAddon = new FitAddon();
			term.loadAddon(fitAddon);
			term.open(node);

			requestAnimationFrame(() => fitAddon?.fit());

			connectWs();

			term.onData((data: string) => {
				if (ws?.readyState === WebSocket.OPEN) {
					ws.send(JSON.stringify({ type: 'input', data }));
				}
			});

			resizeObserver = new ResizeObserver(() => {
				if (fitAddon && !minimized) {
					fitAddon.fit();
					if (ws?.readyState === WebSocket.OPEN && term) {
						ws.send(JSON.stringify({
							type: 'resize',
							cols: term.cols,
							rows: term.rows
						}));
					}
				}
			});
			resizeObserver.observe(node);
		} catch (err) {
			initError = String(err);
			console.error('Terminal init failed:', err);
		}
	}

	function getWsUrl(): string {
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		if (import.meta.env.DEV) {
			// If VITE_LCR_WS_PORT is set, use it. Otherwise derive from page port + 1000.
			const wsPort = import.meta.env.VITE_LCR_WS_PORT || String(parseInt(window.location.port, 10) + 1000);
			return `ws://localhost:${wsPort}/ws/terminal`;
		}
		return `${protocol}//${window.location.host}/ws/terminal`;
	}

	function connectWs() {
		ws = new WebSocket(getWsUrl());

		ws.onopen = () => {
			connected = true;
			// Send resize info
			if (term) {
				ws!.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
			}
			// Check for pending review from ExportDialog
			if (hasPendingReview()) {
				ws!.send(JSON.stringify({ type: 'review' }));
			}
		};

		ws.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data);
				if (msg.type === 'output' && term) {
					term.write(msg.data);
				} else if (msg.type === 'exit') {
					term?.write('\r\n\x1b[33mSession ended.\x1b[0m\r\n');
					connected = false;
				} else if (msg.type === 'request-resize' && term) {
					// Server needs dimensions to start a new session
					ws!.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
				}
			} catch {
				term?.write(event.data);
			}
		};

		ws.onclose = () => {
			connected = false;
			setTimeout(() => {
				if ($terminalOpen && (!ws || ws.readyState === WebSocket.CLOSED)) {
					connectWs();
				}
			}, 2000);
		};

		ws.onerror = () => {
			connected = false;
		};

		(globalThis as any).__lcr_ws = ws;
	}

	function startResize(e: MouseEvent) {
		e.preventDefault();
		isResizing = true;
		const startY = e.clientY;
		const startHeight = $terminalHeight;

		function onMove(e: MouseEvent) {
			const delta = startY - e.clientY;
			const newHeight = Math.max(100, Math.min(window.innerHeight * 0.8, startHeight + delta));
			$terminalHeight = newHeight;
		}

		function onUp() {
			isResizing = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			requestAnimationFrame(() => fitAddon?.fit());
		}

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}
</script>

{#if $terminalOpen}
	<div
		class="flex flex-col border-t border-border bg-terminal"
		style="height: {minimized ? 'auto' : `${$terminalHeight}px`}"
	>
		{#if !minimized}
			<div
				class="h-1 cursor-row-resize hover:bg-blue-500/50 transition-colors {isResizing ? 'bg-blue-500/50' : ''}"
				onmousedown={startResize}
				role="separator"
			></div>
		{/if}

		<div class="flex items-center gap-2 px-3 py-1.5 bg-surface border-b border-border/50 select-none shrink-0">
			<div class="flex items-center gap-2">
				<span class="text-xs font-medium text-secondary">Claude Terminal</span>
				<span class="flex items-center gap-1">
					<span class="w-2 h-2 rounded-full {connected ? 'bg-green-400' : 'bg-muted'}"></span>
					<span class="text-[10px] text-muted">{connected ? 'Connected' : 'Disconnected'}</span>
				</span>
			</div>

			<div class="flex-1"></div>

			<div class="flex items-center gap-1">
				<button
					onclick={sendReviewToClaude}
					class="text-[10px] px-2 py-0.5 rounded text-accent-blue hover:bg-accent-blue/10 transition-colors"
					title="Send current review comments to Claude"
				>
					Send Review
				</button>

				<button
					onclick={stopClaudeSession}
					class="text-[10px] px-2 py-0.5 rounded text-accent-red hover:bg-accent-red/10 transition-colors"
				>
					Stop
				</button>

				<button
					onclick={restartSession}
					class="text-[10px] px-2 py-0.5 rounded text-tertiary hover:bg-hover transition-colors"
				>
					Restart
				</button>

				<button
					onclick={() => term?.clear()}
					class="text-[10px] px-2 py-0.5 rounded text-tertiary hover:bg-hover transition-colors"
				>
					Clear
				</button>

				<button
					onclick={() => minimized = !minimized}
					class="text-[10px] px-2 py-0.5 rounded text-tertiary hover:bg-hover transition-colors"
				>
					{minimized ? 'Expand' : 'Minimize'}
				</button>

				<button
					onclick={() => $terminalOpen = false}
					class="text-[10px] px-2 py-0.5 rounded text-tertiary hover:bg-hover transition-colors"
				>
					Close
				</button>
			</div>
		</div>

		{#if !minimized}
			<div
				use:terminalAction
				class="flex-1 overflow-hidden"
			></div>
			{#if initError}
				<div class="p-3 text-accent-red text-xs">{initError}</div>
			{/if}
		{/if}
	</div>
{/if}
