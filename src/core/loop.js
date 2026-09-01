/**
 * The game loop.
 *
 * Variable timestep, clamped at both ends. The ceiling stops a long stall
 * (alt-tab, a GC pause) advancing the simulation far enough to tunnel through
 * terrain. The floor matters just as much and is far less obvious: a rAF
 * timestamp is the *start* of the frame it belongs to, and the frame that was
 * already in progress while the packed payload unpacked itself began before
 * `startGameLoop` ever read the clock. That makes the very first delta
 * negative - by two seconds on a slow load - and a negative delta runs every
 * `damp` in the game backwards, away from its target instead of towards it.
 * One frame of that was enough to inflate the unicorn's breathing to a radius
 * of -500 and throw `IndexSizeError` out of the canvas.
 */

import { MAX_FRAME_SECONDS } from '../config.js';
import { beginFrame } from './canvas.js';
import { clearFrameInput } from './input.js';
import { clamp } from './math.js';

/** Frame durations of the last second, kept for the debug FPS readout. */
export const recentFrameDurations = [];

export function startGameLoop(updateAndRender) {
    let previousTimestamp = performance.now();

    function runFrame(timestamp) {
        requestAnimationFrame(runFrame);

        const elapsedSeconds = clamp((timestamp - previousTimestamp) / 1000, 0, MAX_FRAME_SECONDS);
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
