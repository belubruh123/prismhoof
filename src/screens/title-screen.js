/**
 * The title screen, which doubles as the end-of-run screen.
 *
 * The backdrop is a real level - a strip of meadow with a real Unicorn standing
 * in it - rather than a painted mock-up, so the first thing a player sees is
 * the actual character breathing, blinking and flicking its ears.
 *
 * Finishing a run returns here with a `completedRun`, and the tagline is
 * replaced by the result. Landing back on the title with the meadow in full
 * colour behind the numbers is a better ending than a separate screen, and it
 * puts the player one key away from running it again.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { sin } from '../core/math.js';
import { saveData } from '../core/storage.js';
import { refreshPalette, setColorRestoration } from '../graphics/palette.js';
import { renderSky } from '../graphics/sky.js';
import { drawRainbowText, drawText } from '../graphics/typography.js';
import { TEXT_BRIGHT, TEXT_DIM, drawMenu, formatTime } from '../graphics/ui.js';
import { buildLevelWorld } from '../levels/build-level.js';
import { LEVELS } from '../levels/levels.js';
import { startMusic } from '../audio/music.js';
import { GameplayScreen } from './gameplay-screen.js';
import { StoryScreen } from './story-screen.js';
import { HowToPlayScreen } from './how-to-play-screen.js';
import { SettingsScreen } from './settings-screen.js';
import { MenuScreen, pushScreen, resetScreens } from './screen.js';

/**
 * A quiet strip of restored meadow for the unicorn to idle on.
 *
 * Deliberately wider than the screen: the camera clamps itself inside the level
 * bounds and centres any level narrower than the view, so a scene this size is
 * what allows the unicorn to be placed off to one side, clear of the menu.
 */
const TITLE_SCENE = {
    levelTitle: 'TITLE',
    tileRows: [
        '..............................P.............',
        '############################################',
        '############################################',
        '############################################',
    ],
};

/** How far left of the unicorn the camera sits, pushing it to the right. */
const TITLE_CAMERA_OFFSET = 330;

export class TitleScreen extends MenuScreen {
    /** `completedRun` is `{ seconds, deaths, isBest }` after a finished run. */
    constructor(completedRun = null) {
        super();
        this.completedRun = completedRun;

        this.scene = buildLevelWorld(TITLE_SCENE);
        this.scene.world.camera.followTarget = null;
        this.scene.world.camera.snapTo(this.scene.unicorn.x - TITLE_CAMERA_OFFSET, this.scene.unicorn.y - 60);

        this.menuItems = [
            {
                menuLabel: completedRun ? 'RUN IT AGAIN' : saveData.furthestLevelIndex ? 'CONTINUE' : 'PLAY',
                // The opening is for a save file that has never played. Anyone
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

        // The title meadow is already saved, so it shows in full colour.
        setColorRestoration(1);
        refreshPalette();
        this.scene.world.updateStep(elapsedSeconds);

        // A steady drizzle of celebration off the mane, but only after a win.
        if (this.completedRun && this.age % 0.4 < elapsedSeconds) this.scene.unicorn.emitManeSparkles(3);
    }

    render() {
        setColorRestoration(1);
        refreshPalette();

        renderSky(this.scene.world.camera, this.age);
        this.scene.world.render();

        const titleY = 150 + sin(this.age * 1.2) * 4;
        drawRainbowText('PRISMHOOF', CANVAS_WIDTH / 2, titleY, { typeSize: 92, typeWeight: 900, typeSpacing: 12 });

        if (this.completedRun) this.renderResult(titleY + 70);
        else {
            drawText('THE GLOOM TOOK THE COLOUR. TAKE IT BACK.', CANVAS_WIDTH / 2, titleY + 62, {
                typeSize: 19,
                typeWeight: 600,
                typeSpacing: 4,
                inkColor: TEXT_BRIGHT,
            });
        }

        drawMenu(this.menuItems, this.chosenIndex, CANVAS_WIDTH / 2, this.completedRun ? 468 : 372, {
            time: this.age,
            width: 420,
        });

        if (saveData.bestRunSeconds && !this.completedRun) {
            drawText(`BEST RUN  ${formatTime(saveData.bestRunSeconds)}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 96, {
                typeSize: 17,
                typeWeight: 700,
                typeSpacing: 2.5,
                inkColor: TEXT_DIM,
            });
        }

        // One string, not two draws: the copyright rides along on the line that
        // was already here, so it costs characters rather than a call site.
        drawText('js13kGames 2026 - UNICORNS AND RAINBOWS - (C) 2026, ALL RIGHTS RESERVED', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30, {
            typeSize: 14,
            typeWeight: 600,
            typeSpacing: 2,
            inkColor: TEXT_DIM,
        });
    }

    renderResult(y) {
        const { seconds, deaths, isBest } = this.completedRun;

        drawText(`THE MEADOW IS BRIGHT AGAIN - ALL ${LEVELS.length} LEVELS CLEARED`, CANVAS_WIDTH / 2, y, {
            typeSize: 18,
            typeWeight: 700,
            typeSpacing: 3,
            inkColor: TEXT_BRIGHT,
        });

        drawText(formatTime(seconds), CANVAS_WIDTH / 2, y + 74, {
            typeSize: 68,
            typeWeight: 900,
            typeSpacing: 3,
            inkColor: TEXT_BRIGHT,
        });

        drawText(
            `${isBest ? 'NEW BEST RUN' : `BEST ${formatTime(saveData.bestRunSeconds)}`}`
            + `   -   ${deaths} ${deaths === 1 ? 'fall' : 'falls'}`,
            CANVAS_WIDTH / 2, y + 126,
            { typeSize: 16, typeWeight: 800, typeSpacing: 2.5, inkColor: isBest ? TEXT_BRIGHT : TEXT_DIM },
        );
    }
}
