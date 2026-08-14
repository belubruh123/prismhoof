/**
 * PRISMHOOF - entry point.
 *
 * Boots the canvas, wires up input, and starts the game loop.
 */

import { initialiseAudio, resumeAudio } from './audio/audio.js';
import { startMusic } from './audio/music.js';
import { canvasContext, initialiseCanvas } from './core/canvas.js';
import { clearFrameInput, initialiseInput, onKeyGesture } from './core/input.js';
import { startGameLoop } from './core/loop.js';
import { clamp, damp } from './core/math.js';
import { refreshPalette, setColorRestoration } from './graphics/palette.js';
import { renderSky } from './graphics/sky.js';
import { buildLevelWorld } from './levels/build-level.js';

initialiseCanvas();
initialiseInput();

// Browsers will not start an AudioContext without a trusted gesture, so audio
// setup is attempted on every key press until one of them is accepted.
onKeyGesture(() => {
    initialiseAudio();
    resumeAudio();
    startMusic(true);
});

// --- temporary gameplay sandbox (replaced by the screen stack in phase 7) ---

const level = buildLevelWorld({
    name: 'SANDBOX',
    rows: [
        '..........................................',
        '..........................................',
        '..........................................',
        '..........................................',
        '...............S..........................',
        '..........................................',
        '...................................W......',
        '..P.............M............T..........G.',
        '..........................................',
        '..........................................',
        '..........................................',
        '##########################################',
        '##########################################',
    ],
});

const { world, unicorn } = level;
let colorRestoration = 0;

const debugOptions = new URLSearchParams(location.hash.slice(1));
const pinnedRestoration = parseFloat(debugOptions.get('r'));

let elapsedTotal = 0;
let framesOnRibbon = 0;

world.camera.zoom = parseFloat(debugOptions.get('zoom')) || 1;

/** Advances the world one step and keeps the derived state in sync. */
function stepWorld(elapsedSeconds) {
    elapsedTotal += elapsedSeconds;

    // Colour comes back as the Gloom is purified. Damped rather than snapped,
    // so clearing one enemy is a visible bloom instead of a jump cut.
    const remainingGloom = world.entitiesOfCategory('gloom').length;
    const targetRestoration = level.gloomTotal ? 1 - remainingGloom / level.gloomTotal : 1;
    colorRestoration = damp(colorRestoration, targetRestoration, 3, elapsedSeconds);

    setColorRestoration(isNaN(pinnedRestoration) ? clamp(colorRestoration, 0.06, 1) : pinnedRestoration);
    refreshPalette();

    world.update(elapsedSeconds);
    if (unicorn.ribbonUnderfoot) framesOnRibbon++;
}

// Debug hooks, so a headless screenshot can capture an exact moment:
//   #r=0.9&zoom=3&hold=ArrowRight&warm=120&seq=Space:60,-ShiftLeft:90
// `warm` steps the simulation at a fixed timestep before the first frame is
// drawn, which is deterministic and does not depend on how the browser chooses
// to schedule animation frames.
if (DEBUG) {
    for (const code of (debugOptions.get('hold') || '').split(',').filter(Boolean)) {
        dispatchEvent(new KeyboardEvent('keydown', { code }));
    }

    const scriptedKeys = (debugOptions.get('seq') || '').split(',').filter(Boolean).map((entry) => {
        const [rawCode, atStep] = entry.split(':');
        return {
            code: rawCode.replace(/^-/, ''),
            type: rawCode.startsWith('-') ? 'keyup' : 'keydown',
            step: parseInt(atStep),
        };
    });

    const warmUpSteps = parseInt(debugOptions.get('warm')) || 0;
    for (let step = 0; step < warmUpSteps; step++) {
        for (const key of scriptedKeys) {
            if (key.step === step) dispatchEvent(new KeyboardEvent(key.type, { code: key.code }));
        }
        stepWorld(1 / 60);
        clearFrameInput();
    }
}

startGameLoop((elapsedSeconds) => {
    stepWorld(elapsedSeconds);

    renderSky(world.camera, elapsedTotal);
    world.render();

    canvasContext.fillStyle = '#fff';
    canvasContext.font = '15px monospace';
    canvasContext.fillText(
        `t:${elapsedTotal.toFixed(1)}  ground:${unicorn.isOnGround ? 1 : 0}`
        + `  paint:${unicorn.paintEnergy.toFixed(2)}`
        + `  gloom:${world.entitiesOfCategory('gloom').length}/${level.gloomTotal}`
        + `  dead:${unicorn.isDead ? 1 : 0}`
        + `  onRibbon:${framesOnRibbon}`,
        16, 26,
    );
});
