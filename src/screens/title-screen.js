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
    name: 'TITLE',
    rows: [
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
        this.scene.world.camera.target = null;
        this.scene.world.camera.snapTo(this.scene.unicorn.x - TITLE_CAMERA_OFFSET, this.scene.unicorn.y - 60);

        this.items = [
            {
                label: completedRun ? 'RUN IT AGAIN' : saveData.furthestLevelIndex ? 'CONTINUE' : 'PLAY',
                onSelect: () => resetScreens(new GameplayScreen(0)),
            },
            { label: 'HOW TO PLAY', onSelect: () => pushScreen(new HowToPlayScreen()) },
            { label: 'SETTINGS', onSelect: () => pushScreen(new SettingsScreen()) },
        ];
    }

    onResume() {
        startMusic(false);
    }

    update(elapsedSeconds) {
        super.update(elapsedSeconds);

        // The title meadow is already saved, so it shows in full colour.
        setColorRestoration(1);
        refreshPalette();
        this.scene.world.update(elapsedSeconds);

        // A steady drizzle of celebration off the mane, but only after a win.
        if (this.completedRun && this.age % 0.4 < elapsedSeconds) this.scene.unicorn.emitManeSparkles(3);
    }

    render() {
        setColorRestoration(1);
        refreshPalette();

        renderSky(this.scene.world.camera, this.age);
        this.scene.world.render();

        const titleY = 150 + sin(this.age * 1.2) * 4;
        drawRainbowText('PRISMHOOF', CANVAS_WIDTH / 2, titleY, { size: 92, weight: 900, spacing: 12 });

        if (this.completedRun) this.renderResult(titleY + 70);
        else {
            drawText('THE GLOOM TOOK THE COLOUR. TAKE IT BACK.', CANVAS_WIDTH / 2, titleY + 62, {
                size: 19,
                weight: 600,
                spacing: 4,
                color: TEXT_BRIGHT,
            });
        }

        drawMenu(this.items, this.selectedIndex, CANVAS_WIDTH / 2, this.completedRun ? 468 : 372, {
            time: this.age,
            width: 420,
        });

        if (saveData.bestRunSeconds && !this.completedRun) {
            drawText(`BEST RUN  ${formatTime(saveData.bestRunSeconds)}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 96, {
                size: 17,
                weight: 700,
                spacing: 2.5,
                color: TEXT_DIM,
            });
        }

        drawText('js13kGames 2026 - UNICORNS AND RAINBOWS', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30, {
            size: 14,
            weight: 600,
            spacing: 2,
            color: TEXT_DIM,
        });
    }

    renderResult(y) {
        const { seconds, deaths, isBest } = this.completedRun;

        drawText(`THE MEADOW IS BRIGHT AGAIN - ALL ${LEVELS.length} LEVELS CLEARED`, CANVAS_WIDTH / 2, y, {
            size: 18,
            weight: 700,
            spacing: 3,
            color: TEXT_BRIGHT,
        });

        drawText(formatTime(seconds), CANVAS_WIDTH / 2, y + 74, {
            size: 68,
            weight: 900,
            spacing: 3,
            color: TEXT_BRIGHT,
        });

        drawText(
            `${isBest ? 'NEW BEST RUN' : `BEST ${formatTime(saveData.bestRunSeconds)}`}`
            + `   -   ${deaths} ${deaths === 1 ? 'fall' : 'falls'}`,
            CANVAS_WIDTH / 2, y + 126,
            { size: 16, weight: 800, spacing: 2.5, color: isBest ? TEXT_BRIGHT : TEXT_DIM },
        );
    }
}
