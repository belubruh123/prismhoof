/**
 * The title screen, which doubles as the end-of-run screen.
 *
 * The backdrop is a real level - a strip of meadow with a real Unicorn standing
 * in it - rather than a painted mock-up, so the first thing a player sees is
 * the actual character breathing, blinking and flicking its ears.
 *
 * The very first time the page reaches it, the screen is also the opening: a
 * beam of white light runs in out of the dark, breaks against a horn, throws
 * seven beams that wipe the meadow into view, and the wordmark lands on top of
 * them. It waits for a key press before any of that starts, because a browser
 * will not open an AudioContext until it has been given one - and an opening
 * with chimes in it is worth the half second it costs to be allowed to make a
 * sound.
 *
 * Finishing a run returns here with a `completedRun`, and the tagline is
 * replaced by the result. Landing back on the title with the meadow in full
 * colour behind the numbers is a better ending than a separate screen, and it
 * puts the player one key away from running it again.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { wasAnyKeyPressed } from '../core/input.js';
import { clamp, min, randomBetween, sin } from '../core/math.js';
import { saveData } from '../core/storage.js';
import { HORN_COLOR, INK_BLACK, RAINBOW_COLORS, UNICORN_COAT, refreshPalette, setColorRestoration } from '../graphics/palette.js';
import { renderSky } from '../graphics/sky.js';
import { drawText } from '../graphics/typography.js';
import { TEXT_BRIGHT, TEXT_DIM, drawMenu, formatTime } from '../graphics/ui.js';
import { drawWordmark } from '../graphics/wordmark.js';
import { buildLevelWorld } from '../levels/build-level.js';
import { startMusic } from '../audio/music.js';
import { playGateSound, playJumpSound, playLandSound, playNoise, playPurifySound } from '../audio/sfx.js';
import { GameplayScreen } from './gameplay-screen.js';
import { HowToPlayScreen } from './how-to-play-screen.js';
import { SettingsScreen } from './settings-screen.js';
import { MenuScreen, pushScreen, resetScreens } from './screen.js';

/**
 * A quiet strip of restored meadow for the unicorn to idle on.
 *
 * Deliberately wider than the screen. The camera clamps itself inside the level
 * bounds, so a scene this size is what lets the view sit off to one side of the
 * unicorn and push it clear of the menu.
 */
const TITLE_SCENE = {
    levelTitle: 'TITLE',
    tileRows: [
        '..............................P.............',
        '############################################',
        '############################################',
        '############################################',
    ],
};

/**
 * How far left of, and above, the unicorn the camera sits. Left pushes it out
 * to the right of the menu; up keeps the lava under the meadow out of shot,
 * where the copyright line goes.
 */
const TITLE_CAMERA_OFFSET = 230;
const TITLE_CAMERA_LIFT = 175;

/**
 * The opening's clock: the beam lands at STRIKE, the wordmark at SLAM, and the
 * menu is live again at SECONDS. Before zero the screen is holding for the key
 * press that lets it make a noise.
 */
const INTRO_STRIKE = 0.4;
const INTRO_SLAM = 1.2;
const INTRO_SECONDS = 2;

/**
 * Where the horn stands, and the angle the light runs in along. It is well left
 * of centre because a prism throws its spectrum forwards: put the horn in the
 * middle and half the screen never sees a colour.
 */
const HORN_X = 300;
const HORN_Y = 320;
const BEAM_ANGLE = 0.2;
const LOGO_SIZE = 84;
const HORN_LENGTH = 128;
const HORN_HALF_WIDTH = 21;

/**
 * The opening's sound, fired as the clock passes each mark. Every one of these
 * is a noise the game already makes somewhere else - the landing thud, the gate
 * chime, the purify chord - so the whole soundtrack of the opening costs the
 * three lines that name them and nothing else.
 */
const INTRO_CUES = [
    [0, () => (playNoise(0.4, 0.3, 300, 7000), playJumpSound(0.5))],
    [INTRO_STRIKE, () => (playLandSound(1), playGateSound())],
    [INTRO_SLAM, playPurifySound],
];

/** 1 at `at`, decaying to nothing over 1/`rate` seconds, and flat 0 before it. */
const spike = (age, at, rate) => clamp(1 - (age - at) * rate, 0, age > at ? 1 : 0);

/** The opening plays once per page load, not every time the title comes back. */
let hasIntroPlayed = false;

