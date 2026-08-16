/**
 * A pre-rendered tiling texture, and the soft glow used all over the game.
 *
 * The star field is drawn once into a small offscreen canvas and turned into a
 * repeating CanvasPattern, which costs almost nothing per frame compared to
 * generating the detail live. It is white-on-transparent, so it can be tinted by
 * whatever it is laid over.
 */

import { createOffscreenCanvas } from '../core/canvas.js';
import { createSeededRandom, TAU } from '../core/math.js';

function createPattern(width, height, renderCallback) {
    const textureCanvas = createOffscreenCanvas(width, height, renderCallback);
    const pattern = textureCanvas.getContext('2d').createPattern(textureCanvas, 'repeat');
    pattern.width = width;
    pattern.height = height;
    return pattern;
}

/** Distant stars. Only visible while the Gloom still holds the sky. */
export const starTexture = createPattern(256, 256, (context) => {
    const random = createSeededRandom(2255);
    context.fillStyle = '#fff';
    for (let index = 0; index < 90; index++) {
        const x = random() * 256;
        const y = random() * 256;
        const radius = random() * 1.5 + 0.5;
        context.globalAlpha = random() * 0.8 + 0.2;
        context.beginPath();
        context.arc(x, y, radius, 0, TAU);
        context.fill();
    }
});

/** A soft radial glow, for the horn, pickups and the gate. */
export function drawRadialGlow(context, x, y, radius, color, alpha = 1) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    context.restore();
}
