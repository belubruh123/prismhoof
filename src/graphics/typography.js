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
import { INK_BLACK } from './palette.js';

const FONT_STACK = `'Century Gothic',Futura,'Trebuchet MS',system-ui,sans-serif`;

/** Thickness of the border drawn around every string, as a fraction of its size. */
const OUTLINE_RATIO = 0.17;
const OUTLINE_COLOR = INK_BLACK;

/** Applies a font to the context and returns the measured width of `text`. */
export function applyFont(text, typeSize, typeWeight, typeSpacing) {
    const context = canvasContext;
    context.font = `${typeWeight} ${typeSize}px ${FONT_STACK}`;
    context.letterSpacing = `${typeSpacing}px`;
    return context.measureText(text).width;
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
    inkColor = '#fff',
    inkAlpha = 1,
} = {}) {
    const context = canvasContext;
    context.save();

    const width = applyFont(text, typeSize, typeWeight, typeSpacing);
    context.textAlign = alignment;
    context.textBaseline = 'middle';
    // Multiplied rather than set, so a caller can fade a whole screenful of
    // text at once by setting one ambient alpha around the lot.
    context.globalAlpha *= inkAlpha;

    // A dark border around every string. It is what lets the signs stand in the
    // level itself rather than in a box at the top of the screen: the words hold
    // up over a bright sky, a rainbow and a wall of grass with no panel behind
    // them. There used to be a soft drop shadow under it as well; the border was
    // doing nearly all of the work and the shadow cost more than it earned.
    context.lineWidth = typeSize * OUTLINE_RATIO;
    context.lineJoin = 'round';
    context.strokeStyle = OUTLINE_COLOR;
    context.strokeText(text, x, y);

    context.fillStyle = inkColor;
    context.fillText(text, x, y);

    context.restore();
    return width;
}

