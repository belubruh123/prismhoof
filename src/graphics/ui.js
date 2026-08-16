/**
 * Canvas UI pieces: panels, menu lists and meters.
 *
 * All of it is drawn with paths on the game canvas. Nothing here touches the
 * DOM, so the whole interface letterboxes and scales with the game and looks
 * the same everywhere.
 */

import { canvasContext } from '../core/canvas.js';
import { clamp, sin } from '../core/math.js';
import { drawFourPointStar } from '../engine/particles.js';
import { RAINBOW_COLORS } from './palette.js';
import { drawText } from './typography.js';

const PANEL_BACKGROUND = 'rgba(18,10,34,0.82)';
export const TEXT_DIM = 'rgba(233,220,255,0.62)';
export const TEXT_BRIGHT = '#fdf7ff';

/** A rounded panel with a rainbow bar along its top edge. */
export function drawPanel(x, y, width, height, radius = 18) {
    const context = canvasContext;

    context.fillStyle = PANEL_BACKGROUND;
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();

    // The rainbow rule is inset past the corner radius, so it needs no clip.
    const ruleWidth = width - radius * 2;
    const bandWidth = ruleWidth / RAINBOW_COLORS.length;
    RAINBOW_COLORS.forEach((color, index) => {
        context.fillStyle = color;
        context.fillRect(x + radius + index * bandWidth, y, bandWidth + 1, 4);
    });
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
        });

        if (item.detail) {
            drawText(item.detail, centreX + width / 2 - 26, y, {
                size: size - 2,
                weight: 700,
                spacing: 1,
                align: 'right',
                color: isSelected ? TEXT_BRIGHT : TEXT_DIM,
            });
        }
    });
}

/** A soft bar behind the highlighted row, with a pulsing star beside it. */
function drawSelectionMarker(centreX, y, width, time) {
    const context = canvasContext;
    const pulse = 0.75 + sin(time * 5) * 0.25;

    context.save();

    context.fillStyle = `rgba(255,255,255,${0.1 * pulse})`;
    context.beginPath();
    context.roundRect(centreX - width / 2, y - 21, width, 42, 21);
    context.fill();

    context.fillStyle = RAINBOW_COLORS[(time * 6 | 0) % RAINBOW_COLORS.length];
    drawFourPointStar(context, centreX - width / 2 - 6, y, 6 * pulse, time * 2);

    context.restore();
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

/** Formats seconds as m:ss.hh, the usual speedrun clock. */
export function formatTime(totalSeconds) {
    const seconds = (totalSeconds % 60).toFixed(2);
    return `${totalSeconds / 60 | 0}:${seconds.padStart(5, '0')}`;
}
