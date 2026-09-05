/**
 * Reading and writing the level literals that live in `src/levels/levels.js`.
 *
 * The course editor uses this to load a level into its grid and to print one
 * back out, and `tools/check-editor.mjs` uses it to prove a level survives the
 * round trip unchanged. Both need to agree byte for byte with what is already
 * in the file, so the formatting rules live here once rather than in the editor.
 *
 * The in-game course editor imports this too, so the editor and that proof
 * cannot drift apart. It reaches the game only through `if (DEBUG)` branches, so
 * esbuild drops the whole module from the release build and none of it costs a
 * byte - checked by comparing the packed payload with and without it.
 */

/** Same as `LEVEL_ROW_COUNT` in src/levels/level-format.js. */
export const LEVEL_ROW_COUNT = 18;

export const TILE_CHARACTERS = ['.', '#', '=', 'P', 'G', 'M', 'W', '!'];

/**
 * Strips a level down to the part that has something in it.
 *
 * `parseLevel` pads empty sky back in above and squares off short rows, so
 * leading empty rows and trailing empty tiles are bytes the build would carry
 * for nothing. Doing this here means the editor cannot forget to.
 */
export function trimRows(rows) {
    const trimmed = rows.map((row) => row.replace(/\.+$/, ''));

    let firstUsed = 0;
    while (firstUsed < trimmed.length && trimmed[firstUsed] === '') firstUsed++;

    return trimmed.slice(firstUsed);
}

/** Turns authored rows into a fixed-size grid of characters for editing. */
export function rowsToGrid(rows, width) {
    const padded = [
        ...new Array(Math.max(0, LEVEL_ROW_COUNT - rows.length)).fill(''),
        ...rows,
    ].slice(-LEVEL_ROW_COUNT);

    return padded.map((row) => {
        const cells = new Array(width).fill('.');
        for (let column = 0; column < Math.min(row.length, width); column++) cells[column] = row[column];
        return cells;
    });
}

/** Turns the editor grid back into authored rows, trimmed. */
export function gridToRows(grid) {
    return trimRows(grid.map((cells) => cells.join('')));
}

/** Quotes a string the way the level file does, escaping any apostrophes. */
function quote(text) {
    return `'${String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Prints one level exactly as it appears in `src/levels/levels.js`, indented as
 * an element of the exported array and ready to paste.
 *
 * The `signs` line is omitted when there are none and kept on one line when
 * there is one, which is what the file already does.
 */
export function formatLevel({ name, signs = [], rows }) {
    const lines = ['    {', `        name: ${quote(name)},`];

    if (signs.length === 1) {
        lines.push(`        signs: [${quote(signs[0])}],`);
    } else if (signs.length > 1) {
        lines.push('        signs: [');
        for (const sign of signs) lines.push(`            ${quote(sign)},`);
        lines.push('        ],');
    }

    lines.push('        rows: [');
    for (const row of trimRows(rows)) lines.push(`            ${quote(row)},`);
    lines.push('        ],');
    lines.push('    },');

    return lines.join('\n');
}

/**
 * Reads level definitions out of pasted source.
 *
 * Accepts a whole `levels.js`, the `LEVELS` array on its own, or a single `{ … }`
 * literal, because all three are things you end up with a clipboard full of. The
 * text is evaluated rather than parsed: this is a local dev tool reading source
 * from this repository, and a real parser would be a lot of code to read a file
 * that is already JavaScript.
 */
export function parseLevelSource(text) {
    let source = text.trim();

    // A whole levels.js, file comment and all: take the array literal out of the
    // middle of it, from the opening bracket to the last closing one.
    const declaration = source.match(/LEVELS\s*=\s*\[/);
    if (declaration) {
        source = source.slice(declaration.index + declaration[0].length - 1, source.lastIndexOf(']') + 1);
    }

    const wrapped = source.startsWith('[') ? source : `[${source.replace(/,\s*$/, '')}]`;

    const levels = new Function(`return ${wrapped}`)();

    return levels.filter(Boolean).map((level) => ({
        name: read(level, 'name') || 'UNTITLED',
        signs: read(level, 'signs') || [],
        rows: read(level, 'rows') || [],
    }));
}

/**
 * Reads a field off an object that came from outside the bundle.
 *
 * `level.signs` would be the obvious way to write this and it is wrong in one
 * place: the in-game editor imports this module, and the mangled build renames
 * every property access it can - so `.signs` compiles to `.a` while the object
 * evaluated out of the pasted text still has a key called `signs`, and the
 * signs vanish. Looking the name up as a *value* is immune to that, because
 * values are not renamed. (`name` and `rows` happen to survive on their own,
 * since terser shields anything a DOM API also calls itself, but relying on
 * that is relying on a coincidence.)
 *
 * In Node - the build plugin and the format check - this is just a slower dot.
 */
function read(object, field) {
    return Object.entries(object).find(([key]) => key === field)?.[1];
}
