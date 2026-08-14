/**
 * Small maths helpers, plus short aliases for the Math members the renderer
 * calls thousands of times per frame.
 */

export const { abs, min, max, sin, cos, atan2, hypot, floor, ceil, round, sqrt, sign, pow, random, PI } = Math;

export const TAU = PI * 2;

export function clamp(value, lowest, highest) {
    return value < lowest ? lowest : value > highest ? highest : value;
}

export function lerp(from, to, amount) {
    return from + (to - from) * amount;
}

/** Where `value` sits between `from` and `to`, clamped to 0..1. */
export function inverseLerp(from, to, value) {
    return clamp((value - from) / (to - from || 1), 0, 1);
}

/** Moves `value` towards `target` by at most `maximumStep`. */
export function approach(value, target, maximumStep) {
    return value < target ? min(value + maximumStep, target) : max(value - maximumStep, target);
}

/**
 * Frame-rate independent exponential smoothing.
 * `stiffness` is roughly "how many e-folds per second".
 */
export function damp(value, target, stiffness, elapsedSeconds) {
    return lerp(value, target, 1 - pow(2, -stiffness * elapsedSeconds));
}

export function randomBetween(lowest, highest) {
    return lowest + random() * (highest - lowest);
}

export function randomSign() {
    return random() < 0.5 ? -1 : 1;
}

/** Picks a random item from an array. */
export function randomItem(items) {
    return items[floor(random() * items.length) % items.length];
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

// --- easing ----------------------------------------------------------------

export function easeOutQuadratic(progress) {
    return 1 - (1 - progress) * (1 - progress);
}

export function easeOutCubic(progress) {
    return 1 - pow(1 - progress, 3);
}

export function easeInCubic(progress) {
    return progress * progress * progress;
}

export function easeInOutCubic(progress) {
    return progress < 0.5 ? 4 * progress * progress * progress : 1 - pow(-2 * progress + 2, 3) / 2;
}

/** Overshoots slightly past 1 before settling, for pops and bounces. */
export function easeOutBack(progress) {
    const overshoot = 2.2;
    return 1 + (overshoot + 1) * pow(progress - 1, 3) + overshoot * pow(progress - 1, 2);
}

export function easeOutElastic(progress) {
    if (progress <= 0 || progress >= 1) return progress;
    return pow(2, -9 * progress) * sin((progress * 10 - 0.75) * (TAU / 3)) + 1;
}
