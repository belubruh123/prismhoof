/**
 * Geometry helpers.
 *
 * Boxes are centre-based: `{ x, y, halfWidth, halfHeight }`. Centre-based boxes
 * keep the overlap test symmetric and make the drawing code, which is all
 * built around a centred origin, line up with the collision code.
 */

import { abs, max, min } from './math.js';

export function boxesOverlap(first, second) {
    return abs(first.x - second.x) < first.halfWidth + second.halfWidth
        && abs(first.y - second.y) < first.halfHeight + second.halfHeight;
}

export function boxContainsPoint(box, pointX, pointY) {
    return abs(box.x - pointX) < box.halfWidth && abs(box.y - pointY) < box.halfHeight;
}

/**
 * Where segment A->B crosses segment C->D, as a fraction along A->B.
 * Returns -1 when they do not cross.
 *
 * This is what makes the ribbon feel solid at speed: the unicorn's feet are
 * tested along the path they travelled this frame rather than at their final
 * position, so a fast fall cannot skip straight through a thin rainbow.
 */
export function segmentCrossFraction(aX, aY, bX, bY, cX, cY, dX, dY) {
    const abX = bX - aX;
    const abY = bY - aY;
    const cdX = dX - cX;
    const cdY = dY - cY;

    const denominator = abX * cdY - abY * cdX;
    if (!denominator) return -1; // parallel

    const acX = cX - aX;
    const acY = cY - aY;

    const alongAb = (acX * cdY - acY * cdX) / denominator;
    if (alongAb < 0 || alongAb > 1) return -1;

    const alongCd = (acX * abY - acY * abX) / denominator;
    if (alongCd < 0 || alongCd > 1) return -1;

    return alongAb;
}

/** Squared distance from a point to segment A->B. Squared, to skip the square root. */
export function pointToSegmentDistanceSquared(pointX, pointY, aX, aY, bX, bY) {
    const abX = bX - aX;
    const abY = bY - aY;
    const lengthSquared = abX * abX + abY * abY;

    const along = lengthSquared
        ? max(0, min(1, ((pointX - aX) * abX + (pointY - aY) * abY) / lengthSquared))
        : 0;

    const offsetX = pointX - (aX + abX * along);
    const offsetY = pointY - (aY + abY * along);

    return offsetX * offsetX + offsetY * offsetY;
}
