/**
 * The palette, and the colour-restoration effect that drives the whole theme.
 *
 * Every world colour is stored as HSL and rebuilt once per frame from
 * `colorRestoration` (0..1). At 0 the meadow is a near-monochrome violet dusk;
 * at 1 it is fully saturated. Purifying Gloom raises the value, so the world
 * visibly regains its colour as you clear a level.
 *
 * The unicorn's mane and the rainbow ribbon are deliberately excluded from this
 * and stay vivid at all times: you are the only colour left in the world.
 */

import { clamp, lerp } from '../core/math.js';

/** Hue everything collapses towards when the Gloom is at its worst. */
const GLOOM_HUE = 264;
const GLOOM_SATURATION_FACTOR = 0.14;
/** Gloomy colours flatten towards this one tone, then darken. */
const GLOOM_LIGHTNESS = 0.3;
const GLOOM_FLATTENING = 0.55;
const GLOOM_DARKENING = 0.72;

/**
 * [hue, saturation, lightness, gloomResistance] at full restoration.
 *
 * `gloomResistance` (default 0) is how much a colour ignores the Gloom. Lit
 * edges resist, because a level begins fully drained and the player still has to
 * be able to read where the platforms are. Everything the player does not need
 * to stand on is free to disappear into the dusk.
 */
const COLOR_DEFINITIONS = {
    skyTop: [248, 0.62, 0.4],
    skyMiddle: [306, 0.66, 0.6],
    skyBottom: [38, 0.94, 0.7],
    sunGlow: [45, 1, 0.72],

    hillFar: [286, 0.46, 0.52],
    hillMiddle: [270, 0.44, 0.38],
    hillNear: [258, 0.46, 0.25],

    cloud: [322, 0.85, 0.88, 0.2],
    cloudShade: [312, 0.56, 0.74, 0.15],

    terrainBody: [266, 0.36, 0.21],
    terrainShade: [268, 0.46, 0.11],
    terrainGrass: [148, 0.56, 0.4, 0.3],
    terrainGrassLight: [126, 0.68, 0.57, 0.5],

    gloomBody: [258, 0.32, 0.11],
    gloomRim: [274, 0.55, 0.34, 0.4],
    gloomEye: [6, 0.9, 0.62, 0.8],

    thorn: [280, 0.36, 0.24, 0.3],
    thornTip: [322, 0.66, 0.6, 0.7],
};

/** The seven ribbon colours. Never desaturated - this is the theme itself. */
export const RAINBOW_COLORS = [
    '#ff3b6b',
    '#ff8a3d',
    '#ffd93d',
    '#4fd67a',
    '#3dc6ff',
    '#6b6bff',
    '#c46bff',
];

/** Colours that stay constant regardless of the Gloom. */
export const UNICORN_COAT = '#fdf7ff';
export const UNICORN_SHADE = '#d9cbe8';
export const UNICORN_HOOF = '#2a2040';
export const UNICORN_EYE = '#2a2040';
export const HORN_COLOR = '#ffe9a8';

/** Filled in by `refreshPalette`, read directly by every renderer. */
export const palette = {};

let colorRestoration = 0;

export function getColorRestoration() {
    return colorRestoration;
}

export function setColorRestoration(value) {
    colorRestoration = clamp(value, 0, 1);
}

/** Shortest-arc hue interpolation, so violet-to-green does not sweep through red. */
function mixHue(from, to, amount) {
    let difference = ((to - from + 540) % 360) - 180;
    return from + difference * amount;
}

/** Applies the current restoration level to one colour definition. */
function restore([hue, saturation, lightness, gloomResistance = 0], alpha) {
    const amount = lerp(colorRestoration, 1, gloomResistance);
    const mixedHue = mixHue(GLOOM_HUE, hue, amount);
    const mixedSaturation = lerp(saturation * GLOOM_SATURATION_FACTOR, saturation, amount);
    // Gloomy colours also flatten towards a single mid tone and then darken.
    // Desaturation on its own still looks contrasty, and contrast reads as healthy.
    const gloomLightness = lerp(lightness, GLOOM_LIGHTNESS, GLOOM_FLATTENING) * GLOOM_DARKENING;
    const mixedLightness = lerp(gloomLightness, lightness, amount);

    return hsl(mixedHue, mixedSaturation, mixedLightness, alpha);
}

export function hsl(hue, saturation, lightness, alpha = 1) {
    return `hsl(${hue} ${saturation * 100}% ${lightness * 100}%${alpha < 1 ? ` / ${alpha}` : ''})`;
}

/** Rebuilds every palette string. Called once per frame, never per draw call. */
export function refreshPalette() {
    for (const name in COLOR_DEFINITIONS) {
        palette[name] = restore(COLOR_DEFINITIONS[name]);
    }
}

/** A palette colour at a given opacity. */
export function paletteWithAlpha(name, alpha) {
    return restore(COLOR_DEFINITIONS[name], alpha);
}

refreshPalette();
