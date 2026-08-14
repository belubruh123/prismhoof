/**
 * How to play - the game explaining itself.
 *
 * A judge may never read a line of this repository, so everything needed to
 * understand and enjoy PRISMHOOF is here: the premise, the goal, the one verb
 * and its three uses, the controls, and the two tips that are hardest to
 * discover by accident. Reachable from the title screen and from the pause menu.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { BACK_KEYS, CONFIRM_KEYS, wasKeyPressed } from '../core/input.js';
import { drawRainbowText, drawText } from '../graphics/typography.js';
import {
    TEXT_BRIGHT,
    TEXT_DIM,
    drawKeyRow,
    drawPanel,
    drawScreenDim,
} from '../graphics/ui.js';
import { Screen, popScreen } from './screen.js';

/** Left column: what the game is. Right column: which keys do it. */
const USES = [
    ['ON FLAT GROUND', 'the stream sweeps down and purifies the Gloom'],
    ['AT THE EDGE OF A DROP', 'it arcs across and becomes a bridge'],
    ['ON THE WAY UP FROM A JUMP', 'it climbs, and becomes a ramp'],
];

const CONTROLS = [
    [['A', 'D'], 'GALLOP'],
    [['SPACE'], 'JUMP  (hold for height)'],
    [['S'], 'DIVE'],
    [['SHIFT'], 'POUR RAINBOW  (hold)'],
    [['R'], 'RETRY LEVEL'],
    [['ESC'], 'PAUSE'],
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

        this.renderStory();
        this.renderControls();

        drawText('ESC  or  ENTER  to go back', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 42, {
            size: 15,
            weight: 600,
            spacing: 2,
            color: TEXT_DIM,
        });
    }

    renderStory() {
        const left = 122;
        let y = 152;

        drawText('The Gloom drained the colour from the Skyward Meadows.', left, y, {
            size: 17, weight: 600, align: 'left', color: TEXT_BRIGHT,
        });
        drawText('You are the last unicorn, and your horn still holds the seven colours.', left, y += 25, {
            size: 17, weight: 600, align: 'left', color: TEXT_BRIGHT,
        });

        y += 42;
        drawText('HOLD SHIFT AND YOUR HORN POURS A RAINBOW.', left, y, {
            size: 19, weight: 900, spacing: 1.5, align: 'left', color: TEXT_BRIGHT,
        });
        drawText('It flies out ahead of you, falls, and hardens where it lands.', left, y += 26, {
            size: 16, weight: 500, align: 'left', color: TEXT_DIM,
        });

        y += 30;
        for (const [when, what] of USES) {
            y += 30;
            drawText(when, left, y, { size: 15, weight: 800, spacing: 1.5, align: 'left', color: TEXT_BRIGHT });
            drawText(what, left + 12, y + 20, { size: 15, weight: 500, align: 'left', color: TEXT_DIM });
            y += 20;
        }

        y += 46;
        drawText('Purify every Gloom to open the Rainbow Gate, then run through it.', left, y, {
            size: 16, weight: 700, align: 'left', color: TEXT_BRIGHT,
        });
        drawText('The colour returns to the meadow as you clear it.', left, y + 24, {
            size: 16, weight: 500, align: 'left', color: TEXT_DIM,
        });
    }

    renderControls() {
        const columnX = CANVAS_WIDTH - 340;
        let y = 158;

        drawText('CONTROLS', columnX, y, { size: 19, weight: 900, spacing: 3, color: TEXT_BRIGHT });

        y += 16;
        for (const [keys, label] of CONTROLS) {
            y += 42;
            drawKeyRow(keys, columnX, y, 15);
            drawText(label, columnX, y + 26, { size: 14, weight: 600, spacing: 1, color: TEXT_DIM });
            y += 18;
        }

        y += 38;
        drawText('PAINT REFILLS ONLY ON SOLID FOOTING.', columnX, y, {
            size: 14, weight: 800, spacing: 1, color: TEXT_BRIGHT,
        });
        drawText('One hit is fatal. Retries are instant,', columnX, y + 26, {
            size: 14, weight: 500, color: TEXT_DIM,
        });
        drawText('and the run clock never stops.', columnX, y + 46, {
            size: 14, weight: 500, color: TEXT_DIM,
        });
    }
}
