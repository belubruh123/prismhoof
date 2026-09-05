/**
 * The course editor, inside the game.
 *
 * This module is reached only from `src/debug.js`, every call into which sits
 * behind `if (DEBUG)`. DEBUG is a compile-time constant, so esbuild eliminates
 * those branches and then drops this file, `tools/level-text.mjs` and everything
 * either of them pulls in. **None of it costs the 13kB build a byte** - checked
 * by building the release with and without it and comparing the zip.
 *
 * It used to be `tools/editor.html`, a separate page that drew its own grid and
 * handed courses to the game through localStorage. Putting it on the game's own
 * canvas is smaller, shorter and better: there is one grid renderer instead of
 * two, playtesting is a keystroke rather than a page load, and the thing you
 * test in is the thing you drew in. The one part of the old page worth keeping
 * whole was `tools/level-text.mjs`, which is imported here rather than
 * reimplemented - it is what `tools/check-editor.mjs` proves round-trips every
 * level in the game byte for byte, so the editor and that proof cannot drift.
 *
 * Text entry uses `prompt`. A canvas has no text fields, writing one is a lot of
 * code for a dev tool, and names and sign lines are typed about twice a course.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from './config.js';
import { canvas, canvasContext } from './core/canvas.js';
import { drawText } from './graphics/typography.js';
import { LEVEL_ROW_COUNT } from './levels/level-format.js';
import { LEVELS } from './levels/levels.js';
import { GameplayScreen } from './screens/gameplay-screen.js';
import { TitleScreen } from './screens/title-screen.js';
import { Screen, pushScreen, resetScreens, topScreen } from './screens/screen.js';
import {
    formatLevel,
    gridToRows,
    parseLevelSource,
    rowsToGrid,
} from '../tools/level-text.mjs';

/** Where a work-in-progress course lives between page loads. */
const SAVE_KEY = 'prismhoof.editorLevel';

/** The palette, in the order the number keys select it. */
const TILES = [
    { character: '.', label: 'EMPTY', tileColor: '#2b2140' },
    { character: '#', label: 'SOLID', tileColor: '#3f3a63' },
    { character: '=', label: 'PLATFORM', tileColor: '#5ad6c8' },
    { character: 'P', label: 'START', tileColor: '#fdf7ff' },
    { character: 'G', label: 'GATE', tileColor: '#ffd93d' },
    { character: 'M', label: 'MURK', tileColor: '#ff5fa2' },
    { character: 'W', label: 'WISP', tileColor: '#c46bff' },
    { character: '!', label: 'SIGN', tileColor: '#3dc6ff' },
];

/**
 * The three distances every course in this game is built out of, drawn from
 * whichever tile the pointer is over. Sketching a gap and then checking it
 * against these is the whole job of laying a course out.
 */
const GUIDES = [
    { across: 6, up: 3, guideColor: '#5ad6c8', label: 'jump' },
    { across: 10, up: 0, guideColor: '#ffd93d', label: 'pour' },
    { across: 10, up: 5, guideColor: '#ff5fa2', label: 'pour + jump' },
];

/**
 * What each key does, as a Map rather than an object literal.
 *
 * That is not a style choice. `event.code` is a string that arrives at runtime,
 * and terser's property mangling renames object-literal keys - so an object
 * keyed by `Enter` and `KeyX` becomes an object keyed by `a` and `b`, every
 * lookup misses, and every one of these keys silently stops working. It is the
 * same reason the level format and the spawn table are Maps: **a Map's keys are
 * values, and values do not get mangled.**
 *
 * Caught by `make verify`, which is the only build that can catch it: the debug
 * build is not mangled and the release build does not contain this file.
 */
const ACTIONS = new Map([
    ['BracketLeft', (editor) => editor.resize(-1)],
    ['BracketRight', (editor) => editor.resize(1)],
    ['KeyN', (editor) => editor.rename()],
    ['KeyS', (editor) => editor.editSigns()],
    ['KeyL', (editor) => editor.loadFromGame()],
    ['KeyI', (editor) => editor.importPasted()],
    ['KeyE', (editor) => editor.exportToClipboard()],
    ['KeyG', (editor) => { editor.showGuides = !editor.showGuides; }],
    ['KeyX', (editor) => editor.clear()],
    ['Enter', (editor) => editor.playCourse()],
    ['Escape', () => resetScreens(new TitleScreen())],
]);

