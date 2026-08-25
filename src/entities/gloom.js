/**
 * The Gloom: the things that drained the colour out of the meadow.
 *
 * Both kinds share everything that matters - they kill the unicorn on contact,
 * and they are purified by a rainbow stream passing through them. Only their
 * movement differs, so they share a base class rather than a file each.
 *
 * Purifying one is what raises the level's colour restoration, so clearing a
 * level literally brings the colour back. See gameplay-screen.js.
 */

import { playPurifySound } from '../audio/sfx.js';
import { GRAVITY, LAYER_GLOOM, MAX_FALL_SPEED } from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { cos, damp, hypot, max, min, randomBetween, sin, TAU } from '../core/math.js';
import { boxesOverlap } from '../core/rect.js';
import { Entity } from '../engine/entity.js';
import { burstRainbow, PARTICLE_RING } from '../engine/particles.js';
import { palette } from '../graphics/palette.js';

const MURK_SPEED = 78;
const WISP_SPEED = 105;

/**
 * How far beyond its own body a Gloom is dispelled by a passing rainbow.
 *
 * Purification is light, not contact: requiring the stream to physically
 * overlap the hitbox made clean-looking shots miss by a couple of units, which
 * reads as the game being broken rather than the player being imprecise.
 */
const PURIFY_AURA = 20;

/** Segments in a blob outline. Enough to read as organic, few enough to be cheap. */
const BLOB_STEPS = 18;

/**
 * How long the world holds still when a Gloom goes.
 *
 * Four frames at sixty. Long enough to feel like the game flinched, short
 * enough that clearing three in one stroke does not read as a stutter - which
 * is why it is assigned rather than added, so a chain of kills freezes once.
 */
const HIT_STOP_SECONDS = 0.06;

class Gloom extends Entity {
    categories = ['gloom'];
    layer = LAYER_GLOOM;

    velocityAcross = 0;
    velocityDown = 0;

    /** Randomised so a row of identical Gloom does not pulse in lockstep. */
    wobbleSeed = randomBetween(0, TAU);

    constructor(x, y) {
        super();
        this.x = x;
        this.y = y;
    }

    updateStep(elapsedSeconds) {
        super.updateStep(elapsedSeconds);
        this.moveStep(elapsedSeconds);

        if (this.checkPurification()) return;
        this.checkUnicorn();
    }

    /** A rainbow stream still flowing through this Gloom purifies it. */
    checkPurification() {
        for (const ribbon of this.world.entitiesOfCategory('ribbon')) {
            if (!ribbon.isWet) continue;
            const reach = max(this.halfWidth, this.halfHeight) + PURIFY_AURA;
            if (!ribbon.isNearPoint(this.x, this.y, reach)) continue;

            this.purify();
            return true;
        }
        return false;
    }

    /**
     * The moment the whole game is built around, so it is allowed to be loud.
     *
     * Four things land on the same frame: the world stops dead, a hard white
     * shockwave snaps outwards, the colour the Gloom was hoarding sprays out of
     * it, and the view kicks. The freeze is what makes the other three read as
     * an impact - without it the burst is only confetti arriving in a world
     * that never noticed, which is the difference between a kill that lands and
     * a kill that merely happens.
     */
    purify() {
        this.removeFromWorld();
        playPurifySound();

        this.world.hitStopSeconds = HIT_STOP_SECONDS;
        this.world.camera.shake(13, 0.34);

        const particles = this.world.firstOfCategory('particles');

        // The shockwave: one hard white hoop, gone in a quarter of a second.
        particles.spawn({
            x: this.x,
            y: this.y,
            typeSize: 6,
            endSize: 70,
            inkColor: '#fff',
            lifetime: 0.26,
            particleShape: PARTICLE_RING,
        });

        // Then the colour it was holding onto, thrown in every direction.
        burstRainbow(particles, this.x, this.y, 26, {
            speed: 430,
            gravity: 320,
            maxSize: 9,
            lifetime: 1,
        });
    }

    checkUnicorn() {
        const unicorn = this.world.firstOfCategory('unicorn');
        if (unicorn && !unicorn.isDead && boxesOverlap(this, unicorn)) unicorn.die();
    }

    /** A wobbling closed blob, centred on the origin. */
    traceBlob(context, radiusX, radiusY, wobbleAmount, lobes) {
        const phase = this.age * 2.4 + this.wobbleSeed;

        context.beginPath();
        for (let step = 0; step <= BLOB_STEPS; step++) {
            const angle = (step / BLOB_STEPS) * TAU;
            const wobble = 1 + sin(angle * lobes + phase) * wobbleAmount;
            const x = cos(angle) * radiusX * wobble;
            const y = sin(angle) * radiusY * wobble;
            if (step) context.lineTo(x, y); else context.moveTo(x, y);
        }
        context.closePath();
    }

