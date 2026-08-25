/**
 * How to play - the game explaining itself.
 *
 * A judge may never read a line of this repository, so everything needed to play
 * PRISMHOOF well is here: the one verb and its four uses, the goal, the controls
 * and the tips that are hardest to discover by accident. The premise is not -
 * that is what the opening is for. Reachable from the title and the pause menu.
 *
 * The left column is a list of (text, style, gap) rows rather than twenty
 * separate draw calls, which keeps the copy easy to edit and the layout in one
 * place.
 *
 * Several lines here are word-for-word what the signs in the first levels say.
 * That is deliberate twice over: the phrasing a player is taught in the meadow
 * is the phrasing they find again here, and a string the build has already seen
 * costs the packed payload almost nothing to repeat.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { BACK_KEYS, CONFIRM_KEYS, wasKeyPressed } from '../core/input.js';
import { drawRainbowText, drawText } from '../graphics/typography.js';
import { TEXT_BRIGHT, TEXT_DIM, drawPanel, drawScreenDim } from '../graphics/ui.js';
import { Screen, popScreen } from './screen.js';

const HEADING = { typeSize: 19, typeWeight: 900, typeSpacing: 1.5, alignment: 'left', inkColor: TEXT_BRIGHT };
const STRONG = { typeSize: 17, typeWeight: 700, alignment: 'left', inkColor: TEXT_BRIGHT };
const BODY = { typeSize: 15, typeWeight: 500, alignment: 'left', inkColor: TEXT_DIM };
const TERM = { typeSize: 15, typeWeight: 800, typeSpacing: 1.5, alignment: 'left', inkColor: TEXT_BRIGHT };

/** [text, style, pixels of space before this line] */
const STORY = [
    ['HOLD SHIFT TO POUR A RAINBOW', HEADING, 0],
    ['It flies out ahead of you, falls, and hardens where it lands.', BODY, 26],
    ['ON FLAT GROUND', TERM, 34],
    ['the stream sweeps down and purifies the Gloom', BODY, 21],
    ['AT THE EDGE OF A DROP IT ARCS ACROSS', TERM, 26],
    ['the gap below becomes a bridge', BODY, 21],
    ['POUR AS YOU RISE AND IT CLIMBS TOO', TERM, 26],
    ['the jump becomes a ramp', BODY, 21],
    ['IN MID-AIR', TERM, 26],
    ['the stream holds you up, and you climb', BODY, 21],
    ['Purify every Gloom to open the Rainbow Gate, then run through it.', STRONG, 44],
    ['The colour returns to the meadow as you clear it.', BODY, 24],
];

const CONTROLS = [
    ['A  D  or  ARROWS', 'GALLOP'],
    ['SPACE  or  W', 'JUMP  (hold for height)'],
    ['S', 'DIVE'],
    ['K  or  X', 'AIR DASH  (once per jump)'],
    ['SHIFT', 'POUR RAINBOW  (hold)'],
    ['C', 'WHOLE COURSE VIEW'],
    ['R', 'RETRY LEVEL'],
    ['ESC', 'PAUSE'],
];

const TIPS = [
    ['YOUR RAINBOWS FADE - KEEP MOVING', TEXT_BRIGHT, 800],
    ['Wisps drink any rainbow they reach.', TEXT_DIM, 500],
    // Word for word what the screen says when you die, and in the same case, so
    // the second copy is nearly free to pack as well as being the same lesson.
    ['ONE HIT IS FATAL - THE CLOCK NEVER STOPS', TEXT_DIM, 500],
];

export class HowToPlayScreen extends Screen {
    updateStep(elapsedSeconds) {
        super.updateStep(elapsedSeconds);
        if (wasKeyPressed(BACK_KEYS) || wasKeyPressed(CONFIRM_KEYS)) popScreen();
    }

    render() {
        drawScreenDim(0.72);
        drawPanel(70, 44, CANVAS_WIDTH - 140, CANVAS_HEIGHT - 118);
        drawRainbowText('HOW TO PLAY', CANVAS_WIDTH / 2, 96, { typeSize: 40, typeWeight: 900, typeSpacing: 6 });

        let y = 152;
        for (const [text, style, gap] of STORY) {
            y += gap;
            drawText(text, style === BODY ? 134 : 122, y, style);
        }

        this.renderControls();

        drawText('ESC or ENTER to go back', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 42, {
            typeSize: 15, typeWeight: 600, typeSpacing: 2, inkColor: TEXT_DIM,
        });
    }

    renderControls() {
        const columnX = CANVAS_WIDTH - 340;
        let y = 158;

        drawText('CONTROLS', columnX, y, { typeSize: 19, typeWeight: 900, typeSpacing: 3, inkColor: TEXT_BRIGHT });

        for (const [keys, menuLabel] of CONTROLS) {
            y += 52;
            drawText(keys, columnX, y, { typeSize: 17, typeWeight: 900, typeSpacing: 3, inkColor: TEXT_BRIGHT });
            drawText(menuLabel, columnX, y + 22, { typeSize: 14, typeWeight: 600, typeSpacing: 1, inkColor: TEXT_DIM });
        }

        y += 62;
        for (const [text, inkColor, typeWeight] of TIPS) {
            drawText(text, columnX, y, { typeSize: 14, typeWeight, typeSpacing: typeWeight > 700 ? 1 : 0, inkColor });
            y += 24;
        }
    }
}
