/**
 * Packages build/index.html into build/game.zip and checks it against the
 * js13kGames 13312 byte limit.
 *
 * The zip is written by hand with zlib rather than pulled from a dependency, so
 * that the compression level is fully under our control and the toolchain stays
 * at four dev dependencies. If `advzip` or `ect` happen to be installed, the
 * archive is recompressed with them (they use Zopfli, which reliably beats
 * zlib level 9 by a few hundred bytes at this size).
 */

import { execFileSync } from 'node:child_process';
import { crc32, deflateRawSync } from 'node:zlib';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIZE_LIMIT = 13312;

/** Builds a single-entry ZIP archive with no extra fields and no timestamps. */
function createZipArchive(fileName, fileContents) {
    const nameBytes = Buffer.from(fileName, 'utf8');
    const deflated = deflateRawSync(fileContents, { level: 9, memLevel: 9, windowBits: 15 });
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

/** Recompresses the archive in place with whichever Zopfli-based tool is installed. */
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
    await writeFile(zipPath, createZipArchive('index.html', html));

    const usedTool = recompressIfPossible(zipPath);
    const zipBytes = (await stat(zipPath)).size;
    const percentage = (zipBytes / SIZE_LIMIT) * 100;

    console.log(`\n  index.html  ${html.length} bytes`);
    console.log(`  game.zip    ${zipBytes} bytes  (${percentage.toFixed(1)}% of ${SIZE_LIMIT})`);
    console.log(usedTool
        ? `  recompressed with ${usedTool}`
        : '  note: install advancecomp (advzip) or ECT to squeeze a few hundred more bytes');

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
