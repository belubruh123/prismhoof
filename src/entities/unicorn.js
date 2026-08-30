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
    DASH_END_SPEED,
    DASH_SECONDS,
    DASH_SPEED,
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
    PAINT_RECOIL,
    PAINT_RECOIL_TOP_SPEED,
    PAINT_REFILL_DELAY_SECONDS,
    PAINT_REFILL_PER_SECOND,
    RIBBON_MAX_LANDABLE_SLOPE,
    RIBBON_SNAP_DISTANCE,
    RUN_ACCELERATION_AIR,
    RUN_ACCELERATION_GROUND,
    RUN_MAX_SPEED,
    RUN_TURN_ACCELERATION,
    UNICORN_HALF_HEIGHT,
    UNICORN_HALF_WIDTH,
} from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { DASH_KEYS, DIVE_KEYS, JUMP_KEYS, MOVE_LEFT_KEYS, MOVE_RIGHT_KEYS, PAINT_KEYS, isKeyDown, wasKeyPressed } from '../core/input.js';
import { abs, approach, clamp, damp, max, min, PI, randomBetween, sign } from '../core/math.js';
import { Entity } from '../engine/entity.js';
import { burstRainbow, PARTICLE_STAR } from '../engine/particles.js';
import { HairStrand } from '../graphics/hair.js';
import { RAINBOW_COLORS, UNICORN_COAT } from '../graphics/palette.js';
import { playDeathSound, playJumpSound, playLandSound, playPaintSound } from '../audio/sfx.js';
import { RainbowRibbon } from './rainbow-ribbon.js';
import { LAVA_SURFACE_DEPTH } from './terrain.js';
import { buildUnicornPose, drawUnicorn, hornTipPosition } from './unicorn-art.js';

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

    velocityAcross = 0;
    velocityDown = 0;
    facing = 1;

    isOnGround = false;
    wallDirection = 0;
    wantsToDropThrough = false;

    coyoteTimer = 0;
    jumpBufferTimer = 0;
    isJumpRising = false;

    dashTimer = 0;
    /** One dash per airtime; landing on anything solid hands it back. */
    hasDash = true;

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

    hornGlow = 0;
    hornColorIndex = 0;

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
        for (const strand of this.maneStrands) strand.resetToRest(this.maneBaseAngle, this.facing);
        for (const strand of this.tailStrands) strand.resetToRest(this.tailBaseAngle, this.facing);
    }

    /** Hair trails backwards, so the rest direction mirrors with `facing`. */
    get maneBaseAngle() { return this.facing > 0 ? MANE_REST_ANGLE : PI - MANE_REST_ANGLE; }
    get tailBaseAngle() { return this.facing > 0 ? TAIL_REST_ANGLE : PI - TAIL_REST_ANGLE; }

    updateStep(elapsedSeconds) {
        super.updateStep(elapsedSeconds);

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
            this.velocityDown = min(this.velocityDown + GRAVITY * elapsedSeconds, MAX_FALL_SPEED);
            this.x += this.velocityAcross * elapsedSeconds;
            this.y += this.velocityDown * elapsedSeconds;
        }

        // Touching the lava is fatal, and it is what is under every hole in
        // every floor. Checked here rather than in the gameplay screen so
        // nothing can fall forever.
        if (!this.isDead && this.y + this.halfHeight > this.world.boundsBottom + LAVA_SURFACE_DEPTH) {
            this.die('THE LAVA TOOK YOU');
        }

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

        // A dash owns the frame it runs in: no gravity, no steering, no jump.
        if (this.applyDash(elapsedSeconds)) return;

        const isTurning = moveInput && sign(moveInput) !== sign(this.velocityAcross);
        const acceleration = !moveInput
            ? (this.isOnGround ? GROUND_FRICTION : AIR_FRICTION)
            : isTurning
                ? RUN_TURN_ACCELERATION
                : (this.isOnGround ? RUN_ACCELERATION_GROUND : RUN_ACCELERATION_AIR);

        const targetVelocityX = moveInput * RUN_MAX_SPEED;
        this.velocityAcross = approach(this.velocityAcross, targetVelocityX, acceleration * elapsedSeconds);

        this.velocityDown = min(this.velocityDown + GRAVITY * elapsedSeconds, MAX_FALL_SPEED);
        if (isDiving && !this.isOnGround) {
            this.velocityDown = min(this.velocityDown + DIVE_ACCELERATION * elapsedSeconds, MAX_FALL_SPEED);
        }

        this.applyJump(elapsedSeconds);
    }

    /**
     * The air dash, and whether it is currently running the show.
     *
     * Held flat rather than launched: gravity is skipped for its duration and
     * the burst decays to a run rather than ending at full speed. The vertical
     * axis is left alone on purpose, so a pour fired mid-dash still lifts - the
     * dash buys distance, the paint buys height, and using both at once is the
     * interesting thing to do with them.
     *
     * There is one per airtime and only the ground gives it back, which is the
     * rule the paint meter already runs on.
     *
     * A dash frame skips the jump handling below it, so a jump pressed during
     * one is not buffered. Wiring that up measured 22 bytes and the case is very
     * nearly unreachable - the dash suspends the fall, so it hovers rather than
     * lands - which is not a trade worth making with the budget this close.
     */
    applyDash(elapsedSeconds) {
        const wasDashing = this.dashTimer > 0;
        this.dashTimer -= elapsedSeconds;

        if (wasKeyPressed(DASH_KEYS) && this.hasDash && !this.isOnGround) this.startDash();

        if (this.dashTimer > 0) {
            this.velocityAcross = DASH_SPEED * this.facing;
            return true;
        }

        // Bleed off on the frame the burst runs out rather than letting the
        // unicorn keep sprinting out of it.
        if (wasDashing) this.velocityAcross = DASH_END_SPEED * this.facing;

        return false;
    }

    startDash() {
        this.dashTimer = DASH_SECONDS;
        this.hasDash = false;
        this.velocityAcross = DASH_SPEED * this.facing;
        this.velocityDown = 0;
        this.squash = 0.25;

        this.emitManeSparkles(6);
        playJumpSound(1.6);
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
            this.velocityDown *= JUMP_RELEASE_DAMPING;
            this.isJumpRising = false;
        }
        if (this.velocityDown >= 0) this.isJumpRising = false;
    }

    jump() {
        this.velocityDown = JUMP_VELOCITY;
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
        this.impactSpeed = this.velocityDown;

        terrain.moveWithCollision(this, this.velocityAcross * elapsedSeconds, this.velocityDown * elapsedSeconds);

        // Ribbons act as one-way floors, checked after the terrain so solid
        // ground always wins a tie.
        this.landOnRibbons();

        if (this.isOnGround) {
            this.coyoteTimer = COYOTE_SECONDS;
            this.hasDash = true;
            if (!wasOnGround) this.land();
        }
    }

    /**
     * Ribbons are one-way floors. Only a downward-moving foot can catch one, so
     * the unicorn always passes up through its own paint and lands on it coming
     * back down.
     */
    landOnRibbons() {
        if (this.isOnGround || this.velocityDown < 0) {
            this.ribbonUnderfoot = null;
            return;
        }

        // Already on a rainbow: follow its surface uphill as well as down. The
        // swept test below only catches an arc being fallen through, so it
        // cannot hold a unicorn that is climbing the curve - which is what used
        // to drop it through its own paint the instant it turned around.
        if (this.ribbonUnderfoot && !this.ribbonUnderfoot.isRemoved) {
            // Reach as far as the steepest landable stretch could climb in the
            // distance covered this frame, so speed never outruns the snap.
            const reach = RIBBON_SNAP_DISTANCE
                + abs(this.x - this.previousX) * RIBBON_MAX_LANDABLE_SLOPE;
            const surfaceY = this.ribbonUnderfoot.surfaceYNear(this.x, this.y + this.halfHeight, reach);

            if (surfaceY !== null) {
                this.standOnRibbon(this.ribbonUnderfoot, surfaceY);
                return;
            }
        }

        let highestLandingY = null;
        let landedOn = null;

        for (const ribbon of this.world.entitiesOfCategory('ribbon')) {
            const landingY = ribbon.findLandingY(
                this.previousX, this.previousY + this.halfHeight,
                this.x, this.y + this.halfHeight,
            );
            if (landingY === null) continue;
            if (highestLandingY === null || landingY < highestLandingY) {
                highestLandingY = landingY;
                landedOn = ribbon;
            }
        }

        this.ribbonUnderfoot = landedOn;
        if (landedOn) this.standOnRibbon(landedOn, highestLandingY);
    }

    standOnRibbon(ribbon, surfaceY) {
        this.ribbonUnderfoot = ribbon;
        this.y = surfaceY - this.halfHeight;
        this.velocityDown = 0;
        this.isOnGround = true;
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
                velocityAcross: randomBetween(-110, 110) + this.velocityAcross * 0.25,
                velocityDown: randomBetween(-90, -20),
                gravity: 420,
                typeSize: randomBetween(2, 4.5),
                endSize: 0,
                lifetime: randomBetween(0.25, 0.5),
                inkColor: UNICORN_COAT,
            });
        }
    }

    // --- animation ----------------------------------------------------------

    updateAnimation(elapsedSeconds) {
        const speed = abs(this.velocityAcross);

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

        // Snaps on and eases off: the horn should light the instant the key is
        // pressed, because the pose it produces is what aims the shot.
        this.hornGlow = this.isAiming ? 1 : damp(this.hornGlow, 0, 13, elapsedSeconds);
    }

    /**
     * Hair reacts to gravity plus the drag of the unicorn's own motion, so it
     * streams backwards at speed and settles when standing.
     */
    updateHair(elapsedSeconds) {
        const dragX = -this.velocityAcross * 0.85;
        const dragY = -this.velocityDown * 0.55 + 260;

        for (const strand of this.maneStrands) {
            strand.updateStep(elapsedSeconds, this.maneBaseAngle, this.facing, dragX, dragY);
        }
        for (const strand of this.tailStrands) {
            strand.updateStep(elapsedSeconds, this.tailBaseAngle, this.facing, dragX, dragY * 0.8);
        }
    }

    // --- painting -----------------------------------------------------------

    updatePainting(elapsedSeconds) {
        if (this.isAiming) {
            this.paintEnergy = max(0, this.paintEnergy - PAINT_DRAIN_PER_SECOND * elapsedSeconds);
            this.secondsSincePainting = 0;

            // Pouring in mid-air pushes back hard enough to catch a fall and
            // hold a climb. Firing from the ground is unaffected, so the stream
            // stays a weapon down there and becomes a way to move up here.
            if (!this.isOnGround) {
                this.velocityDown = min(
                    this.velocityDown,
                    max(this.velocityDown - PAINT_RECOIL * elapsedSeconds, PAINT_RECOIL_TOP_SPEED),
                );
            }

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

        if (!this.activeRibbon) {
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
            this.facing * PAINT_HEAD_SPEED + this.velocityAcross * PAINT_HEAD_INHERITANCE_X,
            PAINT_HEAD_LIFT + this.velocityDown * PAINT_HEAD_INHERITANCE_Y,
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
            velocityAcross: randomBetween(-45, 45),
            velocityDown: randomBetween(-55, 15),
            gravity: 90,
            typeSize: randomBetween(2.5, 5),
            endSize: 0,
            lifetime: randomBetween(0.3, 0.7),
            inkColor: RAINBOW_COLORS[this.hornColorIndex],
            particleShape: PARTICLE_STAR,
            spin: randomBetween(-7, 7),
        });
    }

    // --- dying --------------------------------------------------------------

    /**
     * One hit is fatal. The body keeps falling under gravity so the death reads
     * as a real event rather than a freeze; the gameplay screen restarts once
     * the burst has had a moment to play.
     */
    die(cause = 'THE GLOOM TOOK YOU') {
        if (this.isDead) return;
        this.isDead = true;
        this.deathCause = cause;

        this.velocityAcross = -this.facing * 150;
        this.velocityDown = -420;

        if (this.activeRibbon) this.endRibbon();
        this.world.camera.shake(14, 0.5);

        burstRainbow(this.world.firstOfCategory('particles'), this.x, this.y, 26, {
            flingSpeed: 420,
            gravity: 500,
            maxSize: 8,
            lifetime: 1.2,
        });

        playDeathSound();
        this.onDeath?.();
    }

    /** A puff of rainbow sparkles off the unicorn's back, for jumps and wins. */
    emitManeSparkles(count) {
        burstRainbow(this.world.firstOfCategory('particles'), this.x, this.y - 14, count, {
            flingSpeed: 110,
            gravity: 180,
            maxSize: 6,
            lifetime: 0.9,
        });
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

