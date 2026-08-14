/**
 * The end of a run: the meadow in full colour, the final time, and the way back.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { sin } from '../core/math.js';
import { saveData } from '../core/storage.js';
import { refreshPalette, setColorRestoration } from '../graphics/palette.js';
import { renderSky } from '../graphics/sky.js';
import { drawRainbowText, drawText } from '../graphics/typography.js';
import {
    TEXT_BRIGHT,
    TEXT_DIM,
    drawDriftingSparkles,
    drawMenu,
    drawPanel,
    formatTime,
} from '../graphics/ui.js';
import { buildLevelWorld } from '../levels/build-level.js';
import { LEVELS } from '../levels/levels.js';
import { startMusic } from '../audio/music.js';
import { GameplayScreen } from './gameplay-screen.js';
import { MenuScreen, resetScreens } from './screen.js';
import { TitleScreen } from './title-screen.js';

const CELEBRATION_SCENE = {
    name: 'ENDING',
    rows: [
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '............P.............',
        '##########################',
        '##########################',
        '##########################',
        '##########################',
        '##########################',
    ],
};

export class GameCompleteScreen extends MenuScreen {
    constructor(runSeconds, deaths, isBest) {
        super();
        this.runSeconds = runSeconds;
        this.deaths = deaths;
        this.isBest = isBest;

        this.scene = buildLevelWorld(CELEBRATION_SCENE);
        this.scene.world.camera.snapTo(this.scene.unicorn.x, this.scene.unicorn.y - 40);

        this.items = [
            { label: 'RUN IT AGAIN', onSelect: () => resetScreens(new GameplayScreen(0)) },
            { label: 'MAIN MENU', onSelect: () => resetScreens(new TitleScreen()) },
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

        // A steady drizzle of celebration sparkles from the unicorn's mane.
        if (this.age % 0.35 < elapsedSeconds) this.scene.unicorn.emitManeSparkles(3);
    }

    render() {
        setColorRestoration(1);
        refreshPalette();

        renderSky(this.scene.world.camera, this.age);
        this.scene.world.render();
        drawDriftingSparkles(this.age, 26, CANVAS_WIDTH, CANVAS_HEIGHT);

        drawPanel(CANVAS_WIDTH / 2 - 300, 92, 600, 356);

        drawRainbowText('THE MEADOW IS BRIGHT AGAIN', CANVAS_WIDTH / 2, 152, {
            size: 34,
            weight: 900,
            spacing: 4,
        });

        drawText(`All ${LEVELS.length} levels cleared`, CANVAS_WIDTH / 2, 194, {
            size: 17, weight: 600, spacing: 2, color: TEXT_DIM,
        });

        const timeY = 262 + sin(this.age * 2) * (this.isBest ? 3 : 0);
        drawText(formatTime(this.runSeconds), CANVAS_WIDTH / 2, timeY, {
            size: 66, weight: 900, spacing: 3, color: TEXT_BRIGHT, shadowOffset: 3,
        });

        drawText(
            this.isBest ? 'NEW BEST RUN' : `BEST  ${formatTime(saveData.bestRunSeconds)}`,
            CANVAS_WIDTH / 2, 312,
            {
                size: 16,
                weight: 800,
                spacing: 3,
                color: this.isBest ? TEXT_BRIGHT : TEXT_DIM,
            },
        );

        drawText(`${this.deaths} ${this.deaths === 1 ? 'fall' : 'falls'} along the way`, CANVAS_WIDTH / 2, 344, {
            size: 15, weight: 600, spacing: 1.5, color: TEXT_DIM,
        });

        drawMenu(this.items, this.selectedIndex, CANVAS_WIDTH / 2, 396, {
            time: this.age,
            width: 380,
            size: 22,
            lineHeight: 44,
        });
    }
}
