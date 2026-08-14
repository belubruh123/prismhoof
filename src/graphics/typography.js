/**
 * Text drawing.
 *
 * Everything is canvas text - there is no DOM UI anywhere in this game, and no
 * webfont either, since the entry has to run with zero network requests. The
 * font stack is ordinary system faces, and character is added with weight,
 * letter spacing and rainbow gradient fills rather than with a typeface.
 */

import { canvasContext } from '../core/canvas.js';
import { RAINBOW_COLORS } from './palette.js';

const FONT_STACK = `'Trebuchet MS','Segoe UI',system-ui,sans-serif`;

/** Applies a font to the context and returns the measured width of `text`. */
function applyFont(text, size, weight, spacing) {
    const context = canvasContext;
    context.font = `${weight} ${size}px ${FONT_STACK}`;
    context.letterSpacing = `${spacing}px`;
    return context.measureText(text).width;
}

export function measureText(text, size, weight = 700, spacing = 0) {
    canvasContext.save();
    const width = applyFont(text, size, weight, spacing);
    canvasContext.restore();
    return width;
}

/**
 * Draws a line of text and returns its width.
 * `align` and `baseline` take the usual canvas values.
 */
export function drawText(text, x, y, {
    size = 24,
    weight = 700,
    spacing = 0,
    align = 'center',
    baseline = 'middle',
    color = '#fff',
    alpha = 1,
    shadowOffset = 0,
} = {}) {
    const context = canvasContext;
    context.save();

    const width = applyFont(text, size, weight, spacing);
    context.textAlign = align;
    context.textBaseline = baseline;
    context.globalAlpha = alpha;

    if (shadowOffset) {
        context.fillStyle = 'rgba(20,8,40,0.55)';
        context.fillText(text, x, y + shadowOffset);
    }

    context.fillStyle = color;
    context.fillText(text, x, y);

    context.restore();
    return width;
}

/**
 * Text filled with the seven rainbow colours across its own width.
 * Used for headings, so the theme is present even in the menus.
 */
export function drawRainbowText(text, x, y, options = {}) {
    const { size = 24, weight = 900, spacing = 0, align = 'center' } = options;

    const width = measureText(text, size, weight, spacing);
    const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;

    const gradient = canvasContext.createLinearGradient(left, 0, left + width, 0);
    RAINBOW_COLORS.forEach((color, index) => {
        gradient.addColorStop(index / (RAINBOW_COLORS.length - 1), color);
    });

    return drawText(text, x, y, { ...options, color: gradient });
}

/**
 * Wraps `text` to `maxWidth` and draws it as a paragraph.
 * Returns the y just past the last line, so callers can stack blocks.
 */
export function drawParagraph(text, x, y, maxWidth, options = {}) {
    const { size = 18, lineHeight = size * 1.5, align = 'center' } = options;

    const words = text.split(' ');
    const lines = [];
    let line = '';

    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && measureText(candidate, size, options.weight || 500, options.spacing || 0) > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }
    if (line) lines.push(line);

    lines.forEach((lineText, index) => {
        drawText(lineText, x, y + index * lineHeight, { ...options, size, align });
    });

    return y + lines.length * lineHeight;
}
