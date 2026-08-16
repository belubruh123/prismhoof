/**
 * The parallax backdrop: gradient sky, stars, three ranges of hills and
 * drifting clouds.
 *
 * All of it is drawn in screen space. Parallax comes from offsetting the shapes
 * by a fraction of the camera position rather than from moving real entities,
 * which means the backdrop costs the same no matter how large the level is.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { createSeededRandom, sin, TAU } from '../core/math.js';
import { HILL_FAR, HILL_MIDDLE, HILL_NEAR, getColorRestoration, palette, restoredColor } from './palette.js';
import { starTexture } from './textures.js';

/** Horizontal resolution of the hill silhouettes, in screen pixels per step. */
const HILL_STEP = 22;

const HILL_LAYERS = [
    { color: HILL_FAR, parallax: 0.06, baseRatio: 0.62, amplitude: 34, frequency: 0.0016, phase: 0 },
    { color: HILL_MIDDLE, parallax: 0.14, baseRatio: 0.74, amplitude: 48, frequency: 0.0023, phase: 2.1 },
    { color: HILL_NEAR, parallax: 0.28, baseRatio: 0.88, amplitude: 62, frequency: 0.0031, phase: 4.7 },
];

/** Fixed cloud layout, generated once so the sky is stable across frames. */
const CLOUDS = (() => {
    const random = createSeededRandom(3312);
    return Array.from({ length: 14 }, () => ({
        x: random() * 2600,
        y: random() * 260 + 40,
        scale: random() * 0.7 + 0.5,
        driftSpeed: random() * 7 + 3,
        parallax: random() * 0.1 + 0.04,
        puffSeed: random() * 100,
    }));
})();

let skyGradient = null;
let skyGradientRestoration = -1;

function getSkyGradient(context) {
    const restoration = getColorRestoration();
    // The gradient only needs rebuilding when the restoration level actually moved.
    if (skyGradient && Math.abs(restoration - skyGradientRestoration) < 0.004) return skyGradient;

    skyGradientRestoration = restoration;
    skyGradient = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    skyGradient.addColorStop(0, palette.skyTop);
    skyGradient.addColorStop(0.55, palette.skyMiddle);
    skyGradient.addColorStop(1, palette.skyBottom);
    return skyGradient;
}

export function renderSky(camera, timeSeconds) {
    const context = canvasContext;

    context.fillStyle = getSkyGradient(context);
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    renderStars(context, camera, timeSeconds);

    for (const layer of HILL_LAYERS) renderHillLayer(context, camera, layer);

    renderClouds(context, camera, timeSeconds);
}

/** Stars belong to the Gloom - they fade out as the colour comes back. */
function renderStars(context, camera, timeSeconds) {
    const visibility = 1 - getColorRestoration();
    if (visibility <= 0.01) return;

    const offsetX = -camera.x * 0.02 % starTexture.width;
    const offsetY = -camera.y * 0.02 % starTexture.height;

    context.save();
    context.globalAlpha = visibility * (0.55 + 0.12 * sin(timeSeconds * 1.7));
    context.fillStyle = starTexture;
    context.translate(offsetX, offsetY);
    context.fillRect(-offsetX, -offsetY, CANVAS_WIDTH, CANVAS_HEIGHT * 0.8);
    context.restore();
}

function renderHillLayer(context, camera, { color, parallax, baseRatio, amplitude, frequency, phase }) {
    const offsetX = camera.x * parallax;
    const offsetY = camera.y * parallax * 0.4;
    const baseY = CANVAS_HEIGHT * baseRatio - offsetY;

    context.fillStyle = restoredColor(color);
    context.beginPath();
    context.moveTo(-HILL_STEP, CANVAS_HEIGHT);

    for (let screenX = -HILL_STEP; screenX <= CANVAS_WIDTH + HILL_STEP; screenX += HILL_STEP) {
        const worldX = screenX + offsetX;
        const height = sin(worldX * frequency + phase) * amplitude
            + sin(worldX * frequency * 2.7 + phase * 1.9) * amplitude * 0.35
            + sin(worldX * frequency * 0.4 + phase * 0.6) * amplitude * 0.7;
        context.lineTo(screenX, baseY + height);
    }

    context.lineTo(CANVAS_WIDTH + HILL_STEP, CANVAS_HEIGHT);
    context.fill();
}

function renderClouds(context, camera, timeSeconds) {
    const wrapWidth = CANVAS_WIDTH + 600;

    for (const cloud of CLOUDS) {
        const drift = timeSeconds * cloud.driftSpeed;
        // Wrap into a band a little wider than the screen so clouds enter and leave smoothly.
        const screenX = ((cloud.x + drift - camera.x * cloud.parallax) % wrapWidth + wrapWidth) % wrapWidth - 300;
        const screenY = cloud.y - camera.y * cloud.parallax * 0.5;

        if (screenX < -280 || screenX > CANVAS_WIDTH + 280) continue;

        drawCloud(context, screenX, screenY, cloud.scale, cloud.puffSeed);
    }
}

/** A flat vector cloud: a run of overlapping circles with a shaded underside. */
function drawCloud(context, x, y, scale, seed) {
    const puffCount = 5;

    /** The silhouette is drawn twice, offset, to give the cloud a shaded underside. */
    const tracePuffs = (offsetY) => {
        context.beginPath();
        for (let index = 0; index < puffCount; index++) {
            const puffX = (index - (puffCount - 1) / 2) * 44;
            const radius = 30 + sin(seed + index * 2.3) * 12;
            context.moveTo(puffX + radius, offsetY);
            context.arc(puffX, offsetY, radius, 0, TAU);
        }
        context.fill();
    };

    context.save();
    context.translate(x, y);
    context.scale(scale, scale);

    context.fillStyle = palette.cloudShade;
    tracePuffs(8);

    context.fillStyle = palette.cloud;
    tracePuffs(0);

    context.restore();
}
