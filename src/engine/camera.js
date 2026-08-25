/**
 * A camera that chases the unicorn on a spring, leads it in the direction of
 * travel, clamps to the level bounds, and can be shaken on impact.
 *
 * Two things separate this from a follow that merely lerps at the player.
 *
 * It only pulls once the unicorn has left a window in the middle of the frame,
 * so most of the small movement in a level happens *on screen* - the unicorn
 * drifts about inside the picture and the world holds still - and only real
 * travel drags the view along.
 *
 * And what is finally drawn is not that position but a second, springier stage
 * hung off it, so the frame leans into every start and stop and rocks back
 * instead of tracking dead. That has to be a separate spring: the chase is only
 * ever pulled from outside its window, so it stops the moment it arrives and can
 * never swing past its own mark, at any damping. A dead zone and an overshoot
 * cannot live on the same spring.
 */

import {
    CAMERA_DRAG,
    CAMERA_LAG_DRAG,
    CAMERA_LAG_PULL,
    CAMERA_FLOOR_REACH,
    CAMERA_HEIGHT_OFFSET,
    CAMERA_LOOK_AHEAD,
    CAMERA_LOOK_AHEAD_STIFFNESS,
    CAMERA_PULL,
    CAMERA_VERTICAL_SOFTNESS,
    CAMERA_WINDOW_HALF_HEIGHT,
    CAMERA_WINDOW_HALF_WIDTH,
    CAMERA_ZOOM,
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    RUN_MAX_SPEED,
} from '../config.js';
import { clamp, damp, max, min, randomBetween } from '../core/math.js';
import { saveData } from '../core/storage.js';

/**
 * How far past the edge of the window a distance reaches - and exactly zero
 * anywhere inside it. This one line is the entire dead zone.
 */
const beyondWindow = (distance, halfSize) => distance - clamp(distance, -halfSize, halfSize);

export class Camera {
    x = 0;
    y = 0;
    viewZoom = CAMERA_ZOOM;

    /** The entity being followed. */
    followTarget = null;

    lookAheadX = 0;

    /** The chase spring's own velocity, in world units per second. */
    driftAcross = 0;
    driftDown = 0;

    /** The second stage: where the picture actually is, and how fast it is catching up. */
    shownX = 0;
    shownY = 0;
    lagAcross = 0;
    lagDown = 0;

    shakeStrength = 0;
    shakeSeconds = 0;
    shakeOffsetX = 0;
    shakeOffsetY = 0;

    /** Drops the camera straight onto a point, with no spring, for level starts. */
    snapTo(x, y) {
        this.x = this.shownX = x;
        this.y = this.shownY = y;
        this.lookAheadX = this.driftAcross = this.driftDown = this.lagAcross = this.lagDown = 0;
        this.shakeSeconds = 0;
    }

    shake(strength, seconds = 0.25) {
        if (!saveData.screenShakeEnabled) return;
        // Never let a small bump cut short a big one.
        this.shakeStrength = max(this.shakeStrength, strength);
        this.shakeSeconds = max(this.shakeSeconds, seconds);
    }

    updateStep(elapsedSeconds, world) {
        const target = this.followTarget;

        if (target) {
            // Lead the gallop, so a run reveals ground ahead rather than behind.
            const desiredLookAhead = clamp(target.velocityAcross / RUN_MAX_SPEED, -1, 1) * CAMERA_LOOK_AHEAD;
            this.lookAheadX = damp(this.lookAheadX, desiredLookAhead, CAMERA_LOOK_AHEAD_STIFFNESS, elapsedSeconds);

            // Accelerate towards the window's edge - never towards the unicorn
            // itself - then bleed the velocity off. Integrating velocity rather
            // than position is the whole trick: the view carries momentum, so it
            // overshoots and settles instead of easing in and stopping dead.
            this.driftAcross += beyondWindow(target.x + this.lookAheadX - this.x, CAMERA_WINDOW_HALF_WIDTH)
                * CAMERA_PULL * elapsedSeconds;
            this.driftDown += beyondWindow(target.y - CAMERA_HEIGHT_OFFSET - this.y, CAMERA_WINDOW_HALF_HEIGHT)
                * CAMERA_PULL * CAMERA_VERTICAL_SOFTNESS * elapsedSeconds;

            // Frames are capped at a thirtieth of a second, so this never turns
            // negative and flips the spring inside out.
            const settle = 1 - CAMERA_DRAG * elapsedSeconds;
            this.driftAcross *= settle;
            this.driftDown *= settle;

            this.x += this.driftAcross * elapsedSeconds;
            this.y += this.driftDown * elapsedSeconds;
        }

        this.clampToBounds(world);

        // The second stage, and the only part of this class the player sees.
        this.lagAcross += (this.x - this.shownX) * CAMERA_LAG_PULL * elapsedSeconds;
        this.lagDown += (this.y - this.shownY) * CAMERA_LAG_PULL * elapsedSeconds;

        const catchUp = 1 - CAMERA_LAG_DRAG * elapsedSeconds;
        this.lagAcross *= catchUp;
        this.lagDown *= catchUp;

        this.shownX += this.lagAcross * elapsedSeconds;
        this.shownY += this.lagDown * elapsedSeconds;

        if (this.shakeSeconds > 0) {
            this.shakeSeconds -= elapsedSeconds;
            const remaining = max(0, this.shakeSeconds);
            const amount = this.shakeStrength * remaining * remaining;
            this.shakeOffsetX = randomBetween(-amount, amount);
            this.shakeOffsetY = randomBetween(-amount, amount);
        } else {
            this.shakeStrength = this.shakeOffsetX = this.shakeOffsetY = 0;
        }
    }

    /**
     * Keeps the view inside the chamber, and lets it drop a little past the
     * floor so the lava underneath stays in shot.
     *
     * Killing the drift on whichever axis was clamped matters more than it
     * looks: a view held against a wall while the unicorn keeps running would
     * otherwise wind the spring up like a catapult and fire the moment they
     * turned round.
     */
    clampToBounds(world) {
        const halfViewWidth = CANVAS_WIDTH / 2 / this.viewZoom;
        const halfViewHeight = CANVAS_HEIGHT / 2 / this.viewZoom;

        const heldX = clamp(this.x, world.boundsLeft + halfViewWidth, world.boundsRight - halfViewWidth);
        const heldY = min(this.y, world.boundsBottom + CAMERA_FLOOR_REACH - halfViewHeight);

        if (heldX !== this.x) this.driftAcross = 0;
        if (heldY !== this.y) this.driftDown = 0;

        this.x = heldX;
        this.y = heldY;
    }

    applyTransform(context) {
        context.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        context.scale(this.viewZoom, this.viewZoom);
        context.translate(-this.shownX + this.shakeOffsetX, -this.shownY + this.shakeOffsetY);
    }
}
