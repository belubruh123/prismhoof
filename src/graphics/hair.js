/**
 * Springy hair, used for the unicorn's mane and tail.
 *
 * A strand is a chain of segment angles rather than a chain of positions. Each
 * segment eases towards its parent's angle plus a fixed curl, and bends towards
 * whatever external force is acting (gravity, plus drag from how fast the
 * unicorn is moving). Later segments are more strongly affected than earlier
 * ones, which is what produces the trailing whip.
 *
 * Angles are used instead of a verlet position chain because angular damping is
 * frame-rate independent through `damp()`, so the hair behaves identically at
 * 30fps and 144fps without a fixed-timestep accumulator.
 */

import { atan2, cos, hypot, min, PI, pow, sin } from '../core/math.js';

/** Force magnitude at which a segment is fully dragged into the force direction. */
const FORCE_SATURATION = 620;

export class HairStrand {
    /**
     * @param segmentCount   how many links
     * @param segmentLength  world units per link
     * @param rootThickness  stroke width at the root, tapering to a point at the tip
     * @param curl           radians each segment turns relative to its parent
     * @param stiffness      how fast a segment catches up with its target angle
     * @param maximumDrag    how far the tip can be pulled towards the force, 0..1
     */
    constructor(segmentCount, segmentLength, rootThickness, curl, stiffness, maximumDrag) {
        this.segmentAngles = new Array(segmentCount).fill(0);
        this.segmentLength = segmentLength;
        this.rootThickness = rootThickness;
        this.curl = curl;
        this.stiffness = stiffness;
        this.maximumDrag = maximumDrag;
    }

    /** Snaps every segment to its rest pose. Used when a level starts or restarts. */
    reset(baseAngle, facing) {
        for (let index = 0; index < this.segmentAngles.length; index++) {
            this.segmentAngles[index] = baseAngle + this.curl * facing * (index + 1);
        }
    }

    updateStep(elapsedSeconds, baseAngle, facing, forceX, forceY) {
        const forceAngle = atan2(forceY, forceX);
        const forceStrength = min(hypot(forceX, forceY) / FORCE_SATURATION, 1);

        let parentAngle = baseAngle;

        for (let index = 0; index < this.segmentAngles.length; index++) {
            const alongStrand = (index + 1) / this.segmentAngles.length;
            const dragWeight = forceStrength * this.maximumDrag * alongStrand;

            const restAngle = parentAngle + this.curl * facing;
            const targetAngle = restAngle + shortestAngleTo(restAngle, forceAngle) * dragWeight;

            const currentAngle = this.segmentAngles[index];
            this.segmentAngles[index] = currentAngle
                + shortestAngleTo(currentAngle, targetAngle) * (1 - pow(2, -this.stiffness * elapsedSeconds));

            parentAngle = this.segmentAngles[index];
        }
    }

    /**
     * Strokes the strand from a world-space root, tapering towards the tip.
     * Each segment is its own stroke so the width can shrink along the length.
     */
    render(context, rootX, rootY, inkColor) {
        let x = rootX;
        let y = rootY;

        context.strokeStyle = inkColor;
        context.lineCap = 'round';

        for (let index = 0; index < this.segmentAngles.length; index++) {
            const angle = this.segmentAngles[index];
            const nextX = x + cos(angle) * this.segmentLength;
            const nextY = y + sin(angle) * this.segmentLength;

            context.lineWidth = this.rootThickness * (1 - index / this.segmentAngles.length * 0.8);
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(nextX, nextY);
            context.stroke();

            x = nextX;
            y = nextY;
        }
    }
}

/** Signed difference between two angles, always taking the short way round. */
export function shortestAngleTo(from, to) {
    return ((to - from + PI * 3) % (PI * 2)) - PI;
}
