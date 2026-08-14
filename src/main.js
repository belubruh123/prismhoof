/**
 * PRISMHOOF - entry point.
 *
 * Boots the canvas, wires up input, and starts the game loop.
 */

import { canvasContext, initialiseCanvas } from './core/canvas.js';
import { initialiseInput } from './core/input.js';
import { startGameLoop } from './core/loop.js';
import { Terrain } from './entities/terrain.js';
import { ParticleField } from './engine/particles.js';
import { World } from './engine/world.js';
import { refreshPalette, setColorRestoration } from './graphics/palette.js';
import { renderSky } from './graphics/sky.js';
import { parseLevel } from './levels/level-format.js';
import { TILE_SIZE } from './config.js';

initialiseCanvas();
initialiseInput();

// --- temporary environment sandbox (replaced by the screen stack in phase 7) ---

const sandboxLevel = parseLevel({
    name: 'SANDBOX',
    rows: [
        '..............................',
        '..............................',
        '..............................',
        '...........===................',
        '..............................',
        '.....===......................',
        '....................===.......',
        '..............................',
        '..###.........................',
        '..###......####...............',
        '..###......####........###....',
        '################...###########',
        '################...###########',
    ],
});

const world = new World();
const terrain = world.addEntity(new Terrain(sandboxLevel.tileGrid));
world.addEntity(new ParticleField());

world.boundsLeft = 0;
world.boundsTop = 0;
world.boundsRight = terrain.widthInPixels;
world.boundsBottom = terrain.heightInPixels;

world.camera.snapTo(terrain.widthInPixels / 2, terrain.heightInPixels - TILE_SIZE * 5);

let elapsedTotal = 0;

/** `#r=0.5` pins the restoration level, so screenshots of it are reproducible. */
const pinnedRestoration = parseFloat(new URLSearchParams(location.hash.slice(1)).get('r'));

startGameLoop((elapsedSeconds) => {
    elapsedTotal += elapsedSeconds;

    const restoration = isNaN(pinnedRestoration)
        ? (Math.sin(elapsedTotal * 0.6) + 1) / 2
        : pinnedRestoration;
    setColorRestoration(restoration);
    refreshPalette();

    world.camera.x = terrain.widthInPixels / 2 + Math.sin(elapsedTotal * 0.4) * 260;
    world.update(elapsedSeconds);

    renderSky(world.camera, elapsedTotal);
    world.render();

    canvasContext.fillStyle = '#fff';
    canvasContext.font = '16px monospace';
    canvasContext.fillText(`environment sandbox - restoration ${restoration.toFixed(2)}`, 16, 26);
});
