/**
 * Packages build/index.html into build/game.zip and checks it against the
 * js13kGames 13312 byte limit.
 *
 * The zip is written by hand rather than pulled from a dependency, so the
 * compression is fully under our control - which matters, because the entry only
 * fits at Zopfli's compression ratio, not zlib's. On this payload zlib level 9
 * gives 13,290 bytes of deflate stream and Zopfli gives 13,152: a 138 byte gap,
 * three times the whole remaining margin.
 *
 * Zopfli therefore ships as a dev dependency and runs on every build. It used to
 * be an optional pass with `advzip`, which meant the game fit on a machine that
 * happened to have advancecomp installed and blew the limit by 247 bytes on one
 * that did not. A size limit you only meet on your own laptop is not met.
 *
 * `advzip` and `ect` are still tried afterwards if they happen to be installed,
 * but they have nothing left to find - measured at 0 to 2 bytes over Zopfli here.
 */

import { execFileSync } from 'node:child_process';
import { crc32, deflateRawSync } from 'node:zlib';
import { deflate as zopfliDeflate } from '@gfx/zopfli';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIZE_LIMIT = 13312;

/**
 * Squeezes the payload into a raw DEFLATE stream with Zopfli, falling back to
 * zlib if it is somehow unavailable - which costs 138 bytes and will not fit.
 *
 * 256 iterations is where this payload stops improving: 15 gives 13,154 bytes,
 * 256 gives 13,152, and 1000 gives the same 13,152 for three seconds more work.
 */
async function compressPayload(contents) {
    try {
        return await new Promise((resolvePromise, rejectPromise) => {
            zopfliDeflate(contents, { numiterations: 256 }, (error, result) =>
                error ? rejectPromise(error) : resolvePromise(result));
        });
    } catch (error) {
        console.warn(`  warning: Zopfli unavailable (${error.message}), falling back to zlib`);
        return deflateRawSync(contents, { level: 9, memLevel: 9, windowBits: 15 });
    }
}

/** Builds a single-entry ZIP archive with no extra fields and no timestamps. */
async function createZipArchive(fileName, fileContents) {
    const nameBytes = Buffer.from(fileName, 'utf8');
    const deflated = await compressPayload(fileContents);
    const checksum = crc32(fileContents);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
    localHeader.writeUInt16LE(20, 4); // version needed to extract
    localHeader.writeUInt16LE(0, 6); // general purpose flags
    localHeader.writeUInt16LE(8, 8); // compression method: deflate
    localHeader.writeUInt16LE(0, 10); // modification time
    localHeader.writeUInt16LE(33, 12); // modification date (1980-01-01)
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(deflated.length, 18);
    localHeader.writeUInt32LE(fileContents.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // central directory header signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed to extract
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(33, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(deflated.length, 20);
    centralHeader.writeUInt32LE(fileContents.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // file comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attributes
    centralHeader.writeUInt32LE(0, 38); // external attributes
    centralHeader.writeUInt32LE(0, 42); // offset of local header

    const localSize = localHeader.length + nameBytes.length + deflated.length;
    const centralSize = centralHeader.length + nameBytes.length;

    const endRecord = Buffer.alloc(22);
    endRecord.writeUInt32LE(0x06054b50, 0); // end of central directory signature
    endRecord.writeUInt16LE(0, 4); // this disk number
    endRecord.writeUInt16LE(0, 6); // disk with central directory
    endRecord.writeUInt16LE(1, 8); // entries on this disk
    endRecord.writeUInt16LE(1, 10); // total entries
    endRecord.writeUInt32LE(centralSize, 12);
    endRecord.writeUInt32LE(localSize, 16);
    endRecord.writeUInt16LE(0, 20); // comment length

    return Buffer.concat([localHeader, nameBytes, deflated, centralHeader, nameBytes, endRecord]);
}

/**
 * Hands the finished archive to advzip or ECT if either is installed. Zopfli has
 * already done this job, so this is only here to catch the odd byte; it is not
 * what the entry depends on to fit.
 */
function recompressIfPossible(zipPath) {
    const attempts = [
        { command: 'advzip', args: ['-4', '-z', '-i', '256', zipPath] },
        { command: 'ect', args: ['-9', '-zip', zipPath] },
    ];

    for (const { command, args } of attempts) {
        try {
            execFileSync(command, args, { stdio: 'ignore' });
            return command;
        } catch {
            // Not installed, or it refused the archive. Try the next one.
        }
    }
    return null;
}

async function main() {
    const htmlPath = resolve(projectRoot, 'build/index.html');
    const zipPath = resolve(projectRoot, 'build/game.zip');

    const html = await readFile(htmlPath);
    await writeFile(zipPath, await createZipArchive('index.html', html));

    const usedTool = recompressIfPossible(zipPath);
    const zipBytes = (await stat(zipPath)).size;
    const percentage = (zipBytes / SIZE_LIMIT) * 100;

    console.log(`\n  index.html  ${html.length} bytes`);
    console.log(`  game.zip    ${zipBytes} bytes  (${percentage.toFixed(1)}% of ${SIZE_LIMIT})`);
    console.log(usedTool ? `  zopfli, then ${usedTool}` : '  zopfli');

    if (zipBytes > SIZE_LIMIT) {
        console.error(`\n  OVER BUDGET by ${zipBytes - SIZE_LIMIT} bytes\n`);
        process.exit(1);
    }

    console.log(`  ${SIZE_LIMIT - zipBytes} bytes to spare\n`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
