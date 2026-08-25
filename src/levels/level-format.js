/**
 * Levels are authored as arrays of strings, one string per row of tiles.
 *
 *   '.'  empty
 *   '#'  solid
 *   '='  one-way platform
 *
 * and single letters mark where things spawn, on an otherwise empty tile:
 *
 *   'P'  the unicorn's starting position
 *   'G'  the rainbow gate
 *   'M'  a Murk   (ground patroller)
 *   'W'  a Wisp   (drifting chaser)
 *   '!'  a sign, reading the next line of the level's `signs` list
 *
 * Writing levels as pictures keeps them readable in the source. Rows may be
 * short, or empty: the grid is squared off to the widest row with empty tiles,
 * and rows of empty sky are padded in above, so a level's source holds only the
 * part of the picture that has something in it.
 */

import { TILE_SIZE } from '../config.js';
import { TILE_EMPTY, TILE_PLATFORM, TILE_SOLID } from '../entities/terrain.js';

/**
 * Maps rather than objects, deliberately: Map keys are values, so the release
 * build's property mangling cannot rename them out from under a lookup that
 * comes from level text at runtime.
 */
const TILE_CHARACTERS = new Map([
    ['#', TILE_SOLID],
    ['=', TILE_PLATFORM],
]);

const SPAWN_CHARACTERS = new Map([
    ['P', 'player'],
    ['G', 'gate'],
    ['M', 'murk'],
    ['W', 'wisp'],
    ['!', 'sign'],
]);

/**
 * Every level is this tall. Levels are authored from their topmost interesting
 * row downwards and the empty sky above is padded in here, so the source holds
 * no walls of dots and the build has none to compress.
 */
export const LEVEL_ROW_COUNT = 18;

/**
 * Turns a level definition into a tile grid plus a list of spawn points.
 * Rows shorter than the widest one are padded with empty tiles.
 */
export function parseLevel(definition) {
    const authoredRows = definition.tileRows;
    const skyRowCount = Math.max(0, LEVEL_ROW_COUNT - authoredRows.length);
    const rows = [...new Array(skyRowCount).fill(''), ...authoredRows];

    const columnCount = Math.max(...rows.map((row) => row.length));

    const tileGrid = [];
    const spawns = [];

    rows.forEach((rowText, row) => {
        const tileRow = new Array(columnCount).fill(TILE_EMPTY);

        for (let column = 0; column < rowText.length; column++) {
            const character = rowText[column];

            if (TILE_CHARACTERS.has(character)) {
                tileRow[column] = TILE_CHARACTERS.get(character);
                continue;
            }

            const spawnType = SPAWN_CHARACTERS.get(character);
            if (spawnType) {
                spawns.push({
                    spawnType,
                    x: (column + 0.5) * TILE_SIZE,
                    y: (row + 0.5) * TILE_SIZE,
                });
            }
        }

        tileGrid.push(tileRow);
    });

    return {
        levelTitle: definition.levelTitle,
        signs: definition.signs || [],
        tileGrid,
        spawns,
    };
}

/**
 * Expands the run-length form the build packs level rows into.
 *
 * A row is mostly one character repeated - sky, a floor, the wall of a shaft -
 * so `tools/levels-plugin.mjs` rewrites every run of three or more as the
 * character followed by its count, and joins the rows with commas. Nothing in
 * the level alphabet is a digit, so a digit can only ever be a count.
 *
 * The pictures in `levels.js` stay exactly as they are written; only what the
 * bundle carries changes. `make check` proves the two agree.
 */
export const expandRows = (packed) => packed
    .split(',')
    .map((row) => row.replace(/(\D)(\d+)/g, (_, character, count) => character.repeat(count)));
