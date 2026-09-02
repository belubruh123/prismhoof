/**
 * The title screen.
 *
 * The backdrop is a real level - a strip of meadow with a real Unicorn standing
 * in it - rather than a painted mock-up, so the first thing a player sees is
 * the actual character breathing, blinking and flicking its ears.
 *
 * The first time the page reaches it, a rainbow sweeps off the screen and the
 * meadow is behind it - the same seven bands that close every level, run once
 * to open the game. It is over in a second and nothing is asked of the player
 * first.
 *
 * There is no press-any-key gate in front of it, and that costs the opening its
 * sound: a browser will not start an AudioContext until it has been handed a
 * gesture. A door you have to knock on is a worse first impression than a
 * silent second of rainbow, so the opening is silent and the music comes up on
 * whatever the player presses next.
 *
 * Finishing a run returns here, but with nothing to say about it: the ending
 * screen has already shown the player their time, and by then this is a title
 * screen again. What is left of a finished run is the BEST RUN line, which is
 * a title screen's business anyway.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { sin } from '../core/math.js';
import { saveData } from '../core/storage.js';
import { refreshPalette, setColorRestoration } from '../graphics/palette.js';
import { renderSky } from '../graphics/sky.js';
import { drawText } from '../graphics/typography.js';
import { TEXT_BRIGHT, TEXT_DIM, drawMenu, drawRainbowWipe, formatTime } from '../graphics/ui.js';
import { drawWordmark } from '../graphics/wordmark.js';
import { buildLevelWorld } from '../levels/build-level.js';
import { expandRows } from '../levels/level-format.js';
import { startMusic } from '../audio/music.js';
import { GameplayScreen } from './gameplay-screen.js';
import { StoryScreen } from './story-screen.js';
import { HowToPlayScreen } from './how-to-play-screen.js';
import { SettingsScreen } from './settings-screen.js';
import { MenuScreen, pushScreen, resetScreens } from './screen.js';

/**
 * A quiet strip of restored meadow for the unicorn to idle on, used here and by
 * the opening and the ending.
 *
 * Deliberately wider than the screen. The camera clamps itself inside the level
 * bounds, so a scene this size is what lets the view sit off to one side of the
 * unicorn and push it clear of the menu, and what gives the ending's drifting
 * shot somewhere to drift to.
 *
 * Written in the run-length form rather than as a picture, which is the one
 * exception in this game. Every level in `levels.js` is drawn as a picture and
 * encoded into this form by the build, so the decoder is in the payload either
 * way - and a spawn point over three identical rows of forty-four hashes is not
 * a picture worth looking at. Nineteen characters against a hundred and
 * seventy-six.
 */
export const TITLE_SCENE = { tileRows: expandRows('.30P.13,#44,#44,#44') };

/**
 * How far left of, and above, the unicorn the camera sits. Left pushes it out
 * to the right of the menu, and up keeps the lava under the meadow out of shot.
 */
const TITLE_CAMERA_OFFSET = 230;
const TITLE_CAMERA_LIFT = 175;

/** How long the rainbow takes to leave the screen, and the cap height it uncovers. */
const INTRO_SECONDS = 1.1;
const LOGO_SIZE = 84;

/** The opening plays once per page load, not every time the title comes back. */
let hasIntroPlayed = false;

export class TitleScreen extends MenuScreen {
    constructor() {
        super();

        this.introAge = hasIntroPlayed ? INTRO_SECONDS : 0;
        hasIntroPlayed = true;

        this.scene = buildLevelWorld(TITLE_SCENE);
        this.scene.world.camera.followTarget = null;
        this.scene.world.camera.snapTo(
            this.scene.unicorn.x - TITLE_CAMERA_OFFSET,
            this.scene.unicorn.y - TITLE_CAMERA_LIFT,
        );

        // Nothing resumes a screen that is put at the bottom of the stack, so
        // arriving from a finished run this has to start the loop itself.
        startMusic(false);

        this.menuItems = [
            {
                menuLabel: saveData.furthestLevelIndex ? 'CONTINUE' : 'PLAY',
                // The premise is for a save file that has never played. Anyone
                // coming back drops straight into the meadow.
                onSelect: () => resetScreens(
                    saveData.furthestLevelIndex ? new GameplayScreen(0) : new StoryScreen(),
                ),
            },
            { menuLabel: 'HOW TO PLAY', onSelect: () => pushScreen(new HowToPlayScreen()) },
            { menuLabel: 'SETTINGS', onSelect: () => pushScreen(new SettingsScreen()) },
        ];
    }

    onResume() {
        startMusic(false);
    }

    updateStep(elapsedSeconds) {
        super.updateStep(elapsedSeconds);
        this.introAge += elapsedSeconds;

        // The title meadow is already saved, so it shows in full colour.
        setColorRestoration(1);
        refreshPalette();
        this.scene.world.updateStep(elapsedSeconds);
    }

    render() {
        setColorRestoration(1);
        refreshPalette();

        renderSky(this.scene.world.camera, this.age);
        this.scene.world.render();

        const titleY = 150 + sin(this.age * 1.2) * 4;
        drawWordmark('PRISMHOOF', CANVAS_WIDTH / 2, titleY, LOGO_SIZE);

        drawText('THE GLOOM TOOK THE COLOUR. TAKE IT BACK.', CANVAS_WIDTH / 2, titleY + 112, {
            typeSize: 19,
            typeWeight: 600,
            typeSpacing: 4,
            inkColor: TEXT_BRIGHT,
        });

        drawMenu(this.menuItems, this.chosenIndex, CANVAS_WIDTH / 2, 372, {
            time: this.age,
            width: 420,
        });

        if (saveData.bestRunSeconds) {
            drawText(`BEST RUN  ${formatTime(saveData.bestRunSeconds)}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 96, {
                typeSize: 17,
                typeWeight: 700,
                typeSpacing: 2.5,
                inkColor: TEXT_DIM,
            });
        }

        // Last, over the lot: the rainbow leaving.
        if (this.introAge < INTRO_SECONDS) drawRainbowWipe(1 - this.introAge / INTRO_SECONDS);
    }

}
