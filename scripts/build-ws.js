// Build ws-handler + pty-session as a standalone bundle for the CLI binary
import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Use esbuild directly via vite's dependency
const esbuild = await import('esbuild');
await esbuild.build({
	entryPoints: [resolve(root, 'src/lib/server/ws-handler.ts')],
	bundle: true,
	outfile: resolve(root, 'build/ws-handler.js'),
	platform: 'node',
	format: 'esm',
	target: 'node18',
	external: ['node-pty', 'ws', 'simple-git', 'shiki'],
	banner: {
		js: '// Auto-generated — do not edit'
	}
});

console.log('  ✔ Built build/ws-handler.js');
