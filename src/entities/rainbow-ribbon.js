/**
 * The rainbow ribbon: the game's one verb.
 *
 * Holding the paint key fires a bright head out of the unicorn's horn. The head
 * flies forwards, falls under its own gravity, and lays a solid rainbow behind
 * it until it splashes against terrain or runs out of length. What it leaves is
 * a ramp ahead of and below the unicorn, which is exactly where a platform is
 * useful mid-jump.
 *
 * While the stream is still flowing it also purifies any Gloom it passes
 * through, so traversal and combat are the same action. Painting costs energy
 * that only refills on solid footing, so the question every level asks is where
 * to spend your arcs.
 *
 * Ribbons are one-way floors: you can always jump up through your own rainbow
 * and land on it coming down, which keeps the mechanic generous rather than
 * fiddly.
 */

import {
    LAYER_RIBBON,
    PAINT_HEAD_GRAVITY,
    RIBBON_FADE_SECONDS,
    RIBBON_LIFE_SECONDS,
    RIBBON_MAX_LANDABLE_SLOPE,
    RIBBON_MAX_POINTS,
    RIBBON_POINT_SPACING,
    RIBBON_THICKNESS,
} from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { abs, clamp, distanceBetween, max, min, TAU } from '../core/math.js';
import { pointToSegmentDistanceSquared, segmentCrossFraction } from '../core/rect.js';
import { Entity } from '../engine/entity.js';
import { RAINBOW_COLORS } from '../graphics/palette.js';

/** The point still in flight is not a landing surface yet. */
const WET_POINT_COUNT = 1;

export class RainbowRibbon extends Entity {
    categories = ['ribbon'];
    layer = LAYER_RIBBON;

    nodePoints = [];

    /** True while the paint key is still held and points are being added. */
    isBeingPainted = true;

    /** Time since painting stopped. A ribbon does not age while it is being drawn. */
    settledSeconds = 0;

    /** Rebuilt only when a point is added, not every frame. */
    cachedPath = null;

    constructor(headX, headY, headVelocityX, headVelocityY) {
        super();
        this.headX = headX;
        this.headY = headY;
        this.headVelocityX = headVelocityX;
        this.headVelocityY = headVelocityY;
        this.addPoint(headX, headY);
    }

    /**
     * Flies the head one step and lays rainbow behind it.
     * Returns false once the stream should stop: it hit terrain, or the stroke
     * has reached its maximum length.
     */
    advanceHead(elapsedSeconds, terrain) {
        this.headVelocityY += PAINT_HEAD_GRAVITY * elapsedSeconds;
        this.headX += this.headVelocityX * elapsedSeconds;
        this.headY += this.headVelocityY * elapsedSeconds;

        // Splashing against terrain is what makes a rainbow feel like it lands
        // and sticks, rather than being drawn straight through the scenery.
        if (terrain.isSolidAtWorld(this.headX, this.headY)) return false;

        this.addPoint(this.headX, this.headY);
        return this.nodePoints.length < RIBBON_MAX_POINTS;
    }

    /**
     * Appends a point if the horn has travelled far enough since the last one.
     * Returns true when a point was actually added, so the caller can spark.
     */
    addPoint(x, y) {
        if (this.nodePoints.length >= RIBBON_MAX_POINTS) return false;

        const lastPoint = this.nodePoints[this.nodePoints.length - 1];
        if (lastPoint && distanceBetween(lastPoint.x, lastPoint.y, x, y) < RIBBON_POINT_SPACING) return false;

        this.nodePoints.push({ x, y });
        this.cachedPath = null;
        return true;
    }

    finishPainting() {
        this.isBeingPainted = false;
    }

    /** Brings the dissolve forward, used when a fourth ribbon is started. */
    dissolveNow() {
        this.isBeingPainted = false;
        this.settledSeconds = max(this.settledSeconds, RIBBON_LIFE_SECONDS);
    }

    get isDissolving() {
        return this.settledSeconds >= RIBBON_LIFE_SECONDS;
    }

    get fadeProgress() {
        return clamp((this.settledSeconds - RIBBON_LIFE_SECONDS) / RIBBON_FADE_SECONDS, 0, 1);
    }

    /** True while this ribbon is fresh enough to purify Gloom. */
    get isWet() {
        return this.isBeingPainted;
    }

    updateStep(elapsedSeconds) {
        super.updateStep(elapsedSeconds);

        if (this.isBeingPainted) return;

        this.settledSeconds += elapsedSeconds;
        if (this.settledSeconds >= RIBBON_LIFE_SECONDS + RIBBON_FADE_SECONDS) this.removeFromWorld();
    }

    // --- collision ----------------------------------------------------------

