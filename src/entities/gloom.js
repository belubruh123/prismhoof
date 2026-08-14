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
import { burstRainbow } from '../engine/particles.js';
import { palette, RAINBOW_COLORS } from '../graphics/palette.js';

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

class Gloom extends Entity {
    categories = ['gloom'];
    layer = LAYER_GLOOM;

    velocityX = 0;
    velocityY = 0;

    /** Randomised so a row of identical Gloom does not pulse in lockstep. */
    wobbleSeed = randomBetween(0, TAU);

    constructor(x, y) {
        super();
        this.x = x;
        this.y = y;
    }

    update(elapsedSeconds) {
        super.update(elapsedSeconds);
        this.move(elapsedSeconds);

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

    purify() {
        this.remove();
        playPurifySound();
        this.world.camera.shake(6, 0.22);

        // The Gloom bursts into the colour it was holding onto.
        burstRainbow(this.world.firstOfCategory('particles'), this.x, this.y, 18, { speed: 320 });
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
    drawEyes(context, spacing, radius) {
        for (const side of [-1, 1]) {
            context.fillStyle = palette.gloomEye;
            context.beginPath();
            context.ellipse(side * spacing, 0, radius, radius * 1.25, 0, 0, TAU);
            context.fill();

            context.fillStyle = palette.gloomBody;
            context.fillRect(side * spacing - radius, -radius * 0.28, radius * 2, radius * 0.55);
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

    direction = -1;

    move(elapsedSeconds) {
        const terrain = this.world.firstOfCategory('terrain');

        this.velocityY = min(this.velocityY + GRAVITY * elapsedSeconds, MAX_FALL_SPEED);
        terrain.moveWithCollision(
            this,
            this.direction * MURK_SPEED * elapsedSeconds,
            this.velocityY * elapsedSeconds,
        );

        if (this.wallDirection) {
            this.direction = -this.direction;
        } else if (this.isOnGround) {
            // Look just past the leading edge; turn around if there is nothing there.
            const aheadX = this.x + this.direction * (this.halfWidth + 4);
            if (!terrain.hasGroundBelow(aheadX, this.y + this.halfHeight)) this.direction = -this.direction;
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

        context.translate(this.direction * 3, -3);
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

    move(elapsedSeconds) {
        const unicorn = this.world.firstOfCategory('unicorn');

        if (unicorn) {
            const toUnicornX = unicorn.x - this.x;
            const toUnicornY = unicorn.y - this.y;
            const distance = hypot(toUnicornX, toUnicornY) || 1;

            this.velocityX = damp(this.velocityX, (toUnicornX / distance) * WISP_SPEED, 1.6, elapsedSeconds);
            this.velocityY = damp(this.velocityY, (toUnicornY / distance) * WISP_SPEED, 1.6, elapsedSeconds);
        }

        this.x += this.velocityX * elapsedSeconds;
        // A gentle bob on top of the chase, so it never moves in a dead straight line.
        this.y += (this.velocityY + sin(this.age * 2.6 + this.wobbleSeed) * 34) * elapsedSeconds;
    }

    render() {
        const context = canvasContext;
        context.translate(this.x, this.y);

        // A short tail of fading afterimages sells the drifting.
        for (let trail = 3; trail > 0; trail--) {
            context.globalAlpha = 0.14 * trail;
            context.fillStyle = palette.gloomRim;
            context.save();
            context.translate(-this.velocityX * 0.02 * trail, -this.velocityY * 0.02 * trail);
            this.traceBlob(context, this.halfWidth * 0.9, this.halfHeight * 0.9, 0.12, 4);
            context.fill();
            context.restore();
        }

        context.globalAlpha = 1;
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
