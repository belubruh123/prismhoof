/**
 * Development server: rebuilds the unminified debug build on every change and
 * serves it at http://localhost:8013 with live reload.
 *
 * The static serving is a few lines of `node:http` rather than esbuild's own
 * `serve()`, which since 0.25 rejects any request whose Host header is not a
 * loopback name with `403 - Forbidden: the host X is not allowed`. That is a
 * guard against DNS rebinding and there is no option to widen it, so a dev build
 * reached through a reverse proxy on a real domain is unreachable. This serves
 * build/ and nothing else - every path is resolved and then checked to still be
 * inside that directory - so the thing the guard protects is not on offer here
 * in the first place.
 *
 * The debug build defines DEBUG = true, which switches on the hitbox overlay,
 * the FPS counter and the level-skip keys. None of that reaches the release
 * build, because esbuild eliminates the `if (DEBUG)` branches when it is false.
 *
 * The course editor is inside the game now - press E - so there is nothing to
 * serve alongside it.
 */

import { context } from 'esbuild';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packLevelsPlugin } from './levels-plugin.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildDirectory = resolve(projectRoot, 'build');
/** `PORT=8014 npm run dev` when 8013 is already taken. */
const PORT = Number(process.env.PORT) || 8013;

const CONTENT_TYPES = {
    html: 'text/html',
    js: 'text/javascript',
    mjs: 'text/javascript',
    css: 'text/css',
    json: 'application/json',
    png: 'image/png',
};

/** Open EventSource responses, one per tab, told to reload after every build. */
const liveReloadClients = new Set();

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

            for (const client of liveReloadClients) client.write('data: rebuild\n\n');

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
    plugins: [packLevelsPlugin, writeDebugPagePlugin],
});

await buildContext.watch();

createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);

    // The live-reload channel, on the same path esbuild used, so the snippet
    // injected into the page did not have to change.
    if (path === '/esbuild') {
        response.writeHead(200, {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
        });
        liveReloadClients.add(response);
        request.on('close', () => liveReloadClients.delete(response));
        return;
    }

    const file = resolve(buildDirectory, '.' + (path === '/' ? '/debug.html' : path));

    // Resolve first, then check: `..` in the path is normalised away by resolve,
    // so anything that escaped build/ fails this and gets nothing.
    if (!file.startsWith(buildDirectory + sep)) {
        response.writeHead(403).end('outside the build directory');
        return;
    }

    try {
        if (!(await stat(file)).isFile()) throw new Error('not a file');
    } catch {
        response.writeHead(404).end('not found');
        return;
    }

    response.writeHead(200, {
        'content-type': CONTENT_TYPES[file.split('.').pop()] ?? 'application/octet-stream',
        'cache-control': 'no-store',
    });
    createReadStream(file).pipe(response);
}).listen(PORT, '0.0.0.0');

console.log(
    `\n  PRISMHOOF dev server, on every interface and any host name`
    + `\n  game    http://localhost:${PORT}/debug.html`
    + `\n  editor  press E in the game, and E again to come back from a test run\n`,
);
