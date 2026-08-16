/**
 * Playing a level.
 *
 * Owns the level's World, the run clock, the colour restoration, and the HUD.
 * Death restarts the level immediately - the clock keeps running, which is what
 * makes the whole game a speedrun rather than a series of attempts.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { BACK_KEYS, wasKeyPressed } from '../core/input.js';
import { clamp, damp } from '../core/math.js';
import { saveData, persistSaveData } from '../core/storage.js';
import { refreshPalette, setColorRestoration, RAINBOW_COLORS } from '../graphics/palette.js';
import { renderSky } from '../graphics/sky.js';
import { drawText, drawRainbowText } from '../graphics/typography.js';
import { TEXT_BRIGHT, TEXT_DIM, drawPaintMeter, formatTime } from '../graphics/ui.js';
import { buildLevelWorld } from '../levels/build-level.js';
import { LEVELS } from '../levels/levels.js';
import { startMusic } from '../audio/music.js';
import { PauseScreen } from './pause-screen.js';
import { TitleScreen } from './title-screen.js';
import { Screen, pushScreen, resetScreens } from './screen.js';

/** How long the death burst plays before the level snaps back. */
const RESTART_DELAY_SECONDS = 0.85;
/** How long the level-cleared banner holds before the next level loads. */
const CLEARED_DELAY_SECONDS = 1.1;

/** Never let a level start pitch black, however much Gloom is left. */
const MINIMUM_RESTORATION = 0.06;

/** How long the rainbow sweeps across the screen between one level and the next. */
const WIPE_SECONDS = 0.45;

export class GameplayScreen extends Screen {
    /** Seconds elapsed across the whole run, carried between levels. */
    runSeconds = 0;
    deaths = 0;

    colorRestoration = 0;
    restartCountdown = 0;
    clearedCountdown = 0;
    /** Flashes the paint meter white when a stroke is refused for lack of paint. */
    meterFlash = 0;

    constructor(levelIndex = 0, runSeconds = 0, deaths = 0) {
        super();
        this.levelIndex = levelIndex;
        this.runSeconds = runSeconds;
        this.deaths = deaths;
        this.loadLevel();
    }

    loadLevel() {
        this.level = buildLevelWorld(LEVELS[this.levelIndex]);
        this.world = this.level.world;
        this.unicorn = this.level.unicorn;

        this.colorRestoration = 0;
        this.restartCountdown = 0;
        this.clearedCountdown = 0;
        // Fully covered, then pulled away: the new level is revealed by the same
        // rainbow that closed over the last one.
        this.wipe = 1;

        this.unicorn.onDeath = () => {
            this.deaths++;
            this.restartCountdown = RESTART_DELAY_SECONDS;
        };
        this.unicorn.onGateEntered = () => {
            this.clearedCountdown = CLEARED_DELAY_SECONDS;
        };

        saveData.furthestLevelIndex = Math.max(saveData.furthestLevelIndex, this.levelIndex);
        persistSaveData();
    }

    onResume() {
        startMusic(true);
    }

    update(elapsedSeconds) {
        super.update(elapsedSeconds);

        if (wasKeyPressed(BACK_KEYS) || wasKeyPressed(['KeyP'])) {
            pushScreen(new PauseScreen(this));
            return;
        }

        // Retry on demand, so a doomed attempt never has to be waited out.
        if (wasKeyPressed(['KeyR']) && !this.clearedCountdown) {
            this.deaths++;
            this.loadLevel();
            return;
        }

        this.runSeconds += elapsedSeconds;
        this.meterFlash = damp(this.meterFlash, 0, 8, elapsedSeconds);

        // Closes over the level once it is cleared, and pulls back off the new
        // one the moment it loads.
        this.wipe = clamp(
            this.wipe + (this.clearedCountdown > 0 ? 1 : -1) * elapsedSeconds / WIPE_SECONDS,
            0, 1,
        );

        this.updateRestoration(elapsedSeconds);
        this.world.update(elapsedSeconds);

        if (this.clearedCountdown > 0) {
            this.clearedCountdown -= elapsedSeconds;
            if (this.clearedCountdown <= 0) this.advanceLevel();
            return;
        }

        if (this.restartCountdown > 0) {
            this.restartCountdown -= elapsedSeconds;
            if (this.restartCountdown <= 0) this.loadLevel();
        }
    }

