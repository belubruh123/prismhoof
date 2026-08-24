/**
 * Small maths helpers, plus short aliases for the Math members the renderer
 * calls thousands of times per frame.
 */

export const { abs, min, max, sin, cos, acos, atan2, hypot, floor, round, sign, pow, random, PI } = Math;

export const TAU = PI * 2;

export function clamp(value, lowest, highest) {
    return value < lowest ? lowest : value > highest ? highest : value;
}

export function lerp(from, to, amount) {
    return from + (to - from) * amount;
}

/** Moves `value` towards `target` by at most `maximumStep`. */
export function approach(value, followTarget, maximumStep) {
    return value < followTarget ? min(value + maximumStep, followTarget) : max(value - maximumStep, followTarget);
}

/**
 * Frame-rate independent exponential smoothing.
 * `stiffness` is roughly "how many e-folds per second".
 */
export function damp(value, followTarget, stiffness, elapsedSeconds) {
    return lerp(value, followTarget, 1 - pow(2, -stiffness * elapsedSeconds));
}

export function randomBetween(lowest, highest) {
    return lowest + random() * (highest - lowest);
}

export function distanceBetween(firstX, firstY, secondX, secondY) {
    return hypot(secondX - firstX, secondY - firstY);
}

/**
 * A tiny deterministic generator, so pre-rendered textures and level decoration
 * look identical on every run and stay debuggable.
 */
export function createSeededRandom(seed) {
    let state = seed;
    return () => {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state / 0x7fffffff;
    };
}
