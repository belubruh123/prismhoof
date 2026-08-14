/**
 * The unicorn: movement physics and the animation state that drives the art.
 *
 * The feel targets are the usual precision-platformer ones - snappy ground
 * acceleration, a faster turnaround than a standstill, coyote time, jump
 * buffering and a variable jump height - because the paint mechanic only works
 * if placing yourself in the air is completely reliable.
 */

import {
    AIR_FRICTION,
    COYOTE_SECONDS,
    DIVE_ACCELERATION,
    GRAVITY,
    GROUND_FRICTION,
    JUMP_BUFFER_SECONDS,
    JUMP_RELEASE_DAMPING,
    JUMP_VELOCITY,
    LAYER_UNICORN,
    MAX_FALL_SPEED,
    MAX_LIVE_RIBBONS,
    PAINT_DRAIN_PER_SECOND,
    PAINT_HEAD_INHERITANCE_X,
    PAINT_HEAD_INHERITANCE_Y,
    PAINT_HEAD_LIFT,
    PAINT_HEAD_SPEED,
    PAINT_MINIMUM_TO_START,
    PAINT_REFILL_DELAY_SECONDS,
    PAINT_REFILL_PER_SECOND,
    RIBBON_SNAP_DISTANCE,
    RUN_ACCELERATION_AIR,
    RUN_ACCELERATION_GROUND,
    RUN_MAX_SPEED,
    RUN_TURN_ACCELERATION,
    UNICORN_HALF_HEIGHT,
    UNICORN_HALF_WIDTH,
} from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { DIVE_KEYS, JUMP_KEYS, MOVE_LEFT_KEYS, MOVE_RIGHT_KEYS, PAINT_KEYS, isKeyDown, wasKeyPressed } from '../core/input.js';
import { abs, clamp, cos, damp, max, min, PI, randomBetween, sign, sin, TAU } from '../core/math.js';
import { Entity } from '../engine/entity.js';
import { burstRainbow, PARTICLE_CIRCLE, PARTICLE_STAR } from '../engine/particles.js';
import { HairStrand } from '../graphics/hair.js';
import { RAINBOW_COLORS, UNICORN_COAT } from '../graphics/palette.js';
import { playDeathSound, playJumpSound, playLandSound, playPaintSound } from '../audio/sfx.js';
import { RainbowRibbon } from './rainbow-ribbon.js';
import { buildUnicornPose, drawUnicorn, hornTipPosition, maneStrandRoot } from './unicorn-art.js';

/** Speed below which the unicorn counts as standing still and starts idling. */
const IDLE_SPEED_THRESHOLD = 24;

/** Downward speed at which a landing produces the biggest squash. */
const HARD_LANDING_SPEED = 900;

const MANE_STRAND_COUNT = 5;
const TAIL_STRAND_COUNT = 4;

/**
 * Rest directions for the hair, as canvas angles for a unicorn facing right.
 * The tail leaves the rump slightly above horizontal and then curls down, which
 * is what gives it an arc rather than a straight banner.
 */
const MANE_REST_ANGLE = PI * 0.93;
const TAIL_REST_ANGLE = PI * 1.05;

/** Gait cycles per second: this floor plus this much again at a full gallop. */
const GAIT_BASE_RATE = 1.7;
const GAIT_SPEED_RATE = 4.3;

export class Unicorn extends Entity {
    categories = ['unicorn'];
    layer = LAYER_UNICORN;

    halfWidth = UNICORN_HALF_WIDTH;
    halfHeight = UNICORN_HALF_HEIGHT;

    velocityX = 0;
    velocityY = 0;
    facing = 1;

    isOnGround = false;
    touchedCeiling = false;
    wallDirection = 0;
    wantsToDropThrough = false;

    coyoteTimer = 0;
    jumpBufferTimer = 0;
    isJumpRising = false;

    /** Position in the gait cycle, in whole cycles. */
    runPhase = 0;
    /** 0..1, how much of a full gallop is being run. Scales the whole leg animation. */
    runSpeed = 0;
    /** 0..1, ramps up when standing still. Gates breathing, sway and ear flicks. */
    idleAmount = 0;
    /** 0..1, damped so the legs ease between their planted and tucked poses. */
    airborneAmount = 0;

