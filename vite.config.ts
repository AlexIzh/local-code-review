import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { terminalWebSocket } from './src/lib/server/vite-ws-plugin.ts';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), terminalWebSocket()],
	ssr: {
		// node-pty is a native module, don't try to bundle it
		noExternal: [],
		external: ['node-pty']
	}
});
