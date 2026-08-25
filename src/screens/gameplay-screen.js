/**
 * Playing a level.
 *
 * Owns the level's World, the run clock, the colour restoration, and the HUD.
 * Death restarts the level immediately - the clock keeps running, which is what
 * makes the whole game a speedrun rather than a series of attempts.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { BACK_KEYS, VIEW_KEYS, wasKeyPressed } from '../core/input.js';
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
        this.loadLevel(true);
    }

    /**
     * `isNewCourse` is false for a retry, which is what keeps the establishing
     * shot from replaying every single death in a game built around dying.
     */
    loadLevel(isNewCourse) {
        // The run clock never resets, so a level's own time is the difference
        // between where it started and where the clock is now.
        this.levelStartSeconds = this.runSeconds;

        this.activeLevel = buildLevelWorld(LEVELS[this.levelIndex]);
        this.world = this.activeLevel.world;
        this.unicorn = this.activeLevel.unicorn;

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

        // A course is shown whole before the view moves in on it.
        if (isNewCourse) this.world.camera.establish();

        saveData.furthestLevelIndex = Math.max(saveData.furthestLevelIndex, this.levelIndex);
        persistSaveData();
    }

    onResume() {
        startMusic(true);
    }

    updateStep(elapsedSeconds) {
        super.updateStep(elapsedSeconds);

        if (wasKeyPressed(BACK_KEYS) || wasKeyPressed(['KeyP'])) {
            pushScreen(new PauseScreen(this));
            return;
        }

        // The view is the player's to set. Taking hold of it also cuts the
        // establishing shot short, because someone reaching for the camera key
        // is not waiting to be shown the course.
        if (wasKeyPressed(VIEW_KEYS)) {
            saveData.isViewFocused = !saveData.isViewFocused;
            this.world.camera.establishSeconds = 0;
            persistSaveData();
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
        this.world.updateStep(elapsedSeconds);

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
        const followTarget = this.activeLevel.gloomTotal ? 1 - remaining / this.activeLevel.gloomTotal : 1;

        this.colorRestoration = damp(this.colorRestoration, followTarget, 3, elapsedSeconds);
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
        this.loadLevel(true);
    }

    render() {
        renderSky(this.world.camera, this.age);
        this.world.render();
        this.renderHud();
        this.renderBanners();
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

        RAINBOW_COLORS.forEach((inkColor, index) => {
            const width = CANVAS_WIDTH * clamp(this.wipe * 1.5 - index * 0.08, 0, 1);
            canvasContext.fillStyle = inkColor;
            canvasContext.fillRect(closing ? 0 : CANVAS_WIDTH - width, index * bandHeight, width, bandHeight + 1);
        });
    }

    /**
     * The HUD, which is every word the game says while you are playing.
     *
     * The rule it follows: a number on its own is a fact, and a fact is not the
     * same as knowing what to do. So the Gloom count carries the instruction
     * underneath it, the timer carries the price of dying next to it, and the
     * dash - the one piece of the unicorn's state that is invisible on the
     * character itself - gets a word rather than an icon nobody can decode.
     *
     * All of it is drawn on the canvas with the same typography as the rest of
     * the game. There is not one HTML element anywhere in PRISMHOOF: the page is
     * a single <canvas> tag, so the whole interface letterboxes, scales and
     * screenshots with the game and looks identical in every browser.
     */
    renderHud() {
        drawText(`${this.levelIndex + 1}/${LEVELS.length}  ${this.activeLevel.levelTitle}`, 26, 32, {
            typeSize: 19,
            typeWeight: 800,
            typeSpacing: 2,
            alignment: 'left',
            inkColor: TEXT_BRIGHT,
        });

        drawText(formatTime(this.runSeconds), CANVAS_WIDTH - 26, 32, {
            typeSize: 22,
            typeWeight: 800,
            typeSpacing: 1,
            alignment: 'right',
            inkColor: TEXT_BRIGHT,
        });

        // Deaths cost time rather than lives, so the tally belongs beside the
        // clock it is charged to. Hidden on a clean run, which is the reward.
        if (this.deaths) {
            drawText(`DEATHS  ${this.deaths}`, CANVAS_WIDTH - 26, 58, {
                typeSize: 14,
                typeWeight: 700,
                typeSpacing: 2.5,
                alignment: 'right',
                inkColor: TEXT_DIM,
            });
        }

        // Paint meter, bottom left, where a glance costs the least attention.
        drawPaintMeter(26, CANVAS_HEIGHT - 42, 210, 15, this.unicorn.paintEnergy, this.meterFlash);
        drawText('PAINT', 26, CANVAS_HEIGHT - 58, {
            typeSize: 13,
            typeWeight: 700,
            typeSpacing: 2.5,
            alignment: 'left',
            inkColor: TEXT_DIM,
        });

        const hasDash = this.unicorn.hasDash;
        drawText(hasDash ? 'DASH READY' : 'DASH SPENT - ONCE PER JUMP', 26, CANVAS_HEIGHT - 20, {
            typeSize: 13,
            typeWeight: 700,
            typeSpacing: 2.5,
            alignment: 'left',
            inkColor: hasDash ? TEXT_BRIGHT : TEXT_DIM,
        });

        const remaining = this.world.entitiesOfCategory('gloom').length;

        drawText(remaining ? `${remaining} GLOOM LEFT` : 'GATE OPEN', CANVAS_WIDTH - 26, CANVAS_HEIGHT - 44, {
            typeSize: 22,
            typeWeight: 800,
            typeSpacing: 2.5,
            alignment: 'right',
            inkColor: remaining ? TEXT_BRIGHT : RAINBOW_COLORS[(this.age * 6 | 0) % 7],
        });

        // The line that turns the count into an instruction.
        drawText(remaining ? 'POUR A RAINBOW THROUGH THEM' : 'RUN THROUGH IT', CANVAS_WIDTH - 26, CANVAS_HEIGHT - 20, {
            typeSize: 13,
            typeWeight: 700,
            typeSpacing: 2.5,
            alignment: 'right',
            inkColor: TEXT_DIM,
        });
    }

    /**
     * The two things the game says between levels, and both of them are numbers
     * the player can act on. Clearing tells you what that level cost, because a
     * single running clock is unreadable without splits - it is the only way to
     * know which chamber is the one to practise. Dying restates the rule that
     * makes the whole game a run rather than a series of attempts.
     */
    renderBanners() {
        if (this.clearedCountdown > 0) {
            drawRainbowText('LEVEL CLEARED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30, {
                typeSize: 62,
                typeWeight: 900,
                typeSpacing: 5,
            });

            drawText(`${this.activeLevel.levelTitle}  ${formatTime(this.runSeconds - this.levelStartSeconds)}`,
                CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 32, {
                    typeSize: 24,
                    typeWeight: 800,
                    typeSpacing: 3,
                    inkColor: TEXT_BRIGHT,
                });
        }

        if (this.restartCountdown > 0) {
            const fadeIn = clamp((RESTART_DELAY_SECONDS - this.restartCountdown) * 3, 0, 1);

            drawText(this.unicorn.deathCause, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20, {
                typeSize: 40,
                typeWeight: 900,
                typeSpacing: 4,
                inkColor: TEXT_BRIGHT,
                alpha: fadeIn,
            });

            drawText('THE CLOCK NEVER STOPS', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 26, {
                typeSize: 18,
                typeWeight: 700,
                typeSpacing: 3,
                inkColor: TEXT_DIM,
                alpha: fadeIn,
            });
        }
    }
}