    /** Positive squashes wide and short, negative stretches tall and thin. */
    squash = 0;

    eyeOpenness = 1;
    blinkCountdown = 2;
    earTwitch = 0;
    earTwitchCountdown = 3;

    hornGlow = 0;
    hornColorIndex = 0;

    isPainting = false;
    isDead = false;

    /** Paint left in the horn, 0..1. Also what the HUD meter reads. */
    paintEnergy = 1;
    /** The ribbon currently being drawn, or null. */
    activeRibbon = null;
    secondsSincePainting = 9;
    /** The ribbon being stood on, which earns a downward snap next frame. */
    ribbonUnderfoot = null;

    /** Downward speed captured just before a collision zeroed it, for landing impact. */
    impactSpeed = 0;

    constructor(x, y) {
        super();
        this.x = x;
        this.y = y;

        // Longer, looser strands towards the back of the mane give it a fan shape.
        this.maneStrands = Array.from({ length: MANE_STRAND_COUNT }, (unused, index) =>
            new HairStrand(4, 5.5 + index * 0.7, 5.5 - index * 0.35, -0.26, 13, 0.55));

        this.tailStrands = Array.from({ length: TAIL_STRAND_COUNT }, (unused, index) =>
            new HairStrand(5, 5.8 + index * 0.7, 7 - index * 0.6, -0.19 - index * 0.03, 9, 0.7));

        this.resetHair();
    }

    resetHair() {
        for (const strand of this.maneStrands) strand.reset(this.maneBaseAngle, this.facing);
        for (const strand of this.tailStrands) strand.reset(this.tailBaseAngle, this.facing);
    }

    /** Hair trails backwards, so the rest direction mirrors with `facing`. */
    get maneBaseAngle() { return this.facing > 0 ? MANE_REST_ANGLE : PI - MANE_REST_ANGLE; }
    get tailBaseAngle() { return this.facing > 0 ? TAIL_REST_ANGLE : PI - TAIL_REST_ANGLE; }

    update(elapsedSeconds) {
        super.update(elapsedSeconds);

        // Decided before anything else, because the aiming pose has to be in
        // place on the very first frame of a stroke: the stream's whole
        // trajectory is fixed when it spawns, from wherever the horn tip is.
        // A stroke already running may drain to nothing; starting a fresh one
        // needs a real amount of paint in the horn.
        this.isAiming = !this.isDead
            && isKeyDown(PAINT_KEYS)
            && this.paintEnergy > (this.activeRibbon ? 0 : PAINT_MINIMUM_TO_START);

        if (!this.isDead) {
            this.applyInput(elapsedSeconds);
            this.applyMovement(elapsedSeconds);
        } else {
            this.velocityY = min(this.velocityY + GRAVITY * elapsedSeconds, MAX_FALL_SPEED);
            this.x += this.velocityX * elapsedSeconds;
            this.y += this.velocityY * elapsedSeconds;
        }

        // Falling out of the bottom of the level is fatal. Checked here rather
        // than in the gameplay screen so nothing can fall forever.
        if (!this.isDead && this.y > this.world.boundsBottom + 90) this.die();

        this.updateAnimation(elapsedSeconds);
        this.updatePainting(elapsedSeconds);
    }

    // --- physics ------------------------------------------------------------

    applyInput(elapsedSeconds) {
        const moveInput = (isKeyDown(MOVE_RIGHT_KEYS) ? 1 : 0) - (isKeyDown(MOVE_LEFT_KEYS) ? 1 : 0);
        const isDiving = isKeyDown(DIVE_KEYS);

        // Holding down while grounded is a request to drop through a platform.
        this.wantsToDropThrough = isDiving && this.isOnGround;

        if (moveInput) this.facing = moveInput;

        const isTurning = moveInput && sign(moveInput) !== sign(this.velocityX);
        const acceleration = !moveInput
            ? (this.isOnGround ? GROUND_FRICTION : AIR_FRICTION)
            : isTurning
                ? RUN_TURN_ACCELERATION
                : (this.isOnGround ? RUN_ACCELERATION_GROUND : RUN_ACCELERATION_AIR);

        const targetVelocityX = moveInput * RUN_MAX_SPEED;
        this.velocityX = approachValue(this.velocityX, targetVelocityX, acceleration * elapsedSeconds);

        this.velocityY = min(this.velocityY + GRAVITY * elapsedSeconds, MAX_FALL_SPEED);
        if (isDiving && !this.isOnGround) {
            this.velocityY = min(this.velocityY + DIVE_ACCELERATION * elapsedSeconds, MAX_FALL_SPEED);
        }

        this.applyJump(elapsedSeconds);
    }

