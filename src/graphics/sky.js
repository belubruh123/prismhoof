/**
 * The sky seen through the level: a gradient and drifting clouds.
 *
 * All of it is drawn in screen space, and parallax comes from offsetting the
 * shapes by a fraction of the camera position rather than from moving real
 * entities, so the backdrop costs the same however large the level is.
 *
 * There are no distant hills, deliberately. A level is a chamber cut out of the
 * world (see `Terrain.renderSurroundingRock`), and a horizon inside a chamber
 * only fights the walls around it.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { createSeededRandom, sin, TAU } from '../core/math.js';
import { palette } from './palette.js';

/** Fixed cloud layout, generated once so the sky is stable across frames. */
const CLOUDS = (() => {
    const random = createSeededRandom(3312);
    return Array.from({ length: 14 }, () => ({
        x: random() * 2600,
        y: random() * 260 + 40,
        cloudScale: random() * 0.7 + 0.5,
        driftSpeed: random() * 7 + 3,
        parallax: random() * 0.1 + 0.04,
        puffSeed: random() * 100,
    }));
})();

export function renderSky(camera, timeSeconds) {
    const context = canvasContext;

    // Rebuilt every frame rather than cached. The palette shifts continuously as
    // the Gloom is purified, so a cached gradient needs an invalidation test,
    // and that test costs more bytes than three addColorStop calls cost frames.
    const gradient = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, palette.skyTop);
    gradient.addColorStop(0.55, palette.skyMiddle);
    gradient.addColorStop(1, palette.skyBottom);

    context.fillStyle = gradient;
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    renderClouds(context, camera, timeSeconds);
}

function renderClouds(context, camera, timeSeconds) {
    const wrapWidth = CANVAS_WIDTH + 600;

    for (const cloud of CLOUDS) {
        const drift = timeSeconds * cloud.driftSpeed;
        // Wrap into a band a little wider than the screen so clouds enter and leave smoothly.
        const screenX = ((cloud.x + drift - camera.x * cloud.parallax) % wrapWidth + wrapWidth) % wrapWidth - 300;
        const screenY = cloud.y - camera.y * cloud.parallax * 0.5;

        if (screenX < -280 || screenX > CANVAS_WIDTH + 280) continue;

        drawCloud(context, screenX, screenY, cloud.cloudScale, cloud.puffSeed);
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
