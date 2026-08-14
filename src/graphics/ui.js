/**
 * Canvas UI pieces: panels, menu lists, key caps and meters.
 *
 * All of it is drawn with paths on the game canvas. Nothing here touches the
 * DOM, so the whole interface letterboxes and scales with the game and looks
 * the same everywhere.
 */

import { canvasContext } from '../core/canvas.js';
import { clamp, cos, sin, TAU } from '../core/math.js';
import { drawFourPointStar } from '../engine/particles.js';
import { RAINBOW_COLORS } from './palette.js';
import { drawText, measureText } from './typography.js';

export const PANEL_BACKGROUND = 'rgba(18,10,34,0.82)';
export const TEXT_DIM = 'rgba(233,220,255,0.62)';
export const TEXT_BRIGHT = '#fdf7ff';

/** A rounded panel with a rainbow bar along its top edge. */
export function drawPanel(x, y, width, height, radius = 18) {
    const context = canvasContext;

    context.save();
    context.fillStyle = PANEL_BACKGROUND;
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();

    // The rainbow rule is clipped to the panel so it follows the rounded corners.
    context.clip();
    const bandWidth = width / RAINBOW_COLORS.length;
    RAINBOW_COLORS.forEach((color, index) => {
        context.fillStyle = color;
        context.fillRect(x + index * bandWidth, y, bandWidth + 1, 4);
    });
    context.restore();
}

/** A dark wash over the whole screen, for pause and menu overlays. */
export function drawScreenDim(alpha = 0.55) {
    const context = canvasContext;
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = '#0d0620';
    context.fillRect(0, 0, 4000, 4000);
    context.restore();
}

/**
 * A vertical menu. `items` are `{ label, detail }`; `detail` is drawn on the
 * right, which is how the settings screen shows each value.
 */
export function drawMenu(items, selectedIndex, centreX, startY, {
    lineHeight = 52,
    size = 27,
    width = 520,
    time = 0,
} = {}) {
    items.forEach((item, index) => {
        const y = startY + index * lineHeight;
        const isSelected = index === selectedIndex;

        if (isSelected) drawSelectionMarker(centreX, y, width, time);

        drawText(item.label, item.detail ? centreX - width / 2 + 26 : centreX, y, {
            size,
            weight: isSelected ? 800 : 600,
            spacing: 1.5,
            align: item.detail ? 'left' : 'center',
            color: isSelected ? TEXT_BRIGHT : TEXT_DIM,
            shadowOffset: 2,
        });

        if (item.detail) {
            drawText(item.detail, centreX + width / 2 - 26, y, {
                size: size - 2,
                weight: 700,
                spacing: 1,
                align: 'right',
                color: isSelected ? TEXT_BRIGHT : TEXT_DIM,
                shadowOffset: 2,
            });
        }
    });
}