    /** Two glowing eyes with a dark slit, drawn in whatever local space is current. */
    drawEyes(context, typeSpacing, radius) {
        for (const side of [-1, 1]) {
            context.fillStyle = palette.gloomEye;
            context.beginPath();
            context.ellipse(side * typeSpacing, 0, radius, radius * 1.25, 0, 0, TAU);
            context.fill();

            context.fillStyle = palette.gloomBody;
            context.fillRect(side * typeSpacing - radius, -radius * 0.28, radius * 2, radius * 0.55);
        }
    }
}

/**
 * Murk: a squat blob that patrols a ledge, turning at walls and at drops so it
 * never walks off its own platform.
 */
export class GloomMurk extends Gloom {
    halfWidth = 16;
    halfHeight = 19;

    patrolDirection = -1;

    moveStep(elapsedSeconds) {
        const terrain = this.world.firstOfCategory('terrain');

        this.velocityDown = min(this.velocityDown + GRAVITY * elapsedSeconds, MAX_FALL_SPEED);
        terrain.moveWithCollision(
            this,
            this.patrolDirection * MURK_SPEED * elapsedSeconds,
            this.velocityDown * elapsedSeconds,
        );

        if (this.wallDirection) {
            this.patrolDirection = -this.patrolDirection;
        } else if (this.isOnGround) {
            // Look just past the leading edge; turn around if there is nothing there.
            const aheadX = this.x + this.patrolDirection * (this.halfWidth + 4);
            if (!terrain.hasGroundBelow(aheadX, this.y + this.halfHeight)) this.patrolDirection = -this.patrolDirection;
        }
    }

    render() {
        const context = canvasContext;
        // Squashes and stretches as it waddles.
        const waddle = sin(this.age * 7 + this.wobbleSeed) * 0.08;

        context.translate(this.x, this.y);
        context.scale(1 + waddle, 1 - waddle);

        context.fillStyle = palette.gloomRim;
        this.traceBlob(context, this.halfWidth + 2.5, this.halfHeight + 2.5, 0.07, 3);
        context.fill();

        context.fillStyle = palette.gloomBody;
        this.traceBlob(context, this.halfWidth, this.halfHeight, 0.07, 3);
        context.fill();

        context.translate(this.patrolDirection * 3, -3);
        this.drawEyes(context, 5.5, 3.2);
    }
}

/**
 * Wisp: drifts through the air towards the unicorn, slowly enough to be
 * outrun but relentlessly enough to have to be dealt with.
 */
export class GloomWisp extends Gloom {
    halfWidth = 13;
    halfHeight = 14;

    moveStep(elapsedSeconds) {
        const unicorn = this.world.firstOfCategory('unicorn');

        if (unicorn) {
            const toUnicornX = unicorn.x - this.x;
            const toUnicornY = unicorn.y - this.y;
            const distance = hypot(toUnicornX, toUnicornY) || 1;

            this.velocityAcross = damp(this.velocityAcross, (toUnicornX / distance) * WISP_SPEED, 1.6, elapsedSeconds);
            this.velocityDown = damp(this.velocityDown, (toUnicornY / distance) * WISP_SPEED, 1.6, elapsedSeconds);
        }

        this.x += this.velocityAcross * elapsedSeconds;
        // A gentle bob on top of the chase, so it never moves in a dead straight line.
        this.y += (this.velocityDown + sin(this.age * 2.6 + this.wobbleSeed) * 34) * elapsedSeconds;

        this.drinkRibbons();
    }

    /**
     * A wisp that reaches a finished rainbow drinks it, and the whole arc starts
     * dissolving under you.
     *
     * This is the reason to spend a shot on one rather than simply outrunning
     * it: a bridge is not safe just because you built it. A stream still being
     * poured is untouchable, because that one is busy purifying the wisp.
     */
    drinkRibbons() {
        for (const ribbon of this.world.entitiesOfCategory('ribbon')) {
            if (!ribbon.isWet && ribbon.isNearPoint(this.x, this.y, this.halfWidth)) ribbon.dissolveNow();
        }
    }

    render() {
        const context = canvasContext;
        context.translate(this.x, this.y);

        context.fillStyle = palette.gloomRim;
        this.traceBlob(context, this.halfWidth + 2.5, this.halfHeight + 2.5, 0.12, 4);
        context.fill();

        context.fillStyle = palette.gloomBody;
        this.traceBlob(context, this.halfWidth, this.halfHeight, 0.12, 4);
        context.fill();

        context.translate(0, -2);
        this.drawEyes(context, 5, 3);
    }
}
