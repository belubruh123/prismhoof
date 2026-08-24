/**
 * Text drawing.
 *
 * Everything is canvas text - there is no DOM UI anywhere in this game, and no
 * webfont either, since the entry has to run with zero network requests. The
 * stack asks for the roundest geometric faces that ship with Windows and macOS
 * and falls back through Trebuchet, so the lettering keeps a soft storybook
 * shape wherever it lands.
 */

import { canvasContext } from '../core/canvas.js';
import { RAINBOW_COLORS } from './palette.js';

const FONT_STACK = `'Century Gothic',Futura,'Trebuchet MS',system-ui,sans-serif`;

/** Thickness of the border drawn around every string, as a fraction of its size. */
const OUTLINE_RATIO = 0.17;
const OUTLINE_COLOR = '#22103f';

/** Applies a font to the context and returns the measured width of `text`. */
function applyFont(text, typeSize, typeWeight, typeSpacing) {
    const context = canvasContext;
    context.font = `${typeWeight} ${typeSize}px ${FONT_STACK}`;
    context.letterSpacing = `${typeSpacing}px`;
    return context.measureText(text).width;
}

export function measureText(text, typeSize, typeWeight = 700, typeSpacing = 0) {
    canvasContext.save();
    const width = applyFont(text, typeSize, typeWeight, typeSpacing);
    canvasContext.restore();
    return width;
}

/**
 * Draws a line of text and returns its width.
 * `align` and `baseline` take the usual canvas values.
 */
export function drawText(text, x, y, {
    typeSize = 24,
    typeWeight = 700,
    typeSpacing = 0,
    alignment = 'center',
    baseline = 'middle',
    inkColor = '#fff',
    alpha = 1,
    outline = OUTLINE_RATIO,
} = {}) {
    const context = canvasContext;
    context.save();

    const width = applyFont(text, typeSize, typeWeight, typeSpacing);
    context.textAlign = alignment;
    context.textBaseline = baseline;
    context.globalAlpha = alpha;

    // A dark border and a soft drop shadow on every string. Between them the
    // text holds up over a bright sky, a rainbow and a wall of grass without
    // needing a panel behind it, which is what lets the signs stand in the
    // level itself rather than in a box at the top of the screen.
    if (outline) {
        context.lineWidth = typeSize * outline;
        context.lineJoin = 'round';
        context.strokeStyle = OUTLINE_COLOR;
        context.shadowColor = 'rgba(14,5,32,0.45)';
        context.shadowBlur = typeSize * 0.3;
        context.shadowOffsetY = typeSize * 0.1;
        context.strokeText(text, x, y);
        context.shadowColor = 'transparent';
    }

    context.fillStyle = inkColor;
    context.fillText(text, x, y);

    context.restore();
    return width;
}

/**
 * Text filled with the seven rainbow colours across its own width.
 * Used for headings, so the theme is present even in the menus.
 */
export function drawRainbowText(text, x, y, options = {}) {
    const { typeSize = 24, typeWeight = 900, typeSpacing = 0, alignment = 'center' } = options;

    const width = measureText(text, typeSize, typeWeight, typeSpacing);
    const left = alignment === 'center' ? x - width / 2 : alignment === 'right' ? x - width : x;

    const gradient = canvasContext.createLinearGradient(left, 0, left + width, 0);
    RAINBOW_COLORS.forEach((inkColor, index) => {
        gradient.addColorStop(index / (RAINBOW_COLORS.length - 1), inkColor);
    });

    return drawText(text, x, y, { ...options, inkColor: gradient });
}
