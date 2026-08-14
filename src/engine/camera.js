/**
 * A camera that follows the unicorn with a spring, leads it in the direction of
 * travel, clamps to the level bounds, and can be shaken on impact.
 */

import {
    CAMERA_FOLLOW_STIFFNESS,
    CAMERA_LOOK_AHEAD,
    CAMERA_LOOK_AHEAD_STIFFNESS,
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    RUN_MAX_SPEED,
} from '../config.js';
import { clamp, damp, max, randomBetween } from '../core/math.js';
import { saveData } from '../core/storage.js';

export class Camera {
    x = 0;
    y = 0;
    zoom = 1;

    /** The entity being followed. */
    target = null;

    lookAheadX = 0;

    shakeStrength = 0;
    shakeSeconds = 0;
    shakeOffsetX = 0;
    shakeOffsetY = 0;

    /** Drops the camera straight onto the target, with no spring, for level starts. */
    snapTo(x, y) {
        this.x = x;
        this.y = y;
        this.lookAheadX = 0;
        this.shakeSeconds = 0;
    }

    shake(strength, seconds = 0.25) {
        if (!saveData.screenShakeEnabled) return;
        // Never let a small bump cut short a big one.
        this.shakeStrength = max(this.shakeStrength, strength);
        this.shakeSeconds = max(this.shakeSeconds, seconds);
    }

    update(elapsedSeconds, world) {
        if (this.target) {
            const desiredLookAhead = clamp(this.target.velocityX / RUN_MAX_SPEED, -1, 1) * CAMERA_LOOK_AHEAD;
            this.lookAheadX = damp(this.lookAheadX, desiredLookAhead, CAMERA_LOOK_AHEAD_STIFFNESS, elapsedSeconds);

            this.x = damp(this.x, this.target.x + this.lookAheadX, CAMERA_FOLLOW_STIFFNESS, elapsedSeconds);
            this.y = damp(this.y, this.target.y - 30, CAMERA_FOLLOW_STIFFNESS, elapsedSeconds);
        }

        this.clampToBounds(world);

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
     * Keeps the view inside the level. When the level is smaller than the view
     * on an axis, the level is centred on that axis instead.
     */
    clampToBounds(world) {
        const halfViewWidth = CANVAS_WIDTH / 2 / this.zoom;
        const halfViewHeight = CANVAS_HEIGHT / 2 / this.zoom;

        const { boundsLeft, boundsRight, boundsTop, boundsBottom } = world;

        this.x = boundsRight - boundsLeft < halfViewWidth * 2
            ? (boundsLeft + boundsRight) / 2
            : clamp(this.x, boundsLeft + halfViewWidth, boundsRight - halfViewWidth);

        this.y = boundsBottom - boundsTop < halfViewHeight * 2
            ? (boundsTop + boundsBottom) / 2
            : clamp(this.y, boundsTop + halfViewHeight, boundsBottom - halfViewHeight);
    }

    applyTransform(context) {
        context.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        context.scale(this.zoom, this.zoom);
        context.translate(-this.x + this.shakeOffsetX, -this.y + this.shakeOffsetY);
    }

    /** World-space rectangle currently on screen, for culling. */
    get viewLeft() { return this.x - CANVAS_WIDTH / 2 / this.zoom; }
    get viewRight() { return this.x + CANVAS_WIDTH / 2 / this.zoom; }
    get viewTop() { return this.y - CANVAS_HEIGHT / 2 / this.zoom; }
    get viewBottom() { return this.y + CANVAS_HEIGHT / 2 / this.zoom; }

    /** True when a box of this size at this position could be visible. */
    isVisible(x, y, margin = 0) {
        return x > this.viewLeft - margin && x < this.viewRight + margin
            && y > this.viewTop - margin && y < this.viewBottom + margin;
    }
}
