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
 *
 * E opens this and E comes back to it - from the title, from the middle of the
 * test run, from a pause menu, from the ending. ENTER starts the test run. Those
 * two keys are the whole loop, and neither of them can leave you stuck in the
 * other place. The key itself lives in `debug.js` rather than here, because it
 * has to work before there is an editor to press it in.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH, TILE_SIZE } from './config.js';
import { canvas, canvasContext } from './core/canvas.js';
import { sin } from './core/math.js';
import { drawFourPointStar } from './engine/particles.js';
import { refreshPalette, setColorRestoration } from './graphics/palette.js';
import { renderSky } from './graphics/sky.js';
import { drawText } from './graphics/typography.js';
import { buildLevelWorld } from './levels/build-level.js';
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
    ['KeyC', (editor) => editor.exportToClipboard()],
    ['KeyG', (editor) => { editor.showGuides = !editor.showGuides; }],
    ['KeyX', (editor) => editor.clear()],
    ['Enter', (editor) => editor.playCourse()],
    ['Escape', () => resetScreens(new TitleScreen())],
]);

/** The band of screen the course is framed into, between the two rows of chrome. */
const VIEW_TOP = 88;
const VIEW_BOTTOM = 640;

const MIN_WIDTH = 8;
const MAX_WIDTH = 120;
/** What a fresh course starts at: about the width the shipped ones settled on. */
const DEFAULT_WIDTH = 42;

const BRIGHT = '#fdf7ff';
const DIM = '#e9dcffaa';

