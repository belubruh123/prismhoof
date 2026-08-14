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
 *
 * Writing levels as pictures keeps them readable in the source, and a wall of
 * repeated characters is close to free once the build compresses it.
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
    const authoredRows = definition.rows;
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
                    type: spawnType,
                    x: (column + 0.5) * TILE_SIZE,
                    y: (row + 0.5) * TILE_SIZE,
                });
            }
        }

        tileGrid.push(tileRow);
    });

    return {
        name: definition.name,
        hint: definition.hint,
        tileGrid,
        spawns,
    };
}
