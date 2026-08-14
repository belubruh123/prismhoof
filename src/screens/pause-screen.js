/**
 * The pause menu.
 *
 * Drawn over the frozen level rather than replacing it, so the player keeps
 * their bearings. How To Play and Settings are reachable from here as well as
 * from the title, since that is where a confused player actually is.
 */

import { CANVAS_WIDTH } from '../config.js';
import { drawRainbowText, drawText } from '../graphics/typography.js';
import { TEXT_DIM, drawMenu, drawPanel, drawScreenDim, formatTime } from '../graphics/ui.js';
import { HowToPlayScreen } from './how-to-play-screen.js';
import { SettingsScreen } from './settings-screen.js';
import { MenuScreen, popScreen, pushScreen, resetScreens } from './screen.js';
import { TitleScreen } from './title-screen.js';

export class PauseScreen extends MenuScreen {
    constructor(gameplayScreen) {
        super();
        this.gameplayScreen = gameplayScreen;

        this.items = [
            { label: 'RESUME', onSelect: () => popScreen() },
            { label: 'RETRY LEVEL', onSelect: () => this.retry() },
            { label: 'HOW TO PLAY', onSelect: () => pushScreen(new HowToPlayScreen()) },
            { label: 'SETTINGS', onSelect: () => pushScreen(new SettingsScreen()) },
            { label: 'ABANDON RUN', onSelect: () => resetScreens(new TitleScreen()) },
        ];
    }

    onBack() {
        popScreen();
    }

    retry() {
        this.gameplayScreen.deaths++;
        this.gameplayScreen.loadLevel();
        popScreen();
    }

    render() {
        // The level underneath is still drawn by the stack; this only dims it.
        drawScreenDim(0.62);
        drawPanel(CANVAS_WIDTH / 2 - 280, 128, 560, 424);

        drawRainbowText('PAUSED', CANVAS_WIDTH / 2, 190, { size: 44, weight: 900, spacing: 7 });

        drawText(
            `${this.gameplayScreen.level.name}   -   ${formatTime(this.gameplayScreen.runSeconds)}`,
            CANVAS_WIDTH / 2, 240,
            { size: 16, weight: 700, spacing: 2, color: TEXT_DIM },
        );

        drawMenu(this.items, this.selectedIndex, CANVAS_WIDTH / 2, 306, {
            time: this.age,
            width: 430,
            size: 24,
            lineHeight: 48,
        });
    }
}
