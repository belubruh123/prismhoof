/**
 * The pause menu.
 *
 * Drawn over the frozen level rather than replacing it, so the player keeps
 * their bearings. How To Play and Settings are reachable from here as well as
 * from the title, since that is where a confused player actually is.
 */

import { CANVAS_WIDTH } from '../config.js';
import { drawText } from '../graphics/typography.js';
import { drawWordmark } from '../graphics/wordmark.js';
import { TEXT_DIM, drawMenu, drawPanel, drawScreenDim, formatTime } from '../graphics/ui.js';
import { HowToPlayScreen } from './how-to-play-screen.js';
import { SettingsScreen } from './settings-screen.js';
import { MenuScreen, popScreen, pushScreen, resetScreens } from './screen.js';
import { TitleScreen } from './title-screen.js';

export class PauseScreen extends MenuScreen {
    constructor(gameplayScreen) {
        super();
        this.gameplayScreen = gameplayScreen;

        this.menuItems = [
            { menuLabel: 'RESUME', onSelect: () => popScreen() },
            { menuLabel: 'RETRY LEVEL', onSelect: () => this.retryLevel() },
            { menuLabel: 'HOW TO PLAY', onSelect: () => pushScreen(new HowToPlayScreen()) },
            { menuLabel: 'SETTINGS', onSelect: () => pushScreen(new SettingsScreen()) },
            { menuLabel: 'ABANDON RUN', onSelect: () => resetScreens(new TitleScreen()) },
        ];
    }

    onBack() {
        popScreen();
    }

    retryLevel() {
        this.gameplayScreen.deaths++;
        this.gameplayScreen.loadLevel();
        popScreen();
    }

    render() {
        // The level underneath is still drawn by the stack; this only dims it.
        drawScreenDim(0.62);
        drawPanel(CANVAS_WIDTH / 2 - 280, 128, 560, 424);

        drawWordmark('PAUSED', CANVAS_WIDTH / 2, 190, 42);

        drawText(
            `${this.gameplayScreen.activeLevel.levelTitle}   -   ${formatTime(this.gameplayScreen.runSeconds)}`,
            CANVAS_WIDTH / 2, 240,
            { typeSize: 16, typeWeight: 700, typeSpacing: 2, inkColor: TEXT_DIM },
        );

        drawMenu(this.menuItems, this.chosenIndex, CANVAS_WIDTH / 2, 306, {
            time: this.age,
            width: 430,
            typeSize: 24,
            rowStep: 48,
        });
    }
}