/** A soft rainbow bar behind the highlighted row, with a star on each side. */
function drawSelectionMarker(centreX, y, width, time) {
    const context = canvasContext;
    const pulse = 0.75 + sin(time * 5) * 0.25;

    context.save();

    const gradient = context.createLinearGradient(centreX - width / 2, 0, centreX + width / 2, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.5, `rgba(255,255,255,${0.14 * pulse})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.roundRect(centreX - width / 2, y - 21, width, 42, 21);
    context.fill();

    const starColor = RAINBOW_COLORS[(time * 6 | 0) % RAINBOW_COLORS.length];
    context.fillStyle = starColor;
    drawFourPointStar(context, centreX - width / 2 - 4, y, 6 * pulse, time * 2);
    drawFourPointStar(context, centreX + width / 2 + 4, y, 6 * pulse, -time * 2);

    context.restore();
}

/** A key legend, drawn as a rounded cap with the key name inside. */
export function drawKeyCap(label, x, y, size = 17) {
    const context = canvasContext;
    const textWidth = measureText(label, size, 700, 1);
    const width = textWidth + 20;
    const height = size + 15;

    context.save();
    context.fillStyle = 'rgba(255,255,255,0.13)';
    context.strokeStyle = 'rgba(255,255,255,0.36)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.roundRect(x - width / 2, y - height / 2, width, height, 6);
    context.fill();
    context.stroke();
    context.restore();

    drawText(label, x, y + 1, { size, weight: 700, spacing: 1, color: TEXT_BRIGHT });
    return width;
}

/** Draws a row of key caps joined by separators, and returns the total width. */
export function drawKeyRow(labels, x, y, size = 17) {
    const gap = 7;
    const widths = labels.map((label) => measureText(label, size, 700, 1) + 20);
    const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gap * (labels.length - 1);

    let cursor = x - totalWidth / 2;
    labels.forEach((label, index) => {
        drawKeyCap(label, cursor + widths[index] / 2, y, size);
        cursor += widths[index] + gap;
    });

    return totalWidth;
}

/**
 * The paint meter: a rounded trough filled with the rainbow, left to right.
 * The fill is clipped rather than scaled so the colours stay put as it drains.
 */
export function drawPaintMeter(x, y, width, height, fillRatio, flashAmount = 0) {
    const context = canvasContext;
    const radius = height / 2;

    context.save();

    context.fillStyle = 'rgba(12,6,26,0.66)';
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();

    context.save();
    context.beginPath();
    context.roundRect(x, y, width * clamp(fillRatio, 0, 1), height, radius);
    context.clip();

    const bandWidth = width / RAINBOW_COLORS.length;
    RAINBOW_COLORS.forEach((color, index) => {
        context.fillStyle = color;
        context.fillRect(x + index * bandWidth, y, bandWidth + 1, height);
    });
    context.restore();

    if (flashAmount > 0) {
        context.globalAlpha = flashAmount * 0.7;
        context.fillStyle = '#fff';
        context.beginPath();
        context.roundRect(x, y, width, height, radius);
        context.fill();
        context.globalAlpha = 1;
    }

    context.strokeStyle = 'rgba(255,255,255,0.28)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.stroke();

    context.restore();
}

/** A ring of small gloom markers, one per enemy still to purify. */
export function drawGloomCounter(x, y, remaining, total) {
    const context = canvasContext;
    const spacing = 17;

    for (let index = 0; index < total; index++) {
        const isPurified = index >= remaining;
        context.save();
        context.globalAlpha = isPurified ? 1 : 0.75;

        if (isPurified) {
            context.fillStyle = RAINBOW_COLORS[index % RAINBOW_COLORS.length];
            drawFourPointStar(context, x + index * spacing, y, 6.5, 0.5);
        } else {
            context.fillStyle = 'rgba(20,10,38,0.9)';
            context.strokeStyle = 'rgba(190,170,220,0.6)';
            context.lineWidth = 1.5;
            context.beginPath();
            context.arc(x + index * spacing, y, 5.5, 0, TAU);
            context.fill();
            context.stroke();
        }
        context.restore();
    }
}

/** Formats seconds as m:ss.mmm, the usual speedrun clock. */
export function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const hundredths = Math.floor((totalSeconds * 100) % 100);
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

/** A slow ring of drifting stars, used to keep menu backgrounds alive. */
export function drawDriftingSparkles(time, count, width, height) {
    const context = canvasContext;
    context.save();

    for (let index = 0; index < count; index++) {
        const seed = index * 7.13;
        const x = ((cos(seed) * 0.5 + 0.5) * width + time * (12 + index % 5 * 6)) % width;
        const y = (sin(seed * 2.7) * 0.5 + 0.5) * height;
        const twinkle = 0.35 + 0.35 * sin(time * 2 + seed);

        context.globalAlpha = twinkle;
        context.fillStyle = RAINBOW_COLORS[index % RAINBOW_COLORS.length];
        drawFourPointStar(context, x, y, 3 + twinkle * 3, time + seed);
    }

    context.restore();
}
