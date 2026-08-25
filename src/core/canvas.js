/**
 * Canvas setup and the letterbox resize.
 *
 * The game always draws in a fixed CANVAS_WIDTH x CANVAS_HEIGHT coordinate
 * space. The backing store is sized to the real pixels on screen and a uniform
 * scale transform bridges the two, so the vector art stays crisp on high-DPI
 * displays instead of being upscaled from a fixed 720p buffer.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH, MAX_RENDER_SCALE } from '../config.js';
import { min, round } from './math.js';

export let canvas;
export let canvasContext;

/** Backing-store pixels per world unit. Applied as the base transform each frame. */
export let renderScale = 1;

export function initialiseCanvas() {
    canvas = document.getElementById('game');
    canvasContext = canvas.getContext('2d');

    addEventListener('resize', resizeCanvas);
    resizeCanvas();
}

function resizeCanvas() {
    const aspectRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
    const windowAspectRatio = innerWidth / innerHeight;

    // Fit the 16:9 box inside the window, leaving black bars on the long axis.
    const displayWidth = windowAspectRatio > aspectRatio ? innerHeight * aspectRatio : innerWidth;
    const displayHeight = displayWidth / aspectRatio;

    const pixelRatio = min(devicePixelRatio || 1, MAX_RENDER_SCALE);
    renderScale = min((displayWidth * pixelRatio) / CANVAS_WIDTH, MAX_RENDER_SCALE);

    canvas.width = round(CANVAS_WIDTH * renderScale);
    canvas.height = round(CANVAS_HEIGHT * renderScale);

    // The element's own CSS size is the letterbox; the backing store above is
    // the real pixel count behind it.
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
}

/** Resets the transform to world space and clears the frame. */
export function beginFrame() {
    canvasContext.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    canvasContext.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

/** Runs `drawCallback` inside a save/restore pair, so it can transform freely. */
export function wrap(drawCallback) {
    canvasContext.save();
    drawCallback();
    canvasContext.restore();
}
