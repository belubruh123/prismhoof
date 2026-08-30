/**
 * Settings.
 *
 * Music and sound have independent toggles and volumes, as asked for by the
 * competition's own accessibility guidance and by anyone who wants to listen to
 * something else while they play. Everything is persisted immediately, so a
 * setting survives a reload without needing a confirm step.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { clamp } from '../core/math.js';
import { persistSaveData, saveData } from '../core/storage.js';
import { drawText } from '../graphics/typography.js';
import { drawWordmark } from '../graphics/wordmark.js';
import { TEXT_DIM, drawMenu, drawPanel, drawScreenDim } from '../graphics/ui.js';
import { applyVolumeSettings } from '../audio/audio.js';
import { isMusicRunning, startMusic, stopMusic } from '../audio/music.js';
import { MenuScreen, popScreen } from './screen.js';

const VOLUME_STEP = 0.1;

function stepVolume(level, direction) {
    return clamp(level + direction * VOLUME_STEP, 0, 1);
}

/** Ten blocks, filled to the current level. Reads at a glance, no slider needed. */
function volumeBar(level) {
    const filled = Math.round(level * 10);
    return '|'.repeat(filled) + '.'.repeat(10 - filled);
}

export class SettingsScreen extends MenuScreen {
    constructor() {
        super();
        // Every row names the field it changes outright. Reaching settings
        // through a key string would read more compactly, but the release build
        // mangles property names and cannot see through a string, so the
        // setting would be written to one field and read from another.
        this.menuItems = [
            {
                menuLabel: 'MUSIC',
                onSelect: () => this.toggleMusic(),
                onAdjust: () => this.toggleMusic(),
            },
            {
                menuLabel: 'MUSIC VOLUME',
                onAdjust: (direction) => {
                    saveData.musicVolume = stepVolume(saveData.musicVolume, direction);
                    this.saveAndApply();
                },
            },
            {
                menuLabel: 'SOUND',
                onSelect: () => this.toggleSound(),
                onAdjust: () => this.toggleSound(),
            },
            {
                menuLabel: 'SOUND VOLUME',
                onAdjust: (direction) => {
                    saveData.soundVolume = stepVolume(saveData.soundVolume, direction);
                    this.saveAndApply();
                },
            },
            {
                menuLabel: 'SCREEN SHAKE',
                onSelect: () => this.toggleScreenShake(),
                onAdjust: () => this.toggleScreenShake(),
            },
            { menuLabel: 'BACK', onSelect: () => popScreen() },
        ];
    }

    onBack() {
        popScreen();
    }

    saveAndApply() {
        persistSaveData();
        applyVolumeSettings();
    }

    /** Muting stops the scheduler outright rather than just turning the bus down. */
    toggleMusic() {
        saveData.musicEnabled = !saveData.musicEnabled;
        this.saveAndApply();

        if (saveData.musicEnabled) startMusic(false);
        else if (isMusicRunning()) stopMusic();
    }

    toggleSound() {
        saveData.soundEnabled = !saveData.soundEnabled;
        this.saveAndApply();
    }

    toggleScreenShake() {
        saveData.screenShakeEnabled = !saveData.screenShakeEnabled;
        this.saveAndApply();
    }

    render() {
        drawScreenDim(0.72);
        drawPanel(CANVAS_WIDTH / 2 - 330, 110, 660, 470);

        drawWordmark('SETTINGS', CANVAS_WIDTH / 2, 168, 38);

        const onOff = (value) => (value ? 'ON' : 'OFF');
        this.menuItems[0].subLabel = onOff(saveData.musicEnabled);
        this.menuItems[1].subLabel = volumeBar(saveData.musicVolume);
        this.menuItems[2].subLabel = onOff(saveData.soundEnabled);
        this.menuItems[3].subLabel = volumeBar(saveData.soundVolume);
        this.menuItems[4].subLabel = onOff(saveData.screenShakeEnabled);

        drawMenu(this.menuItems, this.chosenIndex, CANVAS_WIDTH / 2, 250, {
            time: this.age,
            width: 560,
            typeSize: 22,
            rowStep: 46,
        });

        drawText('LEFT / RIGHT to change', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 88, {
            typeSize: 15,
            typeWeight: 600,
            typeSpacing: 2,
            inkColor: TEXT_DIM,
        });
    }
}