    /** Colour returns as the Gloom is purified, eased so each kill is a bloom. */
    updateRestoration(elapsedSeconds) {
        const remaining = this.world.entitiesOfCategory('gloom').length;
        const target = this.level.gloomTotal ? 1 - remaining / this.level.gloomTotal : 1;

        this.colorRestoration = damp(this.colorRestoration, target, 3, elapsedSeconds);
        setColorRestoration(clamp(this.colorRestoration, MINIMUM_RESTORATION, 1));
        refreshPalette();
    }

    advanceLevel() {
        if (this.levelIndex + 1 >= LEVELS.length) {
            const isBest = !saveData.bestRunSeconds || this.runSeconds < saveData.bestRunSeconds;
            if (isBest) {
                saveData.bestRunSeconds = this.runSeconds;
                persistSaveData();
            }
            resetScreens(new TitleScreen({ seconds: this.runSeconds, deaths: this.deaths, isBest }));
            return;
        }

        this.levelIndex++;
        this.loadLevel();
    }

    render() {
        renderSky(this.world.camera, this.age);
        this.world.render();
        this.renderHud();
        this.renderWipe();
    }

    /**
     * The transition between levels: seven rainbow bands sweeping the screen.
     *
     * They are staggered by a fraction of a band each so the sweep reads as one
     * rainbow being drawn across the screen rather than seven bars moving in
     * lockstep, and they always travel the same way, so closing one level and
     * opening the next is a single continuous gesture.
     */
    renderWipe() {
        if (!this.wipe) return;

        const bandHeight = CANVAS_HEIGHT / RAINBOW_COLORS.length;
        const closing = this.clearedCountdown > 0;

        RAINBOW_COLORS.forEach((color, index) => {
            const width = CANVAS_WIDTH * clamp(this.wipe * 1.5 - index * 0.08, 0, 1);
            canvasContext.fillStyle = color;
            canvasContext.fillRect(closing ? 0 : CANVAS_WIDTH - width, index * bandHeight, width, bandHeight + 1);
        });
    }

    renderHud() {
        const context = canvasContext;

        drawText(`${this.levelIndex + 1}/${LEVELS.length}  ${this.level.name}`, 26, 32, {
            size: 19,
            weight: 800,
            spacing: 2,
            align: 'left',
            color: TEXT_BRIGHT,
        });

        drawText(formatTime(this.runSeconds), CANVAS_WIDTH - 26, 32, {
            size: 22,
            weight: 800,
            spacing: 1,
            align: 'right',
            color: TEXT_BRIGHT,
        });

        // Paint meter, bottom left, where a glance costs the least attention.
        drawPaintMeter(26, CANVAS_HEIGHT - 42, 210, 15, this.unicorn.paintEnergy, this.meterFlash);
        drawText('PAINT', 26, CANVAS_HEIGHT - 58, {
            size: 13,
            weight: 700,
            spacing: 2.5,
            align: 'left',
            color: TEXT_DIM,
        });

        const remaining = this.world.entitiesOfCategory('gloom').length;
        if (this.level.gloomTotal) {
            drawText(remaining ? `GLOOM  ${remaining}` : 'GATE OPEN', CANVAS_WIDTH - 26, CANVAS_HEIGHT - 44, {
                size: 22,
                weight: 800,
                spacing: 2.5,
                align: 'right',
                color: remaining ? TEXT_BRIGHT : RAINBOW_COLORS[(this.age * 6 | 0) % 7],
            });
        }

        this.renderBanners(context);
    }

    renderBanners() {
        if (this.clearedCountdown > 0) {
            drawRainbowText('LEVEL CLEARED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30, {
                size: 62,
                weight: 900,
                spacing: 5,
            });
        }

        if (this.restartCountdown > 0) {
            drawText('THE GLOOM TOOK YOU', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20, {
                size: 40,
                weight: 900,
                spacing: 4,
                color: TEXT_BRIGHT,
                alpha: clamp((RESTART_DELAY_SECONDS - this.restartCountdown) * 3, 0, 1),
            });
        }
    }
}
