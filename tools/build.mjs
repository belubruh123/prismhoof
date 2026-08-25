/**
 * Release build pipeline for PRISMHOOF.
 *
 *   esbuild (bundle ES modules -> one IIFE)
 *     -> Google Closure Compiler, ADVANCED (whole-program optimisation)
 *       -> terser (compress + mangle)
 *       -> Roadroller (context-mixing self-extracting pack)
 *         -> inline into src/index.html alongside the minified CSS
 *
 * Every byte-saving trick lives here so that everything under src/ can stay
 * readable, which is what the js13kGames rules ask of the submitted source.
 *
 * Usage:
 *   node tools/build.mjs             release  -> build/index.html
 *   node tools/build.mjs --debug     readable -> build/debug.html (DEBUG = true)
 *   node tools/build.mjs --verify    both     -> build/verify.html
 *   node tools/build.mjs --opt=2     slower, thorough Roadroller search
 *   node tools/build.mjs --repeat=5  pack five times and keep the smallest
 *   node tools/build.mjs --pages    director's cut -> docs/index.html, no size limit
 *
 * `--verify` is the safety net for property mangling: it applies the full
 * release squeeze but leaves DEBUG on, so the debug hooks can drive a mangled
 * build and prove that nothing broke. A plain debug build cannot catch mangling
 * bugs, and a plain release build cannot be driven.
 */

import { build } from 'esbuild';
import { minify } from 'terser';
import { Packer } from 'roadroller';
import CleanCSS from 'clean-css';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packLevelsPlugin } from './levels-plugin.mjs';

const runCommand = promisify(execFile);

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIZE_LIMIT = 13312;

/**
 * Property names the mangler must leave alone, beyond the JS and DOM builtins
 * it already protects. Add a name here the moment anything reaches a property
 * through a string that terser cannot see.
 */
const MANGLE_RESERVED = [];

const commandLineArguments = process.argv.slice(2);
const isDebugBuild = commandLineArguments.includes('--debug');
const isVerifyBuild = commandLineArguments.includes('--verify');
/**
 * The director's cut: the same game with the 13kB ceiling lifted, built into
 * `docs/` for GitHub Pages. js13kGames takes a URL for a post-compo version and
 * shows it to nobody until voting closes, so this is where anything that did not
 * fit can go afterwards.
 *
 * It skips Roadroller. Packing exists to buy bytes, and it costs a moment of
 * decoding before the first frame; with no limit to meet that is a bad trade.
 */
const isPagesBuild = commandLineArguments.includes('--pages');
const optimizeLevelArgument = commandLineArguments.find((argument) => argument.startsWith('--opt='));
const roadrollerOptimizeLevel = optimizeLevelArgument ? Number(optimizeLevelArgument.split('=')[1]) : 1;
const repeatArgument = commandLineArguments.find((argument) => argument.startsWith('--repeat='));
const packAttemptCount = repeatArgument ? Number(repeatArgument.split('=')[1]) : 1;