    applyJump(elapsedSeconds) {
        this.coyoteTimer -= elapsedSeconds;
        this.jumpBufferTimer -= elapsedSeconds;

        if (wasKeyPressed(JUMP_KEYS)) this.jumpBufferTimer = JUMP_BUFFER_SECONDS;

        if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
            this.jump();
        }

        // Releasing early cuts the rise short, which is what makes the jump variable.
        if (this.isJumpRising && !isKeyDown(JUMP_KEYS)) {
            this.velocityY *= JUMP_RELEASE_DAMPING;
            this.isJumpRising = false;
        }
        if (this.velocityY >= 0) this.isJumpRising = false;
    }

    jump() {
        this.velocityY = JUMP_VELOCITY;
        this.isJumpRising = true;
        this.jumpBufferTimer = 0;
        this.coyoteTimer = 0;
        this.squash = -0.2;

        this.emitHoofDust(10);
        this.emitManeSparkles(3);
        playJumpSound();
    }

    applyMovement(elapsedSeconds) {
        const terrain = this.world.firstOfCategory('terrain');
        const wasOnGround = this.isOnGround;

        // Captured before the collision resolves, which sets velocityY to zero.
        this.impactSpeed = this.velocityY;

        terrain.moveWithCollision(this, this.velocityX * elapsedSeconds, this.velocityY * elapsedSeconds);

        // Ribbons act as one-way floors, checked after the terrain so solid
        // ground always wins a tie.
        this.landOnRibbons();

        if (this.isOnGround) {
            this.coyoteTimer = COYOTE_SECONDS;
            if (!wasOnGround) this.land();
        }
    }

    /**
     * Ribbons are one-way floors. Only a downward-moving foot can catch one, so
     * the unicorn always passes up through its own paint and lands on it coming
     * back down.
     */
    landOnRibbons() {
        if (this.isOnGround || this.velocityY < 0) {
            this.ribbonUnderfoot = null;
            return;
        }

        // Reach further down when already standing on a ribbon, otherwise
        // running down a curving arc steps off it and re-lands every few frames.
        const probeDepth = this.ribbonUnderfoot ? RIBBON_SNAP_DISTANCE : 0;

        const fromX = this.previousX;
        const fromY = this.previousY + this.halfHeight;
        const toX = this.x;
        const toY = this.y + this.halfHeight + probeDepth;

        let highestLandingY = null;
        let landedOn = null;

        for (const ribbon of this.world.entitiesOfCategory('ribbon')) {
            const landingY = ribbon.findLandingY(fromX, fromY, toX, toY);
            if (landingY === null) continue;
            if (highestLandingY === null || landingY < highestLandingY) {
                highestLandingY = landingY;
                landedOn = ribbon;
            }
        }

        this.ribbonUnderfoot = landedOn;

        if (landedOn) {
            this.y = highestLandingY - this.halfHeight;
            this.velocityY = 0;
            this.isOnGround = true;
        }
    }

    land() {
        const impact = clamp(this.impactSpeed / HARD_LANDING_SPEED, 0, 1);
        this.squash = 0.1 + impact * 0.24;
        this.emitHoofDust(6 + impact * 12);
        this.world.camera.shake(impact * 5, 0.18);
        playLandSound(impact);
    }

    /** A low puff of dust at hoof level, thrown outwards and slightly upwards. */
    emitHoofDust(count) {
        const particles = this.world.firstOfCategory('particles');
        if (!particles) return;

        for (let index = 0; index < count; index++) {
            particles.spawn({
                x: this.x + randomBetween(-this.halfWidth, this.halfWidth),
                y: this.y + this.halfHeight,
                velocityX: randomBetween(-110, 110) + this.velocityX * 0.25,
                velocityY: randomBetween(-90, -20),
                gravity: 420,
                size: randomBetween(2, 4.5),
                endSize: 0,
                lifetime: randomBetween(0.25, 0.5),
                color: UNICORN_COAT,
                shape: PARTICLE_CIRCLE,
            });
        }
    }

    // --- animation ----------------------------------------------------------

    updateAnimation(elapsedSeconds) {
        const speed = abs(this.velocityX);

        this.runSpeed = damp(this.runSpeed, this.isOnGround ? clamp(speed / RUN_MAX_SPEED, 0, 1) : 0, 14, elapsedSeconds);
        this.idleAmount = damp(this.idleAmount, this.isOnGround && speed < IDLE_SPEED_THRESHOLD ? 1 : 0, 6, elapsedSeconds);
        this.airborneAmount = damp(this.airborneAmount, this.isOnGround ? 0 : 1, 16, elapsedSeconds);

        // The gait rate is chosen to read well rather than to match ground speed
        // exactly - the unicorn is stylised and short-legged, so a stride that
        // covered its real speed would need legs twice as long.
        this.runPhase += (GAIT_BASE_RATE + this.runSpeed * GAIT_SPEED_RATE) * this.runSpeed * elapsedSeconds;

        this.squash = damp(this.squash, 0, 11, elapsedSeconds);

        this.updateFace(elapsedSeconds);
        this.updateHair(elapsedSeconds);

        // Built once here rather than again in render, because the paint code
        // needs the horn tip and the horn tip comes out of the pose.
        this.pose = buildUnicornPose(this);
    }

    updateFace(elapsedSeconds) {
        this.blinkCountdown -= elapsedSeconds;
        if (this.blinkCountdown < 0) {
            // Negative time is the blink itself, so one counter does both jobs.
            this.eyeOpenness = this.blinkCountdown > -0.12 ? 0 : 1;
            if (this.blinkCountdown <= -0.12) this.blinkCountdown = randomBetween(1.8, 5);
        } else {
            this.eyeOpenness = 1;
        }

        this.earTwitchCountdown -= elapsedSeconds;
        if (this.earTwitchCountdown < 0) {
            this.earTwitch = this.earTwitchCountdown > -0.22 ? 1 : 0;
            if (this.earTwitchCountdown <= -0.22) this.earTwitchCountdown = randomBetween(2.2, 6);
        }
        this.earTwitch = damp(this.earTwitch, 0, 9, elapsedSeconds);

        // Snaps on and eases off: the horn should light the instant the key is
        // pressed, because the pose it produces is what aims the shot.
        this.hornGlow = this.isAiming ? 1 : damp(this.hornGlow, 0, 13, elapsedSeconds);
    }

    /**
     * Hair reacts to gravity plus the drag of the unicorn's own motion, so it
     * streams backwards at speed and settles when standing.
     */
    updateHair(elapsedSeconds) {
        const dragX = -this.velocityX * 0.85;
        const dragY = -this.velocityY * 0.55 + 260;

        for (const strand of this.maneStrands) {
            strand.update(elapsedSeconds, this.maneBaseAngle, this.facing, dragX, dragY);
        }
        for (const strand of this.tailStrands) {
            strand.update(elapsedSeconds, this.tailBaseAngle, this.facing, dragX, dragY * 0.8);
        }
    }

    // --- painting -----------------------------------------------------------

    updatePainting(elapsedSeconds) {
        if (this.isAiming) {
            this.paintEnergy = max(0, this.paintEnergy - PAINT_DRAIN_PER_SECOND * elapsedSeconds);
            this.secondsSincePainting = 0;

            if (!this.activeRibbon) this.beginRibbon();

            const terrain = this.world.firstOfCategory('terrain');
            const stillFlowing = this.activeRibbon.advanceHead(elapsedSeconds, terrain);

            this.emitPaintSparkle(this.activeRibbon.headX, this.activeRibbon.headY);

            // The stream ends itself when it lands or runs out of length, so a
            // held key does not keep burning paint into a finished ribbon.
            if (!stillFlowing) this.endRibbon();
        } else if (this.activeRibbon) {
            this.endRibbon();
        }

        this.isPainting = Boolean(this.activeRibbon);

        if (!this.isPainting) {
            this.secondsSincePainting += elapsedSeconds;

            // Refilling only on solid footing is what forces a choice about
            // where in a level the paint is worth spending.
            if (this.isOnGround && this.secondsSincePainting > PAINT_REFILL_DELAY_SECONDS) {
                this.paintEnergy = min(1, this.paintEnergy + PAINT_REFILL_PER_SECOND * elapsedSeconds);
            }
        }
    }

    beginRibbon() {
        const liveRibbons = this.world.entitiesOfCategory('ribbon').filter((ribbon) => !ribbon.isDissolving);

        // Bounding the number of live ribbons bounds the collision work, and
        // keeps a level from turning into an unreadable tangle of rainbows.
        if (liveRibbons.length >= MAX_LIVE_RIBBONS) liveRibbons[0].dissolveNow();

        const hornTip = hornTipPosition(this, this.pose);

        this.activeRibbon = this.world.addEntity(new RainbowRibbon(
            hornTip.x,
            hornTip.y,
            this.facing * PAINT_HEAD_SPEED + this.velocityX * PAINT_HEAD_INHERITANCE_X,
            PAINT_HEAD_LIFT + this.velocityY * PAINT_HEAD_INHERITANCE_Y,
        ));

        this.hornColorIndex = (this.hornColorIndex + 1) % RAINBOW_COLORS.length;
        playPaintSound();
    }

    endRibbon() {
        this.activeRibbon.finishPainting();
        this.activeRibbon = null;
    }

    emitPaintSparkle(x, y) {
        const particles = this.world.firstOfCategory('particles');
        if (!particles) return;

        particles.spawn({
            x,
            y,
            velocityX: randomBetween(-45, 45),
            velocityY: randomBetween(-55, 15),
            gravity: 90,
            size: randomBetween(2.5, 5),
            endSize: 0,
            lifetime: randomBetween(0.3, 0.7),
            color: RAINBOW_COLORS[this.hornColorIndex],
            shape: PARTICLE_STAR,
            spin: randomBetween(-7, 7),
        });
    }

    // --- dying --------------------------------------------------------------

    /**
     * One hit is fatal. The body keeps falling under gravity so the death reads
     * as a real event rather than a freeze; the gameplay screen restarts once
     * the burst has had a moment to play.
     */
    die() {
        if (this.isDead) return;
        this.isDead = true;

        this.velocityX = -this.facing * 150;
        this.velocityY = -420;

        if (this.activeRibbon) this.endRibbon();
        this.world.camera.shake(14, 0.5);

        burstRainbow(this.world.firstOfCategory('particles'), this.x, this.y, 26, {
            speed: 420,
            gravity: 500,
            maxSize: 8,
            lifetime: 1.2,
        });

        playDeathSound();
        this.onDeath?.();
    }

    /** A puff of rainbow sparkles off the mane, used on jumps and purifies. */
    emitManeSparkles(count) {
        const particles = this.world.firstOfCategory('particles');
        if (!particles) return;

        const pose = this.pose;
        for (let index = 0; index < count; index++) {
            const strandIndex = index % this.maneStrands.length;
            const root = maneStrandRoot(this, pose, strandIndex);
            const tip = this.maneStrands[strandIndex].tipPosition(root.x, root.y);

            particles.spawn({
                x: tip.x,
                y: tip.y,
                velocityX: randomBetween(-70, 70) - this.velocityX * 0.2,
                velocityY: randomBetween(-90, 10),
                gravity: 180,
                size: randomBetween(3, 6),
                endSize: 0,
                lifetime: randomBetween(0.4, 0.9),
                color: RAINBOW_COLORS[(strandIndex + index) % RAINBOW_COLORS.length],
                shape: PARTICLE_STAR,
                spin: randomBetween(-6, 6),
            });
        }
    }

    render() {
        drawUnicorn(this, this.pose || buildUnicornPose(this));
    }

    renderDebug() {
        canvasContext.strokeStyle = '#0f0';
        canvasContext.lineWidth = 1;
        canvasContext.strokeRect(
            this.x - this.halfWidth, this.y - this.halfHeight,
            this.halfWidth * 2, this.halfHeight * 2,
        );
    }
}

/** Moves `value` towards `target` by at most `maximumStep`, without overshooting. */
function approachValue(value, target, maximumStep) {
    const difference = target - value;
    if (abs(difference) <= maximumStep) return target;
    return value + sign(difference) * maximumStep;
}
