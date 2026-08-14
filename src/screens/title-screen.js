/**
 * The title screen.
 *
 * The backdrop is a real level - a flat strip of meadow with a real Unicorn
 * standing on it - rather than a painted mock-up, so the first thing a player
 * sees is the actual character breathing, blinking and flicking its ears.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { sin } from '../core/math.js';
import { saveData } from '../core/storage.js';
import { refreshPalette, setColorRestoration } from '../graphics/palette.js';
import { renderSky } from '../graphics/sky.js';
import { drawRainbowText, drawText } from '../graphics/typography.js';
import { TEXT_BRIGHT, TEXT_DIM, drawDriftingSparkles, drawMenu, formatTime } from '../graphics/ui.js';
import { buildLevelWorld } from '../levels/build-level.js';
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
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '..............................P.............',
        '############################################',
        '############################################',
        '############################################',
    ],
};

/** How far left of the unicorn the camera sits, pushing it to the right. */
const TITLE_CAMERA_OFFSET = 330;

export class TitleScreen extends MenuScreen {
    constructor() {
        super();

        this.scene = buildLevelWorld(TITLE_SCENE);
        // The title meadow is already saved, so it shows in full colour.
        this.scene.world.camera.target = null;
        this.scene.world.camera.snapTo(this.scene.unicorn.x - TITLE_CAMERA_OFFSET, this.scene.unicorn.y - 60);

        this.items = [
            {
                label: saveData.furthestLevelIndex > 0 ? 'CONTINUE' : 'PLAY',
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
        setColorRestoration(1);
        refreshPalette();
        this.scene.world.update(elapsedSeconds);
    }

    render() {
        setColorRestoration(1);
        refreshPalette();

        renderSky(this.scene.world.camera, this.age);
        this.scene.world.render();

        drawDriftingSparkles(this.age, 16, CANVAS_WIDTH, CANVAS_HEIGHT * 0.55);

        const titleY = 168 + sin(this.age * 1.2) * 4;
        drawRainbowText('PRISMHOOF', CANVAS_WIDTH / 2, titleY, { size: 96, weight: 900, spacing: 12 });

        drawText('THE GLOOM TOOK THE COLOUR. TAKE IT BACK.', CANVAS_WIDTH / 2, titleY + 62, {
            size: 19,
            weight: 600,
            spacing: 4,
            color: TEXT_BRIGHT,
            shadowOffset: 2,
        });

        drawMenu(this.items, this.selectedIndex, CANVAS_WIDTH / 2, 372, { time: this.age, width: 420 });

        if (saveData.bestRunSeconds) {
            drawText(`BEST RUN  ${formatTime(saveData.bestRunSeconds)}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 96, {
                size: 17,
                weight: 700,
                spacing: 2.5,
                color: TEXT_DIM,
                shadowOffset: 2,
            });
        }

        drawText('js13kGames 2026  -  UNICORNS AND RAINBOWS', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30, {
            size: 14,
            weight: 600,
            spacing: 2,
            color: TEXT_DIM,
        });
    }
}