export class TitleScreen extends MenuScreen {
    /** `completedRun` is `{ seconds, deaths, isBest }` after a finished run. */
    constructor(completedRun = null) {
        super();
        this.completedRun = completedRun;

        this.introAge = hasIntroPlayed ? INTRO_SECONDS : -1;
        this.introCue = 0;
        hasIntroPlayed = true;

        this.scene = buildLevelWorld(TITLE_SCENE);
        this.scene.world.camera.followTarget = null;
        this.scene.world.camera.snapTo(
            this.scene.unicorn.x - TITLE_CAMERA_OFFSET,
            this.scene.unicorn.y - TITLE_CAMERA_LIFT,
        );

        this.menuItems = [
            {
                menuLabel: completedRun ? 'RUN IT AGAIN' : saveData.furthestLevelIndex ? 'CONTINUE' : 'PLAY',
                onSelect: () => resetScreens(new GameplayScreen(0)),
            },
            { menuLabel: 'HOW TO PLAY', onSelect: () => pushScreen(new HowToPlayScreen()) },
            { menuLabel: 'SETTINGS', onSelect: () => pushScreen(new SettingsScreen()) },
        ];
    }

    onResume() {
        startMusic(false);
    }

    updateStep(elapsedSeconds) {
        const isOpening = this.introAge < INTRO_SECONDS;

        if (isOpening) {
            // The first press starts the opening, because it is also what unlocks
            // the audio context; a second one skips whatever is left of it.
            if (wasAnyKeyPressed()) {
                if (this.introAge < 0) this.introAge = 0;
                else this.introAge = INTRO_SECONDS, this.introCue = INTRO_CUES.length;
            } else if (this.introAge >= 0) {
                this.introAge += elapsedSeconds;
            }

            while (INTRO_CUES[this.introCue]?.[0] <= this.introAge) INTRO_CUES[this.introCue++][1]();

            // The menu stays deaf until the opening is over, so the key that
            // starts it does not also pick whatever the cursor is sitting on.
            this.age += elapsedSeconds;
        } else super.updateStep(elapsedSeconds);

        // The title meadow is already saved, so it shows in full colour.
        setColorRestoration(1);
        refreshPalette();
        this.scene.world.updateStep(elapsedSeconds);

        // A steady drizzle of celebration off the mane, but only after a win.
        if (this.completedRun && this.age % 0.4 < elapsedSeconds) this.scene.unicorn.emitManeSparkles(3);
    }

