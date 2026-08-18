/**
 * Proves the course editor speaks the level format exactly.
 *
 * Every level in `src/levels/levels.js` is read through the same code the editor
 * loads levels with, printed back out through the same code the editor exports
 * with, and compared to the file it came from. Anything but a byte-for-byte
 * match means the editor would quietly reformat - or lose - part of a level the
 * first time someone opened one in it.
 *
 * Comment lines are removed from the comparison: they are notes to the reader
 * that the grid cannot carry, and the editor leaves them alone by never being
 * the thing that rewrites the file.
 *
 *   node tools/check-editor.mjs
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatLevel, parseLevelSource } from './level-text.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const source = await readFile(resolve(projectRoot, 'src/levels/levels.js'), 'utf8');

const arrayBody = source.slice(
    source.indexOf('export const LEVELS = [') + 'export const LEVELS = ['.length,
    source.lastIndexOf('];'),
);

const expected = arrayBody
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('//'))
    .join('\n');

const levels = parseLevelSource(`[${arrayBody}]`);
const actual = levels.map(formatLevel).join('\n');

if (actual === expected) {
    console.log(`\n  ${levels.length} levels round-tripped byte for byte\n`);
    process.exit(0);
}

const expectedLines = expected.split('\n');
const actualLines = actual.split('\n');

console.error('\n  round trip changed the level file:\n');
for (let line = 0; line < Math.max(expectedLines.length, actualLines.length); line++) {
    if (expectedLines[line] !== actualLines[line]) {
        console.error(`  line ${line + 1}`);
        console.error(`    file:   ${JSON.stringify(expectedLines[line])}`);
        console.error(`    editor: ${JSON.stringify(actualLines[line])}`);
    }
}
process.exit(1);
