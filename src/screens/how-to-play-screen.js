/**
 * How to play: the controls, and the one line that is the whole objective.
 *
 * Everything else this screen used to say - what a poured rainbow does on flat
 * ground, at the edge of a drop, on the way up - is taught by the signs standing
 * in the first four courses, at the moment the player is holding the key that
 * does it. A wall of prose in a menu is a manual for a game with one verb, and
 * nobody reads a manual with the meadow already on screen behind it.
 *
 * So the keys are drawn as keys. A cap with a letter in it is read at a glance
 * and needs no colon, no dash and no sentence explaining the convention. Aliases
 * are left off on purpose: the arrows, W and J all work, but a list that shows
 * every way to do a thing is longer and says less than one that shows one.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { BACK_KEYS, CONFIRM_KEYS, wasKeyPressed } from '../core/input.js';
import { applyFont, drawText } from '../graphics/typography.js';
import { drawWordmark } from '../graphics/wordmark.js';
import { TEXT_BRIGHT, TEXT_DIM, drawGateBadge, drawGloomBadge, drawPanel, drawScreenDim } from '../graphics/ui.js';
import { Screen, popScreen } from './screen.js';

/** [the keys, what they do]. Four rows a column, two columns. */
const CONTROLS = [
    ['A D', 'GALLOP'],
    ['SPACE', 'JUMP'],
    ['S', 'DIVE'],
    ['K', 'AIR DASH'],
    ['SHIFT', 'POUR RAINBOW'],
    ['C', 'COURSE VIEW'],
    ['R', 'RETRY'],
    ['ESC', 'PAUSE'],
];

const KEY_SIZE = 16;
const COLUMN_X = [244, 700];
const FIRST_ROW_Y = 212;
const ROW_STEP = 60;
/** Where the label starts, so every label in a column lines up whatever its keys. */
const LABEL_OFFSET = 168;

const GOAL_Y = 484;

export class HowToPlayScreen extends Screen {
    updateStep(elapsedSeconds) {
        super.updateStep(elapsedSeconds);
        if (wasKeyPressed(BACK_KEYS) || wasKeyPressed(CONFIRM_KEYS)) popScreen();
    }

    render() {
        drawScreenDim(0.72);
        drawPanel(150, 60, CANVAS_WIDTH - 300, CANVAS_HEIGHT - 220);
        drawWordmark('HOW TO PLAY', CANVAS_WIDTH / 2, 128, 36);

        CONTROLS.forEach(([keys, doesWhat], index) => {
            const x = COLUMN_X[index > 3 ? 1 : 0];
            const y = FIRST_ROW_Y + (index % 4) * ROW_STEP;

            let capX = x;
            for (const key of keys.split(' ')) capX += drawKeyCap(key, capX, y);

            drawText(doesWhat, x + LABEL_OFFSET, y, {
                typeSize: 19,
                typeWeight: 700,
                typeSpacing: 1.5,
                alignment: 'left',
                inkColor: TEXT_DIM,
            });
        });

        // The goal, said once, standing between the two things it is about - and
        // they are the same two badges the HUD counts with, so the corner of the
        // screen is already explained by the time the player is looking at it.
        drawGloomBadge(334, GOAL_Y);
        drawText('PURIFY EVERY GLOOM TO OPEN THE GATE', CANVAS_WIDTH / 2, GOAL_Y, {
            typeSize: 20,
            typeWeight: 800,
            typeSpacing: 2,
            inkColor: TEXT_BRIGHT,
        });
        drawGateBadge(946, GOAL_Y - 4, this.age);
    }
}

/**
 * One key cap, drawn at `x` and returning how far along to start the next one.
 * The width comes from measuring the letter rather than guessing at it, so SPACE
 * and S both get a cap that fits them.
 */
function drawKeyCap(key, x, y) {
    const context = canvasContext;
    const width = applyFont(key, KEY_SIZE, 800, 1) + 26;

    context.strokeStyle = TEXT_DIM;
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(x, y - 18, width, 36, 9);
    context.stroke();

    drawText(key, x + width / 2, y, {
        typeSize: KEY_SIZE,
        typeWeight: 800,
        typeSpacing: 1,
        inkColor: TEXT_BRIGHT,
    });

    return width + 9;
}