    /**
     * Tests a swept foot segment against this ribbon.
     *
     * Returns the world y to stand at, or null. Testing the path the feet
     * travelled rather than where they ended up is what stops a fast fall from
     * passing straight through a thin rainbow.
     */
    findLandingY(fromX, fromY, toX, toY) {
        const lastUsablePoint = this.nodePoints.length - (this.isBeingPainted ? WET_POINT_COUNT : 0);

        let earliestFraction = 2;
        let landingY = null;

        for (let index = 1; index < lastUsablePoint; index++) {
            const start = this.nodePoints[index - 1];
            const end = this.nodePoints[index];

            // Near-vertical stretches are walls, not floors.
            if (abs(end.y - start.y) > abs(end.x - start.x) * RIBBON_MAX_LANDABLE_SLOPE) continue;

            const fraction = segmentCrossFraction(fromX, fromY, toX, toY, start.x, start.y, end.x, end.y);
            if (fraction < 0 || fraction >= earliestFraction) continue;

            earliestFraction = fraction;
            landingY = fromY + (toY - fromY) * fraction;
        }

        return landingY;
    }

    /**
     * The height of the ribbon directly above or below a point, or null if the
     * point is not over a landable stretch or is further from it than `reach`.
     *
     * Standing on a rainbow is resolved with this rather than with the swept
     * test, because feet walking *up* a slope never cross the segment they are
     * already on. The swept test alone can only catch a ribbon that is being
     * fallen through, so on its own it drops the unicorn straight off the arc
     * the moment it turns round and heads back the way it came.
     */
    surfaceYNear(x, y, reach) {
        for (let index = 1; index < this.nodePoints.length; index++) {
            const start = this.nodePoints[index - 1];
            const end = this.nodePoints[index];

            // Near-vertical stretches are walls, not floors. Checked first
            // because it is also what rules out a zero-width segment below.
            if (abs(end.y - start.y) > abs(end.x - start.x) * RIBBON_MAX_LANDABLE_SLOPE) continue;
            if (x < min(start.x, end.x) || x > max(start.x, end.x)) continue;

            const surfaceY = start.y + (end.y - start.y) * ((x - start.x) / (end.x - start.x));
            if (abs(surfaceY - y) <= reach) return surfaceY;
        }
        return null;
    }

    /** Closest approach of any segment to a point, for Gloom purification tests. */
    isNearPoint(x, y, radius) {
        const radiusSquared = (radius + RIBBON_THICKNESS / 2) ** 2;

        for (let index = 1; index < this.nodePoints.length; index++) {
            const start = this.nodePoints[index - 1];
            const end = this.nodePoints[index];
            if (pointToSegmentDistanceSquared(x, y, start.x, start.y, end.x, end.y) < radiusSquared) return true;
        }
        return false;
    }

    // --- render -------------------------------------------------------------

    buildPath() {
        const path = new Path2D();
        path.moveTo(this.nodePoints[0].x, this.nodePoints[0].y);
        for (let index = 1; index < this.nodePoints.length; index++) {
            path.lineTo(this.nodePoints[index].x, this.nodePoints[index].y);
        }
        return path;
    }

    render() {
        if (this.nodePoints.length < 2) return;

        const context = canvasContext;
        const path = (this.cachedPath ||= this.buildPath());

        const fade = this.fadeProgress;
        const opacity = 1 - fade;
        const thickness = RIBBON_THICKNESS * (1 - fade * 0.55);

        context.lineCap = 'round';
        context.lineJoin = 'round';

        // A wide soft pass underneath reads as the paint still glowing.
        // Drawn additively: a plain white pass at low alpha just greys out the
        // sky behind it, which looks like haze rather than light.
        context.globalCompositeOperation = 'lighter';
        context.globalAlpha = opacity * 0.3;
        context.strokeStyle = '#4a3070';
        context.lineWidth = thickness + 12;
        context.stroke(path);
        context.globalCompositeOperation = 'source-over';

        // Seven nested strokes, widest first, so the band reads as a rainbow
        // without needing to offset the polyline seven times.
        context.globalAlpha = opacity;
        for (let index = 0; index < RAINBOW_COLORS.length; index++) {
            context.strokeStyle = RAINBOW_COLORS[index];
            context.lineWidth = thickness * (1 - index / RAINBOW_COLORS.length);
            context.stroke(path);
        }

        if (this.isBeingPainted) this.renderHead(context);
    }

    /** The bright bead of paint at the front of a flowing stream. */
    renderHead(context) {
        context.globalAlpha = 1;
        context.globalCompositeOperation = 'lighter';

        context.fillStyle = '#5a4a90';
        context.beginPath();
        context.arc(this.headX, this.headY, RIBBON_THICKNESS * 1.6, 0, TAU);
        context.fill();

        context.globalCompositeOperation = 'source-over';
        context.fillStyle = '#fff';
        context.beginPath();
        context.arc(this.headX, this.headY, RIBBON_THICKNESS * 0.55, 0, TAU);
        context.fill();
    }
}