const GRID_TOP = 96;
const MIN_WIDTH = 8;
const MAX_WIDTH = 120;
/** What a fresh course starts at: about the width the shipped ones settled on. */
const DEFAULT_WIDTH = 42;

const BRIGHT = '#fdf7ff';
const DIM = '#e9dcffaa';

export class EditorScreen extends Screen {
    selectedTile = 1;
    /** The character being dragged in, or null when the pointer is up. */
    painting = null;
    hover = null;
    showGuides = true;
    notice = '';

    constructor() {
        super();

        const saved = load();
        this.courseName = saved.name;
        this.signs = saved.signs;
        this.gridWidth = widthOf(saved.rows);
        this.grid = rowsToGrid(saved.rows, this.gridWidth);

        // Straight onto the window rather than through the game's input module,
        // because the editor has to answer the pointer, and because Backquote
        // has to work from inside a playtest as well as from here.
        addEventListener('pointerdown', (event) => this.onPointerDown(event));
        addEventListener('pointermove', (event) => this.onPointerMove(event));
        addEventListener('pointerup', () => { this.painting = null; });
        addEventListener('contextmenu', (event) => { if (this.isOnTop()) event.preventDefault(); });
        addEventListener('keydown', (event) => this.onKeyDown(event));
    }

    isOnTop() {
        return topScreen() === this;
    }

    /** Pixels per tile, and where the grid starts, for the current width. */
    get cellSize() {
        return Math.floor(Math.min(1240 / this.gridWidth, (CANVAS_HEIGHT - GRID_TOP - 120) / LEVEL_ROW_COUNT));
    }

    get gridLeft() {
        return Math.round((CANVAS_WIDTH - this.gridWidth * this.cellSize) / 2);
    }

    // --- input ------------------------------------------------------------

    /** Where in the grid a pointer event landed, or null if it missed. */
    cellAt(event) {
        const bounds = canvas.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width * CANVAS_WIDTH - this.gridLeft;
        const y = (event.clientY - bounds.top) / bounds.height * CANVAS_HEIGHT - GRID_TOP;

        const column = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);

