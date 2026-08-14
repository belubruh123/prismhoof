/**
 * Pre-rendered tiling textures.
 *
 * Each one is drawn once into a small offscreen canvas and turned into a
 * repeating CanvasPattern. Overlaying these at low alpha is what keeps the flat
 * vector art from looking like plain filled shapes, and it costs almost nothing
 * per frame compared to generating detail live.
 *
 * They are all white-on-transparent so the same texture can be tinted by
 * whatever it is laid over.
 */

import { createOffscreenCanvas } from '../core/canvas.js';
import { cos, createSeededRandom, sin, TAU } from '../core/math.js';

function createPattern(width, height, renderCallback) {
    const textureCanvas = createOffscreenCanvas(width, height, renderCallback);
    const pattern = textureCanvas.getContext('2d').createPattern(textureCanvas, 'repeat');
    pattern.width = width;
    pattern.height = height;
    return pattern;
}

/** Fine speckle. Laid over terrain so the rock reads as rough rather than flat. */
export const grainTexture = createPattern(128, 128, (context) => {
    const random = createSeededRandom(9137);
    context.fillStyle = '#fff';
    for (let index = 0; index < 460; index++) {
        const size = random() * 1.8 + 0.4;
        context.globalAlpha = random() * 0.6 + 0.2;
        context.fillRect(random() * 128, random() * 128, size, size);
    }
});

/** Soft overlapping blobs, used to break up the silhouette of clouds and Gloom. */
export const fluffTexture = createPattern(96, 96, (context) => {
    const random = createSeededRandom(7710);
    context.fillStyle = '#fff';
    for (let index = 0; index < 30; index++) {
        context.globalAlpha = random() * 0.25 + 0.08;
        context.beginPath();
        context.arc(random() * 96, random() * 96, random() * 16 + 5, 0, TAU);
        context.fill();
    }
});

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

/**
 * Diagonal light streaks. Scrolled along the rainbow ribbon each frame so the
 * paint looks like it is still flowing rather than sitting there as a stripe.
 */
export const shimmerTexture = createPattern(64, 64, (context) => {
    context.strokeStyle = '#fff';
    context.lineCap = 'round';
    for (let index = 0; index < 5; index++) {
        const offset = index * 13;
        context.globalAlpha = 0.1 + (index % 2) * 0.12;
        context.lineWidth = 2 + (index % 3);
        context.beginPath();
        context.moveTo(offset - 20, 70);
        context.lineTo(offset + 40, -6);
        context.stroke();
    }
});

/**
 * Draws a pattern over the current path region with a scrolling offset.
 * The translate has to happen before the fill so the pattern moves with it.
 */
export function fillWithScrollingTexture(context, texture, x, y, width, height, offsetX, offsetY, alpha) {
    const wrappedX = offsetX % texture.width;
    const wrappedY = offsetY % texture.height;

    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = texture;
    context.translate(wrappedX, wrappedY);
    context.fillRect(x - wrappedX, y - wrappedY, width, height);
    context.restore();
}

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

/** Kept here so the sky and the gate agree on what a "twinkle" looks like. */
export function twinkleAmount(seed, time) {
    return 0.5 + 0.5 * sin(time * 2.4 + seed * 7.3) * cos(time * 1.1 + seed * 3.1);
}
