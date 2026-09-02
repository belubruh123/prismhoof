/**
 * Playing a level.
 *
 * Owns the level's World, the run clock, the colour restoration, and the HUD.
 * Death restarts the level immediately - the clock keeps running, which is what
 * makes the whole game a speedrun rather than a series of attempts.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { BACK_KEYS, VIEW_KEYS, wasKeyPressed } from '../core/input.js';
import { clamp, damp } from '../core/math.js';
import { saveData, persistSaveData } from '../core/storage.js';
import { refreshPalette, setColorRestoration } from '../graphics/palette.js';
import { renderSky } from '../graphics/sky.js';
import { drawText } from '../graphics/typography.js';
import { drawWordmark } from '../graphics/wordmark.js';
import { TEXT_BRIGHT, TEXT_DIM, drawGateBadge, drawGloomBadge, drawPaintMeter, drawRainbowWipe, drawScreenDim, formatTime } from '../graphics/ui.js';
import { buildLevelWorld } from '../levels/build-level.js';
import { LEVELS } from '../levels/levels.js';
import { playEndingSong, startMusic } from '../audio/music.js';
import { PauseScreen } from './pause-screen.js';
import { StoryScreen } from './story-screen.js';
import { Screen, pushScreen, resetScreens } from './screen.js';

/** How long the death burst plays before the level snaps back. */
const RESTART_DELAY_SECONDS = 0.85;
/**
 * How long the level-cleared banner holds before the next level loads. Long
 * enough to read the course name and the split under it without hurrying - the
 * rainbow only starts closing over it in the last `WIPE_SECONDS` of that.
 */
const CLEARED_DELAY_SECONDS = 2.4;

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

        // The full arrangement - bass, arpeggio and drums - for as long as a
        // course is under way. Does nothing if the loop is already running,
        // which is every retry.
        startMusic(true);

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

        // Closes over the level at the very end of the cleared hold, and pulls
        // back off the new one the moment it loads. Waiting means the banner is
        // read against the course it is about, rather than being wiped away
        // while the player is still looking at it.
        const isClosing = this.clearedCountdown > 0 && this.clearedCountdown < WIPE_SECONDS;
        this.wipe = clamp(this.wipe + (isClosing ? 1 : -1) * elapsedSeconds / WIPE_SECONDS, 0, 1);

        this.updateRestoration(elapsedSeconds);
        // Under the banner the level runs in slow motion: the plume out of the
        // gate keeps rising, and a unicorn still holding a direction key has
        // four times less room to gallop into the lava with.
        this.world.updateStep(this.clearedCountdown > 0 ? elapsedSeconds / 4 : elapsedSeconds);

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
            // Thirteen courses, and the fanfare and the song behind it have been
            // saved for this one moment. Every course before it got eight bars
            // of the loop and three notes.
            playEndingSong();

            const isBest = !saveData.bestRunSeconds || this.runSeconds < saveData.bestRunSeconds;
            if (isBest) {
                saveData.bestRunSeconds = this.runSeconds;
                persistSaveData();
            }
            // The story screen, told the run's numbers, is the ending; it hands
            // them on to the title when it is done.
            resetScreens(new StoryScreen({ seconds: this.runSeconds, deaths: this.deaths, isBest }));
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
        if (this.wipe) drawRainbowWipe(this.wipe, this.clearedCountdown > 0);
    }


    /**
     * The HUD: four corners, and as few words as it can get away with.
     *
     * Where you are and what the clock says are text, because they are text. The
     * rest is not: how much paint is left is a bar, and what stands between you
     * and the exit is a Gloom with a number beside it, which becomes the gate
     * itself the moment that number runs out.
     *
     * The dash is not on it at all. It comes back the moment you touch ground,
     * which is a rule the player learns in one jump, and a second little bar
     * next to the first one only asked to be read.
     *
     * There are no instruction lines under any of it any more. A HUD that tells
     * you to POUR A RAINBOW THROUGH THEM is a game narrating itself, and the
     * signposts in the meadow already do that job in the level where it matters.
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

        // Bottom left: how much paint is left in the horn, and nothing else.
        drawPaintMeter(26, CANVAS_HEIGHT - 48, 210, 15, this.unicorn.paintEnergy, this.meterFlash);

        // Bottom right: what is left to purify, and then the way out.
        const remaining = this.world.entitiesOfCategory('gloom').length;

        if (remaining) {
            const width = drawText(`${remaining}`, CANVAS_WIDTH - 26, CANVAS_HEIGHT - 40, {
                typeSize: 30,
                typeWeight: 800,
                alignment: 'right',
                inkColor: TEXT_BRIGHT,
            });
            drawGloomBadge(CANVAS_WIDTH - 46 - width, CANVAS_HEIGHT - 40);
        } else {
            drawGateBadge(CANVAS_WIDTH - 42, CANVAS_HEIGHT - 50, this.age);
        }
    }

    /**
     * What the game says between levels, which is a number the player can act
     * on: clearing reports what that level cost, because a single running clock
     * is unreadable without splits and it is the only way to know which chamber
     * is the one worth practising.
     *
     * Dying says nothing at all. The unicorn is thrown off its feet, bursts into
     * the colour it was carrying and the view kicks - a line of text naming what
     * killed you is a caption on a picture that was already clear, and the clock
     * in the corner never stopped, which makes the point better than a sentence
     * about it.
     */
    renderBanners() {
        if (this.clearedCountdown > 0) {
            // The level fades half the way to black under it. The banner has
            // two seconds to be read now, and it has to hold up over a
            // signpost, a rainbow or a wall of grass to use them.
            drawScreenDim(clamp((CLEARED_DELAY_SECONDS - this.clearedCountdown) * 3, 0, 0.5));

            drawWordmark('LEVEL CLEARED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30, 54);

            drawText(`${this.activeLevel.levelTitle}  ${formatTime(this.runSeconds - this.levelStartSeconds)}`,
                CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 32, {
                    typeSize: 24,
                    typeWeight: 800,
                    typeSpacing: 3,
                    inkColor: TEXT_BRIGHT,
                });
        }

    }
}
