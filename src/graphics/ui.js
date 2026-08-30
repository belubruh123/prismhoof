/**
 * Canvas UI pieces: panels, menu lists and meters.
 *
 * All of it is drawn with paths on the game canvas. Nothing here touches the
 * DOM, so the whole interface letterboxes and scales with the game and looks
 * the same everywhere.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { clamp, sin } from '../core/math.js';
import { drawFourPointStar } from '../engine/particles.js';
import { INK_BLACK, RAINBOW_COLORS, UNICORN_COAT } from './palette.js';
import { drawText } from './typography.js';

// Eight-digit hex rather than rgba(): Closure inlines both of these at every
// one of their two dozen call sites, so half the characters is half the
// characters two dozen times over.
const PANEL_BACKGROUND = '#120a22d1';
export const TEXT_DIM = '#e9dcff9e';
/** The same white the unicorn's coat is, so the interface and the character agree. */
export const TEXT_BRIGHT = UNICORN_COAT;

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
    RAINBOW_COLORS.forEach((inkColor, index) => {
        context.fillStyle = inkColor;
        context.fillRect(x + radius + index * bandWidth, y, bandWidth + 1, 4);
    });
}

/** A dark wash over the whole screen, for pause and menu overlays. */
export function drawScreenDim(alpha) {
    const context = canvasContext;
    context.globalAlpha = alpha;
    context.fillStyle = INK_BLACK;
    context.fillRect(0, 0, 4000, 4000);
    context.globalAlpha = 1;
}

/**
 * A vertical menu. `items` are `{ label, detail }`; `detail` is drawn on the
 * right, which is how the settings screen shows each value.
 */
export function drawMenu(menuItems, chosenIndex, centreX, startY, {
    rowStep = 52,
    typeSize = 27,
    width = 520,
    time,
} = {}) {
    menuItems.forEach((item, index) => {
        const y = startY + index * rowStep;
        const isSelected = index === chosenIndex;

        if (isSelected) drawSelectionMarker(centreX, y, width, time);

        drawText(item.menuLabel, item.subLabel ? centreX - width / 2 + 26 : centreX, y, {
            typeSize,
            typeWeight: isSelected ? 800 : 600,
            typeSpacing: 1.5,
            alignment: item.subLabel ? 'left' : 'center',
            inkColor: isSelected ? TEXT_BRIGHT : TEXT_DIM,
        });

        if (item.subLabel) {
            drawText(item.subLabel, centreX + width / 2 - 26, y, {
                typeSize: typeSize - 2,
                typeWeight: 700,
                typeSpacing: 1,
                alignment: 'right',
                inkColor: isSelected ? TEXT_BRIGHT : TEXT_DIM,
            });
        }
    });
}

/** A soft bar behind the highlighted row, with a pulsing star beside it. */
function drawSelectionMarker(centreX, y, width, time) {
    const context = canvasContext;
    const pulse = 0.75 + sin(time * 5) * 0.25;

    context.save();

    // The star goes down first so the bar's alpha can be multiplied into
    // whatever the caller already had, rather than resetting it afterwards.
    context.fillStyle = RAINBOW_COLORS[(time * 6 | 0) % RAINBOW_COLORS.length];
    drawFourPointStar(context, centreX - width / 2 - 6, y, 6 * pulse, time * 2);

    context.globalAlpha *= 0.1 * pulse;
    context.fillStyle = TEXT_BRIGHT;
    context.beginPath();
    context.roundRect(centreX - width / 2, y - 21, width, 42, 21);
    context.fill();

    context.restore();
}

/**
 * The paint meter: a rounded trough filled with the rainbow, left to right.
 * The fill is clipped rather than scaled so the colours stay put as it drains.
 */
export function drawPaintMeter(x, y, width, height, fillRatio, flashAmount = 0) {
    const context = canvasContext;
    const radius = height / 2;

    // The trough outline is wanted three times - as the well, as the flash and
    // as the rim - so it is built once as a path instead of being described from
    // the same six numbers each time.
    const trough = new Path2D();
    trough.roundRect(x, y, width, height, radius);

    context.save();

    context.fillStyle = PANEL_BACKGROUND;
    context.fill(trough);

    context.save();
    context.beginPath();
    context.roundRect(x, y, width * clamp(fillRatio, 0, 1), height, radius);
    context.clip();

    const bandWidth = width / RAINBOW_COLORS.length;
    RAINBOW_COLORS.forEach((inkColor, index) => {
        context.fillStyle = inkColor;
        context.fillRect(x + index * bandWidth, y, bandWidth + 1, height);
    });
    context.restore();

    if (flashAmount > 0) {
        context.globalAlpha = flashAmount * 0.7;
        context.fillStyle = '#fff';
        context.fill(trough);
        context.globalAlpha = 1;
    }

    context.strokeStyle = TEXT_DIM;
    context.lineWidth = 1.5;
    context.stroke(trough);

    context.restore();
}

/**
 * Seven rainbow bands sweeping the screen, staggered by a fraction of a band
 * each so it reads as one rainbow being drawn across rather than seven bars
 * moving in lockstep.
 *
 * `amount` is how much of the screen is covered, 1 to 0. Closing anchors the
 * bands to the left edge and opening to the right, so a level ending, the next
 * one beginning and the game itself opening are one continuous gesture that
 * always travels the same way.
 */
export function drawRainbowWipe(amount, isClosing) {
    const context = canvasContext;
    const bandHeight = CANVAS_HEIGHT / RAINBOW_COLORS.length;

    RAINBOW_COLORS.forEach((inkColor, index) => {
        const width = CANVAS_WIDTH * clamp(amount * 1.5 - index * 0.08, 0, 1);
        context.fillStyle = inkColor;
        context.fillRect(isClosing ? 0 : CANVAS_WIDTH - width, index * bandHeight, width, bandHeight + 1);
    });
}

/**
 * Formats seconds as m:ss.hh, the usual speedrun clock.
 *
 * Adding a hundred and cutting the leading '1' back off is the zero-padding: it
 * costs a character and saves reaching for padStart.
 */
export function formatTime(totalSeconds) {
    return `${totalSeconds / 60 | 0}:${(100 + totalSeconds % 60).toFixed(2).slice(1)}`;
}
