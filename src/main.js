/**
 * PRISMHOOF - entry point.
 *
 * Boots the canvas, wires up input, and starts the game loop.
 */

import { canvasContext, initialiseCanvas } from './core/canvas.js';
import { clearFrameInput, initialiseInput } from './core/input.js';
import { startGameLoop } from './core/loop.js';
import { Terrain } from './entities/terrain.js';
import { Unicorn } from './entities/unicorn.js';
import { ParticleField } from './engine/particles.js';
import { World } from './engine/world.js';
import { refreshPalette, setColorRestoration } from './graphics/palette.js';
import { renderSky } from './graphics/sky.js';
import { parseLevel } from './levels/level-format.js';
import { TILE_SIZE } from './config.js';

initialiseCanvas();
initialiseInput();

// --- temporary gameplay sandbox (replaced by the screen stack in phase 7) ---

const sandboxLevel = parseLevel({
    name: 'SANDBOX',
    rows: [
        '..........................................',
        '..........................................',
        '..........................................',
        '..................====....................',
        '..........................................',
        '...........===............................',
        '..........................................',
        '..P.......................................',
        '..........................................',
        '............................###...........',
        '............................###...........',
        '##########################################',
        '##########################################',
    ],
});

const world = new World();
const terrain = world.addEntity(new Terrain(sandboxLevel.tileGrid));
world.addEntity(new ParticleField());

const playerSpawn = sandboxLevel.spawns.find((spawn) => spawn.type === 'player');
const unicorn = world.addEntity(new Unicorn(playerSpawn.x, playerSpawn.y));

world.boundsLeft = 0;
world.boundsTop = 0;
world.boundsRight = terrain.widthInPixels;
world.boundsBottom = terrain.heightInPixels;

world.camera.target = unicorn;
world.camera.snapTo(unicorn.x, unicorn.y);
world.camera.zoom = parseFloat(new URLSearchParams(location.hash.slice(1)).get('zoom')) || 1;

// Debug hooks, so a headless screenshot can capture an exact pose:
//   #r=0.9&zoom=3&hold=ArrowRight&warm=120&jumpAt=100
// `warm` steps the simulation at a fixed timestep before the first frame is
// drawn, which is deterministic and does not depend on how the browser chooses
// to schedule animation frames.
const debugOptions = new URLSearchParams(location.hash.slice(1));
const pinnedRestoration = parseFloat(debugOptions.get('r'));

let elapsedTotal = 0;

if (DEBUG) {
    for (const code of (debugOptions.get('hold') || '').split(',').filter(Boolean)) {
        dispatchEvent(new KeyboardEvent('keydown', { code }));
    }

    const warmUpSteps = parseInt(debugOptions.get('warm')) || 0;
    const jumpAtStep = parseInt(debugOptions.get('jumpAt'));

    for (let step = 0; step < warmUpSteps; step++) {
        // Pressed at `jumpAt` and never released, so the rise is not cut short.
        if (step === jumpAtStep) dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));

        elapsedTotal += 1 / 60;
        world.update(1 / 60);
        clearFrameInput();
    }
}

startGameLoop((elapsedSeconds) => {
    elapsedTotal += elapsedSeconds;

    setColorRestoration(isNaN(pinnedRestoration) ? 0.35 : pinnedRestoration);
    refreshPalette();

    world.update(elapsedSeconds);

    renderSky(world.camera, elapsedTotal);
    world.render();

    canvasContext.fillStyle = '#fff';
    canvasContext.font = '15px monospace';
    canvasContext.fillText(
        `t:${elapsedTotal.toFixed(1)}  ground:${unicorn.isOnGround ? 1 : 0}`
        + `  vx:${unicorn.velocityX.toFixed(0)}  vy:${unicorn.velocityY.toFixed(0)}`,
        16, 26,
    );
});
