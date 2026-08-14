/**
 * Development server: rebuilds the unminified debug build on every change and
 * serves it at http://localhost:8013 with live reload.
 *
 * The debug build defines DEBUG = true, which switches on the hitbox overlay,
 * the FPS counter and the level-skip keys. None of that reaches the release
 * build, because esbuild eliminates the `if (DEBUG)` branches when it is false.
 */

import { context } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8013;

// esbuild's serve mode exposes an SSE endpoint that fires on every rebuild.
const LIVE_RELOAD_SNIPPET = `<script>new EventSource('/esbuild').onmessage=()=>location.reload()</script>`;

const writeDebugPagePlugin = {
    name: 'write-debug-page',
    setup(pluginBuild) {
        pluginBuild.onEnd(async (result) => {
            if (result.errors.length) return;

            const css = await readFile(resolve(projectRoot, 'src/style.css'), 'utf8');
            const template = await readFile(resolve(projectRoot, 'src/index.html'), 'utf8');
            const script = result.outputFiles[0].text;

            const html = template
                .replace('{{CSS}}', () => css)
                .replace('{{JS}}', () => script)
                .concat('\n', LIVE_RELOAD_SNIPPET, '\n');

            await mkdir(resolve(projectRoot, 'build'), { recursive: true });
            await writeFile(resolve(projectRoot, 'build/debug.html'), html);
            console.log(`  rebuilt  ${script.length} bytes  ${new Date().toLocaleTimeString()}`);
        });
    },
};

const buildContext = await context({
    entryPoints: [resolve(projectRoot, 'src/main.js')],
    bundle: true,
    format: 'iife',
    target: 'es2022',
    define: { DEBUG: 'true' },
    sourcemap: 'inline',
    write: false,
    outfile: resolve(projectRoot, 'build/debug.js'),
    plugins: [writeDebugPagePlugin],
});

await buildContext.watch();
await buildContext.serve({ port: PORT, servedir: resolve(projectRoot, 'build') });

console.log(`\n  PRISMHOOF dev server\n  http://localhost:${PORT}/debug.html\n`);
