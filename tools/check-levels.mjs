/**
 * Proves the build's level packing is lossless.
 *
 * The bundle does not carry the pictures in `src/levels/levels.js`; it carries a
 * run-length encoding of them, expanded at load. That is a rewrite of the single
 * biggest thing in the game, applied silently on the way past, so it gets the
 * same treatment as property mangling: something that fails the build rather
 * than the player.
 *
 * Every row of every level is encoded and expanded again here with exactly the
 * pair the build and the game use, and compared character for character.
 *
 *   node tools/check-levels.mjs
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLevelSource } from './level-text.mjs';
import { encodeRows } from './levels-plugin.mjs';
import { expandRows } from '../src/levels/level-format.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const levels = parseLevelSource(await readFile(resolve(projectRoot, 'src/levels/levels.js'), 'utf8'));

let rawCharacters = 0;
let packedCharacters = 0;
let failed = false;

for (const level of levels) {
    const packed = encodeRows(level.rows);
    const expanded = expandRows(packed);

    rawCharacters += level.rows.join(',').length;
    packedCharacters += packed.length;

    if (expanded.length !== level.rows.length || expanded.some((row, index) => row !== level.rows[index])) {
        failed = true;
        console.error(`\n  ${level.name} does not survive packing`);
        expanded.forEach((row, index) => {
            if (row !== level.rows[index]) {
                console.error(`    row ${index}`);
                console.error(`      source: ${JSON.stringify(level.rows[index])}`);
                console.error(`      packed: ${JSON.stringify(row)}`);
            }
        });
    }
}

if (failed) process.exit(1);

const saved = rawCharacters - packedCharacters;
console.log(`\n  ${levels.length} levels pack losslessly`
    + `\n  ${rawCharacters} characters of rows -> ${packedCharacters}`
    + `  (${saved} saved, ${(saved / rawCharacters * 100).toFixed(1)}% smaller)\n`);
