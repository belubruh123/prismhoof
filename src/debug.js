/**
 * Debug-only tooling. None of this reaches the release build.
 *
 * Every entry point is called from inside an `if (DEBUG)` block, and DEBUG is a
 * compile-time constant, so esbuild eliminates those calls and then drops this
 * whole module as unreachable.
 *
 * The hash options let a headless browser drive the game deterministically,
 * which is how the animation and the level geometry get checked:
 *
 *   #screen=howto            jump straight to a screen
 *   #level=3                 start a run at a given level
 *   #hold=ArrowRight,KeyJ    hold keys down from the start
 *   #seq=Space:60,-KeyJ:90   press and release keys at given warm-up steps
 *   #warm=180                step the simulation before the first frame
 *   #zoom=3                  camera zoom, for inspecting the character
 */

import { CANVAS_HEIGHT } from './config.js';
import { canvasContext } from './core/canvas.js';
import { clearFrameInput } from './core/input.js';
import { recentFrameDurations } from './core/loop.js';
import { GameplayScreen } from './screens/gameplay-screen.js';
import { HowToPlayScreen } from './screens/how-to-play-screen.js';
import { pushScreen, resetScreens, topScreen, updateScreens } from './screens/screen.js';
import { SettingsScreen } from './screens/settings-screen.js';

const options = new URLSearchParams(location.hash.slice(1));

const SCREEN_SHORTCUTS = new Map([
    ['howto', () => pushScreen(new HowToPlayScreen())],
    ['settings', () => pushScreen(new SettingsScreen())],
    ['play', () => resetScreens(new GameplayScreen(parseInt(options.get('level')) || 0))],
]);

/**
 * Steps the game at a fixed timestep before the first frame is drawn.
 *
 * Deterministic, and independent of how the browser schedules animation frames,
 * which a headless screenshot has almost no control over.
 */
export function runDebugWarmUp() {
    SCREEN_SHORTCUTS.get(options.get('screen'))?.();

    const levelIndex = parseInt(options.get('level'));
    if (levelIndex >= 0 && !options.get('screen')) resetScreens(new GameplayScreen(levelIndex));

    for (const code of (options.get('hold') || '').split(',').filter(Boolean)) {
        dispatchEvent(new KeyboardEvent('keydown', { code }));
    }

    const scriptedKeys = (options.get('seq') || '').split(',').filter(Boolean).map((entry) => {
        const [rawCode, atStep] = entry.split(':');
        return {
            code: rawCode.replace(/^-/, ''),
            type: rawCode.startsWith('-') ? 'keyup' : 'keydown',
            step: parseInt(atStep),
        };
    });

    const warmUpSteps = parseInt(options.get('warm')) || 0;
    const zoom = parseFloat(options.get('zoom'));

    for (let step = 0; step < warmUpSteps; step++) {
        for (const key of scriptedKeys) {
            if (key.step === step) dispatchEvent(new KeyboardEvent(key.type, { code: key.code }));
        }

        updateScreens(1 / 60);
        applyDebugZoom(zoom);
        countRibbonFrames();
        clearFrameInput();
    }
}

/**
 * Warm-up steps spent standing on a painted rainbow, reported in the overlay.
 *
 * Whether the unicorn stays on its own arc is a question about a span of time,
 * and a screenshot only shows an instant, so it is counted here and read back
 * off a single frame instead of hunting for the right one.
 */
let framesOnRibbon = 0;

function countRibbonFrames() {
    const unicorn = topScreen()?.unicorn;
    if (unicorn?.ribbonUnderfoot) framesOnRibbon++;
}

function applyDebugZoom(zoom) {
    if (!zoom) return;
    const world = topScreen()?.world || topScreen()?.scene?.world;
    if (world) world.camera.zoom = zoom;
}

/** A single line of state, top-left, over everything. */
export function renderDebugOverlay(elapsedSeconds) {
    applyDebugZoom(parseFloat(options.get('zoom')));

    const averageFrame = recentFrameDurations.reduce((sum, value) => sum + value, 0)
        / (recentFrameDurations.length || 1);

    const screen = topScreen();
    const unicorn = screen?.unicorn || screen?.scene?.unicorn;

    const parts = [`fps ${(1 / (averageFrame || elapsedSeconds || 1)).toFixed(0)}`];

    if (screen?.level) {
        parts.push(
            screen.level.name,
            `gloom ${screen.world.entitiesOfCategory('gloom').length}/${screen.level.gloomTotal}`,
            `ribbons ${screen.world.entitiesOfCategory('ribbon').length}`,
            `deaths ${screen.deaths}`,
            `lvl ${screen.levelIndex + 1}`,
        );
    }

    if (unicorn) {
        parts.push(
            `paint ${unicorn.paintEnergy.toFixed(2)}`,
            `ground ${unicorn.isOnGround ? 1 : 0}`,
            `onRibbon ${unicorn.ribbonUnderfoot ? 1 : 0}/${framesOnRibbon}`,
            unicorn.isDead ? 'DEAD' : '',
        );
    }

    canvasContext.save();
    canvasContext.fillStyle = '#0af';
    canvasContext.font = '13px monospace';
    canvasContext.textAlign = 'left';
    canvasContext.textBaseline = 'alphabetic';
    canvasContext.fillText(parts.filter(Boolean).join('  '), 12, CANVAS_HEIGHT - 12);
    canvasContext.restore();
}
