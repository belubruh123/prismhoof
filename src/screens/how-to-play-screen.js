/**
 * How to play - the game explaining itself.
 *
 * A judge may never read a line of this repository, so what is here is what has
 * to be here: the objective, every key, and the three rules that are painful to
 * learn by dying. The premise is not - the opening carries that - and neither
 * are the four things a poured rainbow can do, because the meadow teaches those
 * on signposts, in the level where each one first matters, which is a better
 * place to learn them than a wall of text behind a menu.
 *
 * One centred column rather than two. The left column used to explain the verb
 * at length beside this list, and paying for it twice - once on the signs and
 * once here - was 277 bytes the opening needed more.
 *
 * The last tip is word-for-word what the screen says when you die, and in the
 * same case, so the second copy is nearly free to pack as well as being the
 * same lesson.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { BACK_KEYS, CONFIRM_KEYS, wasKeyPressed } from '../core/input.js';
import { drawText } from '../graphics/typography.js';
import { drawWordmark } from '../graphics/wordmark.js';
import { TEXT_BRIGHT, TEXT_DIM, drawPanel, drawScreenDim } from '../graphics/ui.js';
import { Screen, popScreen } from './screen.js';

const CONTROLS = [
    ['A  D  or  ARROWS', 'GALLOP'],
    ['SPACE  or  W', 'JUMP  (hold for height)'],
    ['S', 'DIVE'],
    ['K  or  X', 'AIR DASH  (once per jump)'],
    ['SHIFT', 'POUR A RAINBOW  (hold) - it hardens where it lands'],
    ['C', 'WHOLE COURSE VIEW'],
    ['R', 'RETRY LEVEL'],
    ['ESC', 'PAUSE'],
];

const TIPS = [
    ['PURIFY EVERY GLOOM TO OPEN THE GATE, THEN RUN THROUGH IT', TEXT_BRIGHT, 800],
    ['YOUR RAINBOWS FADE - KEEP MOVING', TEXT_BRIGHT, 800],
    ['Wisps drink any rainbow they reach.', TEXT_DIM, 500],
    ['ONE HIT IS FATAL - THE CLOCK NEVER STOPS', TEXT_DIM, 500],
];

export class HowToPlayScreen extends Screen {
    updateStep(elapsedSeconds) {
        super.updateStep(elapsedSeconds);
        if (wasKeyPressed(BACK_KEYS) || wasKeyPressed(CONFIRM_KEYS)) popScreen();
    }

    render() {
        drawScreenDim(0.72);
        drawPanel(300, 44, CANVAS_WIDTH - 600, CANVAS_HEIGHT - 118);
        drawWordmark('HOW TO PLAY', CANVAS_WIDTH / 2, 100, 34);

        let y = 158;
        for (const [keys, menuLabel] of CONTROLS) {
            drawText(keys, CANVAS_WIDTH / 2, y, {
                typeSize: 17, typeWeight: 900, typeSpacing: 3, inkColor: TEXT_BRIGHT,
            });
            drawText(menuLabel, CANVAS_WIDTH / 2, y + 21, {
                typeSize: 14, typeWeight: 600, typeSpacing: 1, inkColor: TEXT_DIM,
            });
            y += 46;
        }

        y += 16;
        for (const [text, inkColor, typeWeight] of TIPS) {
            drawText(text, CANVAS_WIDTH / 2, y, {
                typeSize: 14, typeWeight, typeSpacing: typeWeight > 700 ? 1 : 0, inkColor,
            });
            y += 24;
        }

        drawText('ESC or ENTER to go back', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 42, {
            typeSize: 15, typeWeight: 600, typeSpacing: 2, inkColor: TEXT_DIM,
        });
    }
}
