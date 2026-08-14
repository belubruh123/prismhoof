/**
 * The game loop.
 *
 * Variable timestep with a hard clamp, so a long stall (alt-tab, a GC pause)
 * can never advance the simulation far enough to tunnel through terrain.
 */

import { MAX_FRAME_SECONDS } from '../config.js';
import { beginFrame } from './canvas.js';
import { clearFrameInput } from './input.js';
import { min } from './math.js';

/** Frame durations of the last second, kept for the debug FPS readout. */
export const recentFrameDurations = [];

export function startGameLoop(updateAndRender) {
    let previousTimestamp = performance.now();

    function runFrame(timestamp) {
        requestAnimationFrame(runFrame);

        const elapsedSeconds = min((timestamp - previousTimestamp) / 1000, MAX_FRAME_SECONDS);
        previousTimestamp = timestamp;

        if (DEBUG) {
            recentFrameDurations.push(elapsedSeconds);
            if (recentFrameDurations.length > 60) recentFrameDurations.shift();
        }

        beginFrame();
        updateAndRender(elapsedSeconds);
        clearFrameInput();
    }

    requestAnimationFrame(runFrame);
}