/** Bundles src/main.js into a single IIFE and returns the code plus the esbuild metafile. */
export async function bundleGameScript({ debug }) {
    const result = await build({
        entryPoints: [resolve(projectRoot, 'src/main.js')],
        bundle: true,
        format: 'iife',
        target: 'es2022',
        // `DEBUG` is a compile-time constant, so `if (DEBUG)` blocks are removed
        // entirely from the release bundle rather than shipped and skipped.
        define: { DEBUG: String(Boolean(debug)) },
        minify: false,
        write: false,
        metafile: true,
        legalComments: 'none',
        charset: 'utf8',
        plugins: [packLevelsPlugin],
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
        target: 'es2022',
        define: { DEBUG: 'false' },
        minify: true,
        write: false,
        metafile: true,
        legalComments: 'none',
        plugins: [packLevelsPlugin],
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

/**
 * Runs Google Closure Compiler in ADVANCED mode over the bundle.
 *
 * This is whole-program optimisation, which is the thing terser structurally
 * cannot do: it sees every call site at once, so it inlines across module
 * boundaries, collapses namespaces, drops code no path reaches, and renames
 * properties globally rather than file by file.
 *
 * Closure alone actually packs *worse* than terser alone - 17,833 against
 * 17,792 - because its output is regular in ways Roadroller does not care for.
 * Run one after the other, though, and the two do different jobs: Closure
 * restructures the program, terser then re-minifies and re-mangles the result.
 * Measured on this game: 17,792 packed bytes becomes 17,431.
 *
 * The `checkVars` warnings are off because the source reaches for browser
 * globals bare - `addEventListener`, `localStorage` - rather than through
 * `window`, and the BROWSER externs are what keep those from being renamed.
 */
async function optimiseWholeProgram(code) {
    const inputPath = resolve(projectRoot, 'build/closure-in.js');
    const outputPath = resolve(projectRoot, 'build/closure-out.js');

    await mkdir(dirname(inputPath), { recursive: true });
    await writeFile(inputPath, code);

    await runCommand(resolve(projectRoot, 'node_modules/.bin/google-closure-compiler'), [
        '--js', inputPath,
        '--js_output_file', outputPath,
        '--compilation_level', 'ADVANCED',
        '--language_in', 'ECMASCRIPT_NEXT',
        '--language_out', 'ECMASCRIPT_NEXT',
        '--env', 'BROWSER',
        '--warning_level', 'QUIET',
        '--jscomp_off=undefinedVars',
        '--jscomp_off=checkVars',
    ], { maxBuffer: 64 * 1024 * 1024 });

    return readFile(outputPath, 'utf8');
}

/** Runs terser with the aggressive settings that are safe for this codebase. */
async function compressGameScript(code) {
    const result = await minify(code, {
        ecma: 2022,
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
        mangle: {
            toplevel: true,
            // Renaming our own property names is worth around 8% of the final
            // zip. `builtins: false` is what makes it safe: terser then refuses
            // to touch any name it knows belongs to a JS or DOM API, so
            // `fillStyle`, `lineWidth`, `code` and friends survive.
            //
            // The source has to hold up its end of the bargain twice over.
            //
            // First, nothing may look a property up through a string built at
            // runtime. The two places that used to - the palette and the level
            // character table - were rewritten to use static access and Maps.
            //
            // Second, and less obviously: `builtins: false` protects every name
            // terser recognises from a JS or DOM API, and that list is enormous.
            // `size`, `color`, `weight`, `label`, `items`, `name`, `rows`,
            // `target`, `update` are all real DOM properties somewhere, and
            // `velocityX` survives because IE's MSGestureEvent had one. Ours are
            // therefore named things no browser API claims - `inkColor`,
            // `typeSize`, `menuLabel`, `velocityAcross`, `levelTitle` - which
            // reads no worse and lets the mangler shorten them to a letter.
            // Measured across the codebase: 74 bytes of the final zip.
            properties: { builtins: false, reserved: MANGLE_RESERVED },
        },
        format: { comments: false },
    });

    if (result.error) throw result.error;
    return result.code;
}

/**
 * Packs the script with Roadroller once.
 *
 * Only the script goes through here. Handing the stylesheet to the packer as a
 * second input was measured and is not possible: this version of Roadroller
 * takes exactly one JS or text input, and folding the CSS into the script by
 * hand costs more glue than the two hundred-odd bytes of stylesheet could repay.
 */
async function packOnce(code) {
    const packer = new Packer([{ data: code, type: 'js', action: 'eval' }], {
        // 320 is where the context tables stop paying for themselves on this
        // payload: 150 packs to 17,464 and 320 to 17,452, while 512 and 600 give
        // back nothing more. The number is also what the player's browser has to
        // allocate to decode, so taking the smallest value that reaches the floor
        // matters more than taking the largest one on offer.
        maxMemoryMB: 320,
        // Roadroller's `--dirty` mode: the decoder is allowed to leave its
        // working variables on the global object instead of declaring them,
        // which shortens it. Safe here because the page runs exactly one script
        // and holds exactly one element, whose id is too long to collide with
        // the single letters the decoder helps itself to.
        allowFreeVars: true,
    });
    await packer.optimize(roadrollerOptimizeLevel);

    const { firstLine, secondLine } = packer.makeDecoder();
    return firstLine + '\n' + secondLine;
}

/**
 * Packs the script and returns the smallest result, falling back to the plain
 * script if packing does not help.
 *
 * Roadroller's optimiser searches randomly, so two packs of identical input land
 * around 8 bytes apart. Packing several times and keeping the best turns that
 * spread into a consistent win at the low end, and - more useful day to day -
 * makes a 20 byte experiment elsewhere in the source measurable at all, which a
 * single noisy pack does not.
 */
async function packGameScript(code) {
    let packed = null;

    for (let attempt = 0; attempt < packAttemptCount; attempt++) {
        const candidate = await packOnce(code);
        if (!packed || candidate.length < packed.length) packed = candidate;
        if (packAttemptCount > 1) {
            console.log(`  roadroller attempt ${attempt + 1}/${packAttemptCount}: ${candidate.length} bytes` +
                (candidate.length === packed.length ? '  <- best' : ''));
        }
    }

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

    const { code: bundledCode } = await bundleGameScript({ debug: isDebugBuild || isVerifyBuild });
    if (!isDebugBuild) await printModuleSizeTable();

    const rawCss = await readFile(resolve(projectRoot, 'src/style.css'), 'utf8');
    const htmlTemplate = await readFile(resolve(projectRoot, 'src/index.html'), 'utf8');

    let scriptForPage = bundledCode;
    let cssForPage = rawCss;

    if (!isDebugBuild) {
        const optimised = await optimiseWholeProgram(bundledCode);
        const compressed = await compressGameScript(optimised);
        console.log(`\n  esbuild ${bundledCode.length} -> closure ${optimised.length} -> terser ${compressed.length} bytes`);

        // The exact bytes handed to Roadroller, written out so the same input can
        // be dropped into https://lifthrasiir.github.io/roadroller/ to try knob
        // settings by hand and compare against what this build gets. Release only:
        // a verify build carries all the debug code, so packing that would answer
        // a question nobody asked.
        if (!isVerifyBuild) {
            await mkdir(resolve(projectRoot, 'build'), { recursive: true });
            await writeFile(resolve(projectRoot, 'build/packme.js'), compressed);
        }

        scriptForPage = isPagesBuild ? compressed : await packGameScript(compressed);
        if (!isPagesBuild) console.log(`  terser  ${compressed.length} -> packed ${scriptForPage.length} bytes`);

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

    const outputPath = resolve(
        projectRoot,
        isDebugBuild ? 'build/debug.html'
            : isVerifyBuild ? 'build/verify.html'
                : isPagesBuild ? 'docs/index.html'
                    : 'build/index.html',
    );
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, html);

    const htmlBytes = Buffer.byteLength(html);
    const buildName = isDebugBuild ? 'debug' : isVerifyBuild ? 'verify' : isPagesBuild ? "director's cut" : 'release';
    console.log(`\n  ${buildName} html: ${htmlBytes} bytes` +
        (isDebugBuild || isPagesBuild ? '' : `  (${(htmlBytes / SIZE_LIMIT * 100).toFixed(1)}% of the ${SIZE_LIMIT} byte limit, before zip)`));
    console.log(`  written to ${outputPath.replace(projectRoot + '/', '')} in ${Date.now() - startedAt}ms\n`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