    render() {
        const context = canvasContext;
        const age = this.introAge;

        setColorRestoration(1);
        refreshPalette();

        // One jolt as the beam lands and one as the wordmark does, thrown at the
        // whole frame rather than at the camera, so the lettering is shaken about
        // together with the meadow behind it. It punches in as it shakes, because
        // a shake on its own drags the cleared edge of the canvas into shot.
        const jolt = saveData.screenShakeEnabled
            && spike(age, INTRO_STRIKE, 3) * 15 + spike(age, INTRO_SLAM, 5) * 10;
        if (jolt) {
            // Scaling about the origin grows the frame down and right, so half of
            // that growth comes back out of the same translate the shake uses.
            const punch = jolt / 200;
            context.translate(
                randomBetween(-jolt, jolt) - CANVAS_WIDTH * punch / 2,
                randomBetween(-jolt, jolt) - CANVAS_HEIGHT * punch / 2,
            );
            context.scale(1 + punch, 1 + punch);
        }

        renderSky(this.scene.world.camera, this.age);
        this.scene.world.render();

        if (age < INTRO_SECONDS) this.renderOpening();

        // Above the screen and oversized until the slam, then a small rebound:
        // the mark is stamped down rather than faded up.
        const titleY = 150 + sin(this.age * 1.2) * 4;
        const fall = clamp((INTRO_SLAM - age) * 3, 0, 1);
        drawWordmark(
            'PRISMHOOF', CANVAS_WIDTH / 2, titleY - fall * 110,
            LOGO_SIZE * (1 + fall + spike(age, INTRO_SLAM, 10) * 0.1),
            clamp((age - INTRO_SLAM + 0.25) * 5, 0, 1),
        );

        // Everything under the mark arrives after it, faded up as one block.
        context.globalAlpha = clamp((age - INTRO_SLAM - 0.3) * 3, 0, 1);

        if (this.completedRun) this.renderResult(titleY + 116);
        else {
            drawText('THE GLOOM TOOK THE COLOUR. TAKE IT BACK.', CANVAS_WIDTH / 2, titleY + 112, {
                typeSize: 19,
                typeWeight: 600,
                typeSpacing: 4,
                inkColor: TEXT_BRIGHT,
            });
        }

        drawMenu(this.menuItems, this.chosenIndex, CANVAS_WIDTH / 2, this.completedRun ? 468 : 372, {
            time: this.age,
            width: 420,
        });

        if (saveData.bestRunSeconds && !this.completedRun) {
            drawText(`BEST RUN  ${formatTime(saveData.bestRunSeconds)}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 96, {
                typeSize: 17,
                typeWeight: 700,
                typeSpacing: 2.5,
                inkColor: TEXT_DIM,
            });
        }

        // One string, not two draws: the licence line rides along on the line that
        // was already here, so it costs characters rather than a call site.
        drawText('js13kGames 2026 - UNICORNS AND RAINBOWS - CC0 PUBLIC DOMAIN', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30, {
            typeSize: 14,
            typeWeight: 600,
            typeSpacing: 2,
            inkColor: TEXT_DIM,
        });
    }

    /**
     * The opening, drawn over the meadow it is about to reveal.
     *
     * The beam and the seven that come out of it are all rectangles and
     * triangles around a single origin, so the whole sequence is the same
     * rotate-and-fill the rest of the game is built from.
     */
    renderOpening() {
        const context = canvasContext;
        const age = this.introAge;
        const opened = age - INTRO_STRIKE;

        // The dark the light arrives in, lifted by the fan as it opens - so the
        // meadow reads as revealed by the rainbow rather than faded up behind it.
        context.globalAlpha = clamp((INTRO_STRIKE + 0.8 - age) * 2, 0, 1);
        context.fillStyle = INK_BLACK;
        context.fillRect(-99, -99, 4000, 4000);

        context.save();
        context.translate(HORN_X, HORN_Y);
        context.rotate(BEAM_ANGLE);
        context.globalAlpha = 1;

        if (opened < 0) {
            // One white beam running in from off screen, with a longer, fainter
            // trail behind its head.
            const head = -1300 * (1 - clamp(age / INTRO_STRIKE, 0, 1) ** 2);
            context.fillStyle = UNICORN_COAT;
            context.fillRect(head - 520, -5, 520, 10);
        } else {
            // The seven leaving the horn one after another, each widening as it
            // travels: the spectrum a prism throws, and the wipe that opens the
            // game, drawn as the same shape seven times.
            RAINBOW_COLORS.forEach((inkColor, index) => {
                const born = opened - index * 0.05;
                if (born <= 0) return;

                const reach = min(born * 4200, 2600);
                const spread = 20 + born * 200;

                context.save();
                context.rotate((index - 3) * 0.125);
                context.globalAlpha = clamp(2 - born * 1.5, 0, 1);
                context.fillStyle = inkColor;
                context.beginPath();
                context.moveTo(0, 0);
                context.lineTo(reach, -spread);
                context.lineTo(reach, spread);
                context.fill();
                context.restore();
            });
        }

        // The horn the light breaks in. It is the game's own prism, and it goes
        // out once the colour it let through no longer needs explaining.
        context.rotate(-BEAM_ANGLE);
        context.globalAlpha = clamp(1.2 - opened * 2, 0, 1);
        context.fillStyle = HORN_COLOR;
        context.beginPath();
        context.moveTo(0, -HORN_LENGTH);
        context.lineTo(HORN_HALF_WIDTH, 30);
        context.lineTo(-HORN_HALF_WIDTH, 30);
        context.fill();

        // Four chords across the taper. A plain triangle is a spike; a triangle
        // with a twist in it is a unicorn's horn, and that is the whole reason
        // the light breaks here rather than on a piece of glass.
        context.strokeStyle = INK_BLACK;
        context.lineWidth = 3;
        context.beginPath();
        for (let band = 3; band < 10; band += 2) {
            const along = band / 10;
            context.moveTo(-HORN_HALF_WIDTH * along, 30 - HORN_LENGTH * (1 - along));
            context.lineTo(HORN_HALF_WIDTH * along, 16 - HORN_LENGTH * (1 - along));
        }
        context.stroke();
        context.restore();

        context.globalAlpha = spike(age, INTRO_STRIKE, 5);
        context.fillStyle = UNICORN_COAT;
        context.fillRect(-99, -99, 4000, 4000);
        context.globalAlpha = 1;

        if (age < 0) {
            drawText('PRESS ANY KEY', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 170, {
                typeSize: 17,
                typeSpacing: 7,
                inkColor: TEXT_BRIGHT,
                inkAlpha: 0.55 + sin(this.age * 3.2) * 0.35,
            });
        }
    }

    renderResult(y) {
        const { seconds, deaths, isBest } = this.completedRun;

        drawText('THE MEADOW IS BRIGHT AGAIN', CANVAS_WIDTH / 2, y, {
            typeSize: 18,
            typeWeight: 700,
            typeSpacing: 3,
            inkColor: TEXT_BRIGHT,
        });

        drawText(formatTime(seconds), CANVAS_WIDTH / 2, y + 74, {
            typeSize: 68,
            typeWeight: 900,
            typeSpacing: 3,
            inkColor: TEXT_BRIGHT,
        });

        drawText(
            `${isBest ? 'NEW BEST RUN' : `BEST ${formatTime(saveData.bestRunSeconds)}`}`
            + `   -   ${deaths} ${deaths === 1 ? 'fall' : 'falls'}`,
            CANVAS_WIDTH / 2, y + 126,
            { typeSize: 16, typeWeight: 800, typeSpacing: 2.5, inkColor: isBest ? TEXT_BRIGHT : TEXT_DIM },
        );
    }
}
