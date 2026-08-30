/**
 * The opening: the story, told once, before the first level.
 *
 * It lives here rather than as a wall of text on the How To Play screen because
 * a player who never opens a menu should still know why they are running. The
 * lines arrive one at a time, and the colour floods back into the sky behind
 * them as the last one lands - so the screen states the premise and shows the
 * win condition in the same gesture, without a word about either.
 *
 * Skippable with any confirm key, and only shown to a save file that has never
 * finished a level, so it is never something to sit through twice.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { BACK_KEYS, CONFIRM_KEYS, wasKeyPressed } from '../core/input.js';
import { clamp } from '../core/math.js';
import { refreshPalette, setColorRestoration } from '../graphics/palette.js';
import { renderSky } from '../graphics/sky.js';
import { drawText } from '../graphics/typography.js';
import { TEXT_BRIGHT, TEXT_DIM, drawScreenDim } from '../graphics/ui.js';
import { drawWordmark } from '../graphics/wordmark.js';
import { GameplayScreen } from './gameplay-screen.js';
import { Screen, resetScreens } from './screen.js';

const LINES = [
    'The Skyward Meadows held every colour there is.',
    'Then the Gloom came, and drank them all.',
    'You are the last unicorn,',
    'and your horn still holds the seven.',
];

/** How long each line waits before the next one starts fading in. */
const LINE_SECONDS = 1.4;
/** The sky begins to heal here, and the screen ends a moment after it finishes. */
const BLOOM_AT = LINES.length * LINE_SECONDS;

/** The sky is drawn from a camera, and this screen has nowhere to move one. */
const STILL_CAMERA = { x: 0, y: 0 };

export class StoryScreen extends Screen {
    updateStep(elapsedSeconds) {
        super.updateStep(elapsedSeconds);

        if (this.age > BLOOM_AT + 2.6 || wasKeyPressed(CONFIRM_KEYS) || wasKeyPressed(BACK_KEYS)) {
            resetScreens(new GameplayScreen(0));
        }
    }

    render() {
        setColorRestoration(clamp((this.age - BLOOM_AT) * 0.7, 0.04, 1));
        refreshPalette();

        renderSky(STILL_CAMERA, this.age);
        drawScreenDim(0.4);

        LINES.forEach((line, index) => {
            drawText(line, CANVAS_WIDTH / 2, 214 + index * 66, {
                typeSize: 27,
                typeWeight: 700,
                typeSpacing: 1.5,
                inkColor: TEXT_BRIGHT,
                alpha: clamp((this.age - index * LINE_SECONDS) * 1.5, 0, 1),
            });
        });

        // The title only arrives once the colour has, which is the point of it.
        drawWordmark('PRISMHOOF', CANVAS_WIDTH / 2, 116, 56, clamp((this.age - BLOOM_AT) * 1.2, 0, 1));

        drawText('ENTER to begin', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 64, {
            typeSize: 15, typeWeight: 600, typeSpacing: 2, inkColor: TEXT_DIM,
        });
    }
}
