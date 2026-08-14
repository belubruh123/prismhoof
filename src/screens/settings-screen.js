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
import { persistSaveData, resetSaveData, saveData } from '../core/storage.js';
import { drawRainbowText, drawText } from '../graphics/typography.js';
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
        this.items = [
            {
                label: 'MUSIC',
                onSelect: () => this.toggleMusic(),
                onAdjust: () => this.toggleMusic(),
            },
            {
                label: 'MUSIC VOLUME',
                onAdjust: (direction) => {
                    saveData.musicVolume = stepVolume(saveData.musicVolume, direction);
                    this.commit();
                },
            },
            {
                label: 'SOUND',
                onSelect: () => this.toggleSound(),
                onAdjust: () => this.toggleSound(),
            },
            {
                label: 'SOUND VOLUME',
                onAdjust: (direction) => {
                    saveData.soundVolume = stepVolume(saveData.soundVolume, direction);
                    this.commit();
                },
            },
            {
                label: 'SCREEN SHAKE',
                onSelect: () => this.toggleScreenShake(),
                onAdjust: () => this.toggleScreenShake(),
            },
            { label: 'ERASE BEST TIME', onSelect: () => resetSaveData() },
            { label: 'BACK', onSelect: () => popScreen() },
        ];
    }

    onBack() {
        popScreen();
    }

    commit() {
        persistSaveData();
        applyVolumeSettings();
    }

    /** Muting stops the scheduler outright rather than just turning the bus down. */
    toggleMusic() {
        saveData.musicEnabled = !saveData.musicEnabled;
        this.commit();

        if (saveData.musicEnabled) startMusic(false);
        else if (isMusicRunning()) stopMusic();
    }

    toggleSound() {
        saveData.soundEnabled = !saveData.soundEnabled;
        this.commit();
    }

    toggleScreenShake() {
        saveData.screenShakeEnabled = !saveData.screenShakeEnabled;
        this.commit();
    }

    render() {
        drawScreenDim(0.72);
        drawPanel(CANVAS_WIDTH / 2 - 330, 110, 660, 470);

        drawRainbowText('SETTINGS', CANVAS_WIDTH / 2, 168, { size: 40, weight: 900, spacing: 6 });

        const onOff = (value) => (value ? 'ON' : 'OFF');
        this.items[0].detail = onOff(saveData.musicEnabled);
        this.items[1].detail = volumeBar(saveData.musicVolume);
        this.items[2].detail = onOff(saveData.soundEnabled);
        this.items[3].detail = volumeBar(saveData.soundVolume);
        this.items[4].detail = onOff(saveData.screenShakeEnabled);

        drawMenu(this.items, this.selectedIndex, CANVAS_WIDTH / 2, 250, {
            time: this.age,
            width: 560,
            size: 22,
            lineHeight: 46,
        });

        drawText('LEFT and RIGHT to change  -  ESC to go back', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 88, {
            size: 15,
            weight: 600,
            spacing: 2,
            color: TEXT_DIM,
        });
    }
}
