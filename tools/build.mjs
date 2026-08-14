/**
 * Release build pipeline for PRISMHOOF.
 *
 *   esbuild (bundle ES modules -> one IIFE)
 *     -> terser (compress + mangle)
 *       -> Roadroller (context-mixing self-extracting pack)
 *         -> inline into src/index.html alongside the minified CSS
 *
 * Every byte-saving trick lives here so that everything under src/ can stay
 * readable, which is what the js13kGames rules ask of the submitted source.
 *
 * Usage:
 *   node tools/build.mjs             release  -> build/index.html
 *   node tools/build.mjs --debug     readable -> build/debug.html (DEBUG = true)
 *   node tools/build.mjs --opt=2     slower, thorough Roadroller search
 */

import { build } from 'esbuild';
import { minify } from 'terser';
import { Packer } from 'roadroller';
import CleanCSS from 'clean-css';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIZE_LIMIT = 13312;

const commandLineArguments = process.argv.slice(2);
const isDebugBuild = commandLineArguments.includes('--debug');
const optimizeLevelArgument = commandLineArguments.find((argument) => argument.startsWith('--opt='));
const roadrollerOptimizeLevel = optimizeLevelArgument ? Number(optimizeLevelArgument.split('=')[1]) : 1;

/** Bundles src/main.js into a single IIFE and returns the code plus the esbuild metafile. */
export async function bundleGameScript({ debug }) {
    const result = await build({
        entryPoints: [resolve(projectRoot, 'src/main.js')],
        bundle: true,
        format: 'iife',
        target: 'es2020',
        // `DEBUG` is a compile-time constant, so `if (DEBUG)` blocks are removed
        // entirely from the release bundle rather than shipped and skipped.
        define: { DEBUG: String(Boolean(debug)) },
        minify: false,
        write: false,
        metafile: true,
        legalComments: 'none',
        charset: 'utf8',
    });

    return { code: result.outputFiles[0].text, metafile: result.metafile };
}

/**
 * Prints how many bytes each source module contributes, largest first.
 *
 * This measures a separate minified bundle rather than the readable one, because
 * otherwise the table just ranks modules by how many comments they carry.
 */
async function printModuleSizeTable() {
    const { metafile } = await build({
        entryPoints: [resolve(projectRoot, 'src/main.js')],
        bundle: true,
        format: 'iife',
        target: 'es2020',
        define: { DEBUG: 'false' },
        minify: true,
        write: false,
        metafile: true,
        legalComments: 'none',
    });

    const output = Object.values(metafile.outputs)[0];
    const modules = Object.entries(output.inputs)
        .map(([path, info]) => ({ path: path.replace(/^src\//, ''), bytes: info.bytesInOutput }))
        .filter((module) => module.bytes > 0)
        .sort((first, second) => second.bytes - first.bytes);

    const totalBytes = modules.reduce((sum, module) => sum + module.bytes, 0);

    console.log('\n  minified bytes by module (before terser and roadroller)');
    for (const module of modules) {
        const bar = '#'.repeat(Math.max(1, Math.round((module.bytes / modules[0].bytes) * 24)));
        console.log(`    ${String(module.bytes).padStart(6)}  ${bar.padEnd(24)}  ${module.path}`);
    }
    console.log(`    ${String(totalBytes).padStart(6)}  ${'='.repeat(24)}  total`);
}

/** Runs terser with the aggressive settings that are safe for this codebase. */
async function compressGameScript(code) {
    const result = await minify(code, {
        ecma: 2020,
        module: false,
        toplevel: true,
        compress: {
            passes: 3,
            unsafe: true,
            unsafe_arrows: true,
            unsafe_math: true,
            unsafe_methods: true,
            booleans_as_integers: true,
            drop_console: true,
            pure_getters: true,
            hoist_funs: true,
        },
        // Property mangling stays off: it is the classic source of silent breakage.
        // If the budget ever demands it, add `properties` here with a reserved list.
        mangle: { toplevel: true },
        format: { comments: false },
    });

    if (result.error) throw result.error;
    return result.code;
}

/** Packs the script with Roadroller, falling back to the plain script if packing does not help. */
async function packGameScript(code) {
    const packer = new Packer([{ data: code, type: 'js', action: 'eval' }], { maxMemoryMB: 150 });
    await packer.optimize(roadrollerOptimizeLevel);

    const { firstLine, secondLine } = packer.makeDecoder();
    const packed = firstLine + '\n' + secondLine;

    // Roadroller wins big on real payloads but loses on tiny ones, because the
    // decoder itself costs around 300 bytes.
    if (packed.length >= code.length) {
        console.log('  roadroller: packed output is larger than the input, keeping the plain script');
        return code;
    }

    return packed;
}

async function main() {
    const startedAt = Date.now();

    const { code: bundledCode } = await bundleGameScript({ debug: isDebugBuild });
    if (!isDebugBuild) await printModuleSizeTable();

    const rawCss = await readFile(resolve(projectRoot, 'src/style.css'), 'utf8');
    const htmlTemplate = await readFile(resolve(projectRoot, 'src/index.html'), 'utf8');

    let scriptForPage = bundledCode;
    let cssForPage = rawCss;

    if (!isDebugBuild) {
        const compressed = await compressGameScript(bundledCode);
        console.log(`\n  esbuild ${bundledCode.length} -> terser ${compressed.length} bytes`);

        scriptForPage = await packGameScript(compressed);
        console.log(`  terser  ${compressed.length} -> packed ${scriptForPage.length} bytes`);

        cssForPage = new CleanCSS({ level: 2 }).minify(rawCss).styles;
    }

    // An inline <script> ends at the first `</script` in the source, so verify the
    // packed payload can never contain one rather than discovering it in a browser.
    if (/<\/script/i.test(scriptForPage)) {
        throw new Error('packed script contains "</script" and cannot be inlined safely');
    }

    let html = htmlTemplate.replace('{{CSS}}', () => cssForPage).replace('{{JS}}', () => scriptForPage);
    if (!isDebugBuild) {
        html = html.replace(/\n\s*/g, '\n').trim();
    }

    const outputPath = resolve(projectRoot, isDebugBuild ? 'build/debug.html' : 'build/index.html');
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, html);

    const htmlBytes = Buffer.byteLength(html);
    console.log(`\n  ${isDebugBuild ? 'debug' : 'release'} html: ${htmlBytes} bytes` +
        (isDebugBuild ? '' : `  (${(htmlBytes / SIZE_LIMIT * 100).toFixed(1)}% of the ${SIZE_LIMIT} byte limit, before zip)`));
    console.log(`  written to ${outputPath.replace(projectRoot + '/', '')} in ${Date.now() - startedAt}ms\n`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