export class EditorScreen extends Screen {
    selectedTile = 1;
    /** Set by every edit; the preview is rebuilt once a frame, not once a stroke. */
    isDirty = true;
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
        // because the editor has to answer the pointer. The way back into the
        // editor is not here: E is handled in debug.js, which is what lets it
        // work before an editor has ever been opened.
        addEventListener('pointerdown', (event) => this.onPointerDown(event));
        addEventListener('pointermove', (event) => this.onPointerMove(event));
        addEventListener('pointerup', () => { this.painting = null; });
        addEventListener('contextmenu', (event) => { if (this.isOnTop()) event.preventDefault(); });
        addEventListener('keydown', (event) => this.onKeyDown(event));
    }

    isOnTop() {
        return topScreen() === this;
    }

    /**
     * The zoom that fits the whole course into the band between the two rows of
     * chrome. It is the same number the game's own whole-course view works out,
     * for the same reason: a course is a thing you should be able to see all of.
     */
    get viewZoom() {
        return Math.min(
            CANVAS_WIDTH / (this.gridWidth * TILE_SIZE),
            (VIEW_BOTTOM - VIEW_TOP) / (LEVEL_ROW_COUNT * TILE_SIZE),
        );
    }

    /**
     * Where the camera sits so that the course lands centred in that band.
     *
     * `applyTransform` anchors on the middle of the canvas, and the middle of
     * the band is a few pixels above it, so the difference is added back in
     * world units - which is what `/ zoom` is doing.
     */
    get viewCentre() {
        const zoom = this.viewZoom;
        return {
            x: this.gridWidth * TILE_SIZE / 2,
            y: LEVEL_ROW_COUNT * TILE_SIZE / 2 + (CANVAS_HEIGHT / 2 - (VIEW_TOP + VIEW_BOTTOM) / 2) / zoom,
        };
    }

    // --- input ------------------------------------------------------------

    /**
     * Where in the grid a pointer event landed, or null if it missed.
     *
     * The inverse of `Camera.applyTransform`: undo the canvas letterboxing to
     * get canvas pixels, undo the camera to get world units, and divide by the
     * tile size. Doing it this way rather than against a grid of the editor's
     * own means the tile under the pointer is the tile under the pointer in the
     * picture, whatever the zoom works out to.
     */
    cellAt(event) {
        const bounds = canvas.getBoundingClientRect();
        const zoom = this.viewZoom;
        const centre = this.viewCentre;

        const canvasX = (event.clientX - bounds.left) / bounds.width * CANVAS_WIDTH;
        const canvasY = (event.clientY - bounds.top) / bounds.height * CANVAS_HEIGHT;

        const column = Math.floor(((canvasX - CANVAS_WIDTH / 2) / zoom + centre.x) / TILE_SIZE);
        const row = Math.floor(((canvasY - CANVAS_HEIGHT / 2) / zoom + centre.y) / TILE_SIZE);

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
        if (!this.isOnTop()) return;

        const digit = Number(event.key);
        if (digit >= 1 && digit <= TILES.length) this.selectedTile = digit - 1;

        ACTIONS.get(event.code)?.(this);
    }

    // --- the course -------------------------------------------------------

    definition() {
        return { name: this.courseName, signs: this.signs, rows: gridToRows(this.grid) };
    }

    /**
     * Keeps the draft as `[name, signs, rows]` rather than as an object.
     *
     * A property name is something the mangler renames and a position is not,
     * so an object draft written by the debug build reads back with half its
     * fields missing in the mangled one - `signs` came back as `yt`. Three
     * values in a known order mean nothing about the build is baked into what
     * is on disk.
     */
    save() {
        this.isDirty = true;
        const { name, signs, rows } = this.definition();
        localStorage.setItem(SAVE_KEY, JSON.stringify([name, signs, rows]));
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

    /**
     * Rebuilds the preview world, which is what makes this look like the game
     * rather than like a spreadsheet.
     *
     * It goes through `buildLevelWorld`, the same function a shipped course goes
     * through, so the terrain, the lava, the Gloom, the gate, the signs and the
     * unicorn on its start tile are all the real ones drawn by the real code. It
     * is never updated, only rendered: a frozen world is exactly what a level
     * drawing wants to be, and it means nothing falls, patrols or dies while you
     * are looking at it.
     *
     * Built from the untrimmed grid rather than the authored rows, so that the
     * course's bounds always match the grid the pointer is being mapped onto -
     * trimming a course's empty right-hand columns is right for the file and
     * wrong for the thing you are painting on.
     */
    rebuildPreview() {
        this.isDirty = false;

        const rows = this.grid.map((cells) => cells.join(''));
        // A course with no start tile cannot be built - the camera has nothing
        // to snap to - so the last good picture is kept and the notice says why.
        if (!rows.join('').includes('P')) return;

        const signMarks = this.grid.flat().filter((character) => character === '!').length;
        const signs = Array.from({ length: signMarks }, (_, index) => this.signs[index] ?? '...');

        this.preview = buildLevelWorld({ levelTitle: this.courseName, signs, tileRows: rows });
    }

    updateStep(elapsedSeconds) {
        super.updateStep(elapsedSeconds);
        if (this.isDirty) this.rebuildPreview();
    }

    render() {
        const context = canvasContext;

        // The meadow as it will be played: fully restored, because a course is
        // drawn in the colour it is meant to end in.
        setColorRestoration(1);
        refreshPalette();

        const zoom = this.viewZoom;
        const centre = this.viewCentre;

        if (this.preview) {
            const { camera } = this.preview.world;
            camera.viewZoom = zoom;
            camera.x = camera.shownX = centre.x;
            camera.y = camera.shownY = centre.y;

            renderSky(camera, this.age);
            this.preview.world.render();
        } else {
            context.fillStyle = '#16112a';
            context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        this.drawOverlay(zoom, centre);
        this.drawChrome();
    }

    /**
     * The grid and the cursor, drawn in world space over the picture.
     *
     * Everything here is inside the camera transform, so a tile outline is a
     * tile whatever the zoom, and the line widths are divided by the zoom to
     * come out the same weight on screen at any course width.
     */
    drawOverlay(zoom, centre) {
        const context = canvasContext;
        const right = this.gridWidth * TILE_SIZE;
        const bottom = LEVEL_ROW_COUNT * TILE_SIZE;

        context.save();
        context.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        context.scale(zoom, zoom);
        context.translate(-centre.x, -centre.y);

        context.lineWidth = 1 / zoom;
        context.strokeStyle = '#ffffff1c';
        context.beginPath();
        for (let column = 0; column <= this.gridWidth; column++) {
            context.moveTo(column * TILE_SIZE, 0);
            context.lineTo(column * TILE_SIZE, bottom);
        }
        for (let row = 0; row <= LEVEL_ROW_COUNT; row++) {
            context.moveTo(0, row * TILE_SIZE);
            context.lineTo(right, row * TILE_SIZE);
        }
        context.stroke();

        if (this.hover) {
            if (this.showGuides) this.drawGuides(zoom);
            this.drawCursor(zoom);
        }

        context.restore();

        // The bands the chrome sits in, painted over the picture rather than
        // beside it. The course is framed between them, and the lava that spills
        // out under the bottom row of tiles is covered rather than fought with.
        context.fillStyle = '#16112aec';
        context.fillRect(0, 0, CANVAS_WIDTH, VIEW_TOP);
        context.fillRect(0, VIEW_BOTTOM, CANVAS_WIDTH, CANVAS_HEIGHT - VIEW_BOTTOM);

        // The guide labels, in screen space so they stay readable however far
        // the course is zoomed out. Their ends are projected out of world space
        // with the same transform the picture was drawn with.
        if (this.hover && this.showGuides) {
            for (const { across, up, guideColor, label } of GUIDES) {
                const worldX = (this.hover.column + 0.5 + across) * TILE_SIZE;
                const worldY = (this.hover.row + 0.5 - up) * TILE_SIZE;

                drawText(label, CANVAS_WIDTH / 2 + (worldX - centre.x) * zoom + 8,
                    CANVAS_HEIGHT / 2 + (worldY - centre.y) * zoom, {
                        typeSize: 13, typeWeight: 800, alignment: 'left', inkColor: guideColor,
                    });
            }
        }
    }

    /**
     * The character you play as in here: a star hovering over the tile it is
     * about to paint, in the colour of whatever is loaded into it.
     *
     * The unicorn is in the picture too, standing on its start tile where the
     * player will begin - it is part of the course, not part of you.
     */
    drawCursor(zoom) {
        const context = canvasContext;
        const tile = TILES[this.selectedTile];
        const x = (this.hover.column + 0.5) * TILE_SIZE;
        const y = (this.hover.row + 0.5) * TILE_SIZE;

        context.strokeStyle = tile.tileColor;
        context.lineWidth = 2 / zoom;
        context.strokeRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);

        context.globalAlpha = 0.85;
        context.fillStyle = tile.tileColor;
        drawFourPointStar(context, x, y - TILE_SIZE * 0.9 - sin(this.age * 3) * 3,
            TILE_SIZE * 0.3, this.age * 2);
        context.globalAlpha = 1;
    }

    /**
     * The three distances every course in this game is built out of, drawn from
     * the tile under the cursor. Sketching a gap and then checking it against
     * these is the whole job of laying a course out - and now they are drawn
     * over the course itself, at the scale the course is really in.
     */
    drawGuides(zoom) {
        const context = canvasContext;
        const x = (this.hover.column + 0.5) * TILE_SIZE;
        const y = (this.hover.row + 0.5) * TILE_SIZE;

        context.save();
        context.lineWidth = 2 / zoom;
        context.setLineDash([6 / zoom, 5 / zoom]);

        for (const { across, up, guideColor } of GUIDES) {
            context.strokeStyle = guideColor;
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(x + across * TILE_SIZE, y - up * TILE_SIZE);
            context.stroke();
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

        if (!this.preview) {
            drawText('place a start tile - press 4 and click', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, {
                typeSize: 20, typeWeight: 800, typeSpacing: 2, inkColor: '#ffd93d',
            });
        }

        const hints = 'DRAG paint   RIGHT-DRAG erase   1-8 tile   [ ] width   N name   S signs'
            + '\nL load a course   I import   C copy   X clear   G guides   ENTER test run   E back here';

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
        const [name, signs, rows] = JSON.parse(localStorage.getItem(SAVE_KEY));
        if (rows) return { name: name || 'UNTITLED', signs: signs || [], rows };
    } catch {
        // A corrupt draft, or one in the old shape, is not worth a crash on the
        // way into the editor. An empty course is a fine thing to fall back to.
    }
    return { name: 'UNTITLED', signs: [], rows: [] };
}