        const isInside = row >= 0 && column >= 0 && row < LEVEL_ROW_COUNT && column < this.gridWidth;
        return isInside ? { row, column } : null;
    }

    onPointerDown(event) {
        if (!this.isOnTop()) return;
        this.painting = event.button === 2 ? '.' : TILES[this.selectedTile].character;
        this.paint(this.cellAt(event));
    }

    onPointerMove(event) {
        if (!this.isOnTop()) return;
        this.hover = this.cellAt(event);
        if (this.painting) this.paint(this.hover);
    }

    paint(cell) {
        if (!cell || !this.painting || this.grid[cell.row][cell.column] === this.painting) return;

        // One unicorn and one gate to a course, so placing either takes the old
        // one away rather than quietly making a course that will not load.
        if (this.painting === 'P' || this.painting === 'G') {
            for (const cells of this.grid) {
                cells.forEach((character, column) => {
                    if (character === this.painting) cells[column] = '.';
                });
            }
        }

        this.grid[cell.row][cell.column] = this.painting;
        this.save();
    }

    onKeyDown(event) {
        // The way back, from anywhere: a playtest, a pause menu, even the ending
        // screen after finishing the course you just drew.
        if (event.code === 'Backquote') {
            if (!this.isOnTop()) resetScreens(this);
            return;
        }

        if (!this.isOnTop()) return;

        const digit = Number(event.key);
        if (digit >= 1 && digit <= TILES.length) this.selectedTile = digit - 1;

        ACTIONS.get(event.code)?.(this);
    }

    // --- the course -------------------------------------------------------

    definition() {
        return { name: this.courseName, signs: this.signs, rows: gridToRows(this.grid) };
    }

    save() {
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.definition()));
    }

    resize(direction) {
        this.gridWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, this.gridWidth + direction * 2));
        this.grid = rowsToGrid(gridToRows(this.grid), this.gridWidth);
        this.save();
    }

    rename() {
        this.courseName = (prompt('Course name', this.courseName) || this.courseName).toUpperCase();
        this.save();
    }

    editSigns() {
        const written = prompt('Sign lines, one per line, in the order they are walked past',
            this.signs.join('\n'));
        if (written !== null) this.signs = written.split('\n').map((line) => line.trim()).filter(Boolean);
        this.save();
    }

    clear() {
        this.grid = rowsToGrid([], this.gridWidth);
        this.save();
        this.notice = 'cleared';
    }

    loadFromGame() {
        const asked = prompt(`Which course? 1 to ${LEVELS.length}`, '1');
        const level = LEVELS[Number(asked) - 1];
        if (!level) return;

        this.load({ name: level.levelTitle, signs: level.signs || [], rows: level.tileRows });
        this.notice = `loaded ${level.levelTitle}`;
    }

    importPasted() {
        const pasted = prompt('Paste a level literal, or a whole levels.js');
        if (!pasted) return;

        try {
            const [first] = parseLevelSource(pasted);
            if (first) this.load(first);
            this.notice = 'imported';
        } catch (error) {
            this.notice = `could not read that: ${error.message}`;
        }
    }

    load({ name, signs, rows }) {
        this.courseName = name || 'UNTITLED';
        this.signs = signs || [];
        this.gridWidth = widthOf(rows);
        this.grid = rowsToGrid(rows, this.gridWidth);
        this.save();
    }

    /**
     * Prints the course the way `src/levels/levels.js` writes one, ready to
     * paste. It goes to the clipboard where the browser allows it, and to the
     * console always, because a copy that silently did not happen is worse than
     * one you have to go and fetch.
     */
    exportToClipboard() {
        const text = formatLevel(this.definition());
        console.log(text);
        navigator.clipboard?.writeText(text).then(
            () => { this.notice = 'copied, and printed to the console'; },
            () => { this.notice = 'printed to the console'; },
        );
        this.notice = 'printed to the console';
    }

    /**
     * Plays the course. It is appended to LEVELS the first time and rewritten in
     * place after that, so a playtest goes through exactly the same path a
     * shipped course does - the same builder, the same retry, the same clearing.
     */
    playCourse() {
        const { name, signs, rows } = this.definition();
        if (!rows.join('').includes('P')) {
            this.notice = 'no start tile: press 4 and put a P down';
            return;
        }

        this.levelIndex ??= LEVELS.length;
        LEVELS[this.levelIndex] = { levelTitle: name, signs, tileRows: rows };
        pushScreen(new GameplayScreen(this.levelIndex));
    }

    // --- drawing ----------------------------------------------------------

    render() {
        const context = canvasContext;
        const cell = this.cellSize;
        const left = this.gridLeft;

        context.fillStyle = '#16112a';
        context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        for (let row = 0; row < LEVEL_ROW_COUNT; row++) {
            for (let column = 0; column < this.gridWidth; column++) {
                this.drawCell(row, column, left + column * cell, GRID_TOP + row * cell, cell);
            }
        }

        this.drawGridLines(left, cell);
        if (this.showGuides && this.hover) this.drawGuides(left, cell);

        this.drawChrome();
    }

    drawCell(row, column, x, y, cell) {
        const context = canvasContext;
        const character = this.grid[row][column];
        const tile = TILES.find((candidate) => candidate.character === character) ?? TILES[0];

        // The bottom row is shaded, because it is the one row a course always
        // has and the thing everything else is measured up from.
        context.fillStyle = character === '.' ? (row === LEVEL_ROW_COUNT - 1 ? '#241c38' : '#2b2140') : tile.tileColor;

        if (character === '=') {
            context.fillRect(x, y, cell, cell);
            return;
        }

        if ('PGMW!'.includes(character)) {
            context.fillStyle = '#2b2140';
            context.fillRect(x, y, cell, cell);
            context.fillStyle = tile.tileColor;
            context.beginPath();
            context.arc(x + cell / 2, y + cell / 2, cell * 0.32, 0, Math.PI * 2);
            context.fill();
            return;
        }

        context.fillRect(x, y, cell, cell);

        // Solid ground gets the lit top edge the game draws, so a ledge reads as
        // a ledge at a glance rather than as a block of colour.
        if (character === '#' && (row === 0 || this.grid[row - 1][column] !== '#')) {
            context.fillStyle = '#5ad6c8';
            context.fillRect(x, y, cell, 2);
        }
    }

    drawGridLines(left, cell) {
        const context = canvasContext;
        const bottom = GRID_TOP + LEVEL_ROW_COUNT * cell;
        const right = left + this.gridWidth * cell;

        context.strokeStyle = '#ffffff14';
        context.lineWidth = 1;
        context.beginPath();
        for (let column = 0; column <= this.gridWidth; column++) {
            context.moveTo(left + column * cell + 0.5, GRID_TOP);
            context.lineTo(left + column * cell + 0.5, bottom);
        }
        for (let row = 0; row <= LEVEL_ROW_COUNT; row++) {
            context.moveTo(left, GRID_TOP + row * cell + 0.5);
            context.lineTo(right, GRID_TOP + row * cell + 0.5);
        }
        context.stroke();
    }

    drawGuides(left, cell) {
        const context = canvasContext;
        const x = left + (this.hover.column + 0.5) * cell;
        const y = GRID_TOP + (this.hover.row + 0.5) * cell;

        context.save();
        context.lineWidth = 2;

        for (const { across, up, guideColor, label } of GUIDES) {
            context.strokeStyle = guideColor;
            context.setLineDash([5, 4]);
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(x + across * cell, y - up * cell);
            context.stroke();

            drawText(label, x + across * cell + 8, y - up * cell, {
                typeSize: 13, typeWeight: 700, alignment: 'left', inkColor: guideColor,
            });
        }

        context.restore();
    }

    drawChrome() {
        const signMarks = this.grid.flat().filter((character) => character === '!').length;
        const signsAgree = signMarks === this.signs.length;

        drawText(`${this.courseName}`, 24, 30, {
            typeSize: 22, typeWeight: 900, typeSpacing: 2, alignment: 'left', inkColor: BRIGHT,
        });

        drawText(`${this.gridWidth} wide   -   ${signMarks} sign${signMarks === 1 ? '' : 's'} drawn, `
            + `${this.signs.length} written`, CANVAS_WIDTH - 24, 30, {
            typeSize: 15, typeWeight: 700, typeSpacing: 1, alignment: 'right',
            inkColor: signsAgree ? DIM : '#ff5fa2',
        });

        // The palette, along the top, in the order the number keys pick it.
        TILES.forEach((tile, index) => {
            const x = 24 + index * 152;
            const isSelected = index === this.selectedTile;

            canvasContext.fillStyle = tile.tileColor;
            canvasContext.fillRect(x, 54, 18, 18);

            drawText(`${index + 1} ${tile.label}`, x + 26, 64, {
                typeSize: 14, typeWeight: isSelected ? 900 : 600, typeSpacing: 1,
                alignment: 'left', inkColor: isSelected ? BRIGHT : DIM,
            });
        });

        const hints = 'DRAG paint   RIGHT-DRAG erase   1-8 tile   [ ] width   N name   S signs'
            + '\nL load a course   I import   E export   X clear   G guides   ENTER play   ` back here';

        hints.split('\n').forEach((line, index) => {
            drawText(line, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 64 + index * 24, {
                typeSize: 14, typeWeight: 600, typeSpacing: 1, inkColor: DIM,
            });
        });

        if (this.notice) {
            drawText(this.notice, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 100, {
                typeSize: 15, typeWeight: 800, typeSpacing: 1, inkColor: '#ffd93d',
            });
        }
    }
}

/** Wide enough for the longest row, and a sensible blank canvas when there is none. */
function widthOf(rows) {
    return rows.length ? Math.max(MIN_WIDTH, ...rows.map((row) => row.length)) : DEFAULT_WIDTH;
}

/** Whatever was being drawn when the page last closed, or an empty course. */
function load() {
    try {
        const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
        if (saved?.rows) return { name: saved.name || 'UNTITLED', signs: saved.signs || [], rows: saved.rows };
    } catch {
        // A corrupt draft is not worth a crash on the way into the editor.
    }
    return { name: 'UNTITLED', signs: [], rows: [] };
}
