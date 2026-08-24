/**
 * Packs the level pictures on the way into the bundle.
 *
 * `src/levels/levels.js` is written to be read: one character per tile, one
 * string per row, which is what makes a course reviewable in a diff and what
 * the competition asks of the submitted source. It is also the largest thing in
 * the game, and almost every row is a run of one character repeated.
 *
 * So the source stays a picture and the bundle gets run-length encoding: this
 * plugin swaps the module for a generated one whose rows are packed strings,
 * expanded at load by `expandRows` in src/levels/level-format.js. It runs in
 * every build, debug included, so what is played is always what ships.
 *
 * Measured on the thirteen courses: 5,820 characters of rows become 1,887.
 */

import { readFile } from 'node:fs/promises';
import { parseLevelSource } from './level-text.mjs';

/** A run of three or more identical tiles becomes the tile and its length. */
export function encodeRows(rows) {
    return rows.map((row) => row.replace(/(.)\1{2,}/g, (run, character) => character + run.length)).join(',');
}

export const packLevelsPlugin = {
    name: 'pack-levels',
    setup(build) {
        build.onLoad({ filter: /levels[\\/]levels\.js$/ }, async (file) => {
            const levels = parseLevelSource(await readFile(file.path, 'utf8'));

            const entries = levels.map((level) => {
                const signs = level.signs.length ? `signs:${JSON.stringify(level.signs)},` : '';
                return `{levelTitle:${JSON.stringify(level.name)},${signs}tileRows:expandRows(${JSON.stringify(encodeRows(level.rows))})}`;
            });

            return {
                contents: `import { expandRows } from './level-format.js';\n`
                    + `export const LEVELS = [${entries.join(',')}];\n`,
                loader: 'js',
            };
        });
    },
};
