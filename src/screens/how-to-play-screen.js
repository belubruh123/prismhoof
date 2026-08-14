/**
 * How to play - the game explaining itself.
 *
 * A judge may never read a line of this repository, so everything needed to
 * understand and enjoy PRISMHOOF is here: the premise, the goal, the one verb
 * and its three uses, the controls, and the two tips that are hardest to
 * discover by accident. Reachable from the title screen and from the pause menu.
 *
 * The left column is a list of (text, style, gap) rows rather than twenty
 * separate draw calls, which keeps the copy easy to edit and the layout in one
 * place.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { BACK_KEYS, CONFIRM_KEYS, wasKeyPressed } from '../core/input.js';
import { drawRainbowText, drawText } from '../graphics/typography.js';
import { TEXT_BRIGHT, TEXT_DIM, drawKeyRow, drawPanel, drawScreenDim } from '../graphics/ui.js';
import { Screen, popScreen } from './screen.js';

const HEADING = { size: 19, weight: 900, spacing: 1.5, align: 'left', color: TEXT_BRIGHT };
const STRONG = { size: 17, weight: 700, align: 'left', color: TEXT_BRIGHT };
const BODY = { size: 15, weight: 500, align: 'left', color: TEXT_DIM };
const TERM = { size: 15, weight: 800, spacing: 1.5, align: 'left', color: TEXT_BRIGHT };

/** [text, style, pixels of space before this line] */
const STORY = [
    ['The Gloom drained the colour from the Skyward Meadows.', STRONG, 0],
    ['You are the last unicorn. Your horn still holds the seven colours.', STRONG, 25],
    ['HOLD SHIFT AND YOUR HORN POURS A RAINBOW.', HEADING, 44],
    ['It flies out ahead of you, falls, and hardens where it lands.', BODY, 26],
    ['ON FLAT GROUND', TERM, 34],
    ['the stream sweeps down and purifies the Gloom', BODY, 21],
    ['AT THE EDGE OF A DROP', TERM, 26],
    ['it arcs across and becomes a bridge', BODY, 21],
    ['ON THE WAY UP FROM A JUMP', TERM, 26],
    ['it climbs, and becomes a ramp', BODY, 21],
    ['Purify every Gloom to open the Rainbow Gate, then run through it.', STRONG, 44],
    ['The colour returns to the meadow as you clear it.', BODY, 24],
];

const CONTROLS = [
    [['A', 'D'], 'GALLOP'],
    [['SPACE'], 'JUMP  (hold for height)'],
    [['S'], 'DIVE'],
    [['SHIFT'], 'POUR RAINBOW  (hold)'],
    [['R'], 'RETRY LEVEL'],
    [['ESC'], 'PAUSE'],
];

const TIPS = [
    ['PAINT REFILLS ONLY ON SOLID FOOTING.', TEXT_BRIGHT, 800],
    ['One hit is fatal. Retries are instant,', TEXT_DIM, 500],
    ['and the run clock never stops.', TEXT_DIM, 500],
];

export class HowToPlayScreen extends Screen {
    update(elapsedSeconds) {
        super.update(elapsedSeconds);
        if (wasKeyPressed(BACK_KEYS) || wasKeyPressed(CONFIRM_KEYS)) popScreen();
    }

    render() {
        drawScreenDim(0.72);
        drawPanel(70, 44, CANVAS_WIDTH - 140, CANVAS_HEIGHT - 118);
        drawRainbowText('HOW TO PLAY', CANVAS_WIDTH / 2, 96, { size: 40, weight: 900, spacing: 6 });

        let y = 152;
        for (const [text, style, gap] of STORY) {
            y += gap;
            drawText(text, style === BODY ? 134 : 122, y, style);
        }

        this.renderControls();

        drawText('ESC or ENTER to go back', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 42, {
            size: 15, weight: 600, spacing: 2, color: TEXT_DIM,
        });
    }

    renderControls() {
        const columnX = CANVAS_WIDTH - 340;
        let y = 158;

        drawText('CONTROLS', columnX, y, { size: 19, weight: 900, spacing: 3, color: TEXT_BRIGHT });

        for (const [keys, label] of CONTROLS) {
            y += 58;
            drawKeyRow(keys, columnX, y, 15);
            drawText(label, columnX, y + 26, { size: 14, weight: 600, spacing: 1, color: TEXT_DIM });
        }

        y += 62;
        for (const [text, color, weight] of TIPS) {
            drawText(text, columnX, y, { size: 14, weight, spacing: weight > 700 ? 1 : 0, color });
            y += 24;
        }
    }
}
