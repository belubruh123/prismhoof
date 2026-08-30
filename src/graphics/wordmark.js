/**
 * The display face: the wordmark, and every heading set in the same lettering.
 *
 * PRISMHOOF used to be its own name in a bold sans with a rainbow poured across
 * it, which is what a placeholder looks like. This builds it instead: every
 * letter placed on its own step of a shallow arc, extruded back into the dark
 * behind it, and filled top to bottom with the seven colours under a white
 * sheen - the spectrum a prism throws, which is what the game is named after.
 *
 * The letters are laid one at a time rather than drawn as a string, because the
 * arc is the whole point. Nine separately rotated letters read as a logo; the
 * same nine on a straight line read as a caption.
 *
 * PAUSED, SETTINGS, HOW TO PLAY and LEVEL CLEARED are set in it too. Every
 * proportion below is a fraction of the cap height, so one number scales the
 * whole construction and a heading at 36px is the wordmark at 84px, exactly.
 * That is also why this replaced the old rainbow-gradient heading helper rather
 * than sitting beside it: one display face, used six times, packs better than
 * two used three times each.
 */

import { canvasContext } from '../core/canvas.js';
import { INK_BLACK, RAINBOW_COLORS, UNICORN_COAT } from './palette.js';
import { applyFont } from './typography.js';

/** Air between letters, arc depth, border thickness - all fractions of the size. */
const TRACKING = 0.07;
const ARC_DROP = 0.4;
const OUTLINE = 0.15;

/** The dark block behind the face: how many copies, and how far apart. */
const DEPTH = 5;
const DEPTH_STEP = 0.024;

/** Radians the outermost letters lean, whatever the word's length. */
const TILT = 0.24;

export function drawWordmark(text, centreX, y, size, inkAlpha = 1) {
    const context = canvasContext;

    context.save();
    context.globalAlpha *= inkAlpha;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.lineWidth = size * OUTLINE;
    context.strokeStyle = context.fillStyle = INK_BLACK;
    applyFont(text, size, 900, 0);

    const widths = [...text].map((letter) => context.measureText(letter).width + size * TRACKING);

    // Top to bottom: a white sheen, then the seven with red on the outside of
    // the arc, which is where a real rainbow keeps it. Built once and reused by
    // every letter, so each one carries the whole spectrum, not a slice of it.
    const face = context.createLinearGradient(0, -size * 0.62, 0, size * 0.52);
    face.addColorStop(0, UNICORN_COAT);
    RAINBOW_COLORS.forEach((inkColor, index) => face.addColorStop(0.2 + index * 0.133, inkColor));

    let left = centreX - widths.reduce((total, width) => total + width, 0) / 2;

    widths.forEach((width, index) => {
        // -1 at the first letter and +1 at the last, so a six letter heading
        // bends by exactly as much as a thirteen letter one.
        const bend = index * 2 / (widths.length - 1) - 1;

        context.save();
        context.translate(left + width / 2, y + bend * bend * size * ARC_DROP);
        context.rotate(bend * TILT);

        // The block first, deepest copy down, then the outlined face over it.
        for (let depth = DEPTH; depth; depth--) {
            context.fillText(text[index], depth * size * DEPTH_STEP * 0.3, depth * size * DEPTH_STEP);
        }
        context.strokeText(text[index], 0, 0);
        context.fillStyle = face;
        context.fillText(text[index], 0, 0);

        context.restore();
        left += width;
    });

    context.restore();
}
