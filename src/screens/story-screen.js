/**
 * The story, told twice: once before the first course and once after the last.
 *
 * The two are the same screen because they are the same thing - lines arriving
 * one at a time over the sky, the wordmark landing on the end of them - and
 * writing the ending as a second screen would have been the same code with
 * different strings in it. What separates them is one argument: the opening
 * gets no `completedRun` and hands over to the first course, the ending gets
 * the run's numbers and hands them to the title.
 *
 * The opening is skippable and only shown to a save file that has never
 * finished a level, so it is never something to sit through twice.
 *
 * Both play over the same strip of meadow, which is the title screen's scene -
 * real ground with the real unicorn standing in it, breathing and blinking -
 * with sparkles coming off the mane once there is something to celebrate. None
 * of that is new; the title screen already builds and frames exactly this, so
 * the opening and closing shots of the game cost a few lines rather than a set
 * of pictures each.
 *
 * Using it for both is also the story. The opening is that meadow drained to
 * grey, with the colour flooding into it as the last line lands; the ending is
 * the same meadow, kept. The screen that shows you what was taken is the screen
 * that shows you it back, and there is nothing to say about that in words.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { BACK_KEYS, CONFIRM_KEYS, wasKeyPressed } from '../core/input.js';
import { clamp } from '../core/math.js';
import { saveData } from '../core/storage.js';
import { refreshPalette, setColorRestoration } from '../graphics/palette.js';
import { renderSky } from '../graphics/sky.js';
import { drawText } from '../graphics/typography.js';
import { TEXT_BRIGHT, TEXT_DIM, drawRainbowWipe, drawScreenDim, formatTime } from '../graphics/ui.js';
import { drawWordmark } from '../graphics/wordmark.js';
import { buildLevelWorld } from '../levels/build-level.js';
import { GameplayScreen } from './gameplay-screen.js';
import { TITLE_SCENE, TitleScreen } from './title-screen.js';
import { Screen, resetScreens } from './screen.js';

const OPENING = [
    'The Skyward Meadows held every colour there is.',
    'Then the Gloom came, and drank them all.',
    'You are the last unicorn,',
    'and your horn still holds the seven.',
];

/**
 * The ending answers the opening line for line, in the same order, and that is
 * both the writing and the reason it costs almost nothing. The second line is
 * the first line of the opening with one letter changed - held becomes hold,
 * because the meadows have it back - and the third is the opening's third,
 * word for word. Fifty-odd characters the payload has not already seen.
 */
const ENDING = [
    'The Gloom is gone.',
    'The Skyward Meadows hold every colour there is.',
    'You are the last unicorn,',
    'and you brought all of it home.',
];

/** How long each line waits before the next one starts fading in. */
const LINE_SECONDS = 1.4;
/** The sky begins to heal here, and the opening ends a moment after it finishes. */
const BLOOM_AT = OPENING.length * LINE_SECONDS;

/** The ending holds far longer, because it is the end. */
const ENDING_SECONDS = 13;
const WIPE_SECONDS = 0.6;

/**
 * The same framing the title screen uses, to the pixel. It puts the unicorn out
 * to the right, clear of centred text, and it means the ending's rainbow closes
 * over a shot and opens on the identical one - the meadow does not move, only
 * the words in front of it do.
 */
const CAMERA_OFFSET = 230;
const CAMERA_LIFT = 175;

export class StoryScreen extends Screen {
    /** `completedRun` is `{ seconds, deaths, isBest }`, and makes this the ending. */
    constructor(completedRun = null) {
        super();
        this.completedRun = completedRun;

        this.scene = buildLevelWorld(TITLE_SCENE);
        this.scene.world.camera.followTarget = null;
        this.scene.world.camera.snapTo(
            this.scene.unicorn.x - CAMERA_OFFSET,
            this.scene.unicorn.y - CAMERA_LIFT,
        );
    }

    updateStep(elapsedSeconds) {
        super.updateStep(elapsedSeconds);

        this.scene.world.updateStep(elapsedSeconds);

        // Only once the meadow is worth celebrating.
        if (this.completedRun && this.age % 0.3 < elapsedSeconds) this.scene.unicorn.emitManeSparkles(2);

        const isOver = this.age > (this.completedRun ? ENDING_SECONDS : BLOOM_AT + 2.6);

        if (isOver || wasKeyPressed(CONFIRM_KEYS) || wasKeyPressed(BACK_KEYS)) {
            resetScreens(this.completedRun ? new TitleScreen() : new GameplayScreen(0));
        }
    }

    render() {
        // The ending is over a meadow that has already been won back, so it
        // opens at full colour; the opening floods it in as the last line lands.
        setColorRestoration(this.completedRun ? 1 : clamp((this.age - BLOOM_AT) * 0.7, 0.04, 1));
        refreshPalette();

        renderSky(this.scene.world.camera, this.age);
        this.scene.world.render();
        drawScreenDim(0.32);

        const lines = this.completedRun ? ENDING : OPENING;

        lines.forEach((line, index) => {
            drawText(line, CANVAS_WIDTH / 2, 214 + index * 66, {
                typeSize: 27,
                typeWeight: 700,
                typeSpacing: 1.5,
                inkColor: TEXT_BRIGHT,
                inkAlpha: clamp((this.age - index * LINE_SECONDS) * 1.5, 0, 1),
            });
        });

        // The title only arrives once the colour has, which is the point of it.
        drawWordmark('PRISMHOOF', CANVAS_WIDTH / 2, 116, 56, clamp((this.age - BLOOM_AT) * 1.2, 0, 1));

        if (this.completedRun) {
            this.renderResult();
            // Out the way everything else in this game goes out.
            drawRainbowWipe(clamp((this.age - ENDING_SECONDS + WIPE_SECONDS) / WIPE_SECONDS, 0, 1), true);
        } else {
            drawText('ENTER to begin', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 64, {
                typeSize: 15, typeWeight: 600, typeSpacing: 2, inkColor: TEXT_DIM,
            });
        }
    }

    /**
     * What the run cost, arriving under the last line of the story.
     *
     * This is the only place the game reports a finished run. It used to be on
     * the title screen, which meant the ending said its piece and then handed
     * the player straight to a menu that said it again in numbers. The story
     * and the clock belong to the same moment.
     */
    renderResult() {
        const { seconds, deaths, isBest } = this.completedRun;
        const inkAlpha = clamp((this.age - BLOOM_AT) * 1.2, 0, 1);

        drawText(formatTime(seconds), CANVAS_WIDTH / 2, 512, {
            typeSize: 68, typeWeight: 900, typeSpacing: 3, inkColor: TEXT_BRIGHT, inkAlpha,
        });

        drawText(
            `${isBest ? 'NEW BEST RUN' : `BEST ${formatTime(saveData.bestRunSeconds)}`}`
            + `   -   ${deaths} ${deaths === 1 ? 'fall' : 'falls'}`,
            CANVAS_WIDTH / 2, 572,
            { typeSize: 16, typeWeight: 800, typeSpacing: 2.5, inkColor: isBest ? TEXT_BRIGHT : TEXT_DIM, inkAlpha },
        );
    }
}
