/**
 * Every tunable number in the game lives here, grouped by system.
 *
 * Keeping them in one place makes the game feel-tuning loop fast, and gives the
 * build a single module full of constants that inline and compress well.
 */

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

/** Internal coordinate space. The canvas is letterboxed into the window at 16:9. */
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

/** Cap on the backing-store scale, so a 4K display does not cost 4x the fill rate. */
export const MAX_RENDER_SCALE = 2;

/** A single frame never advances the simulation by more than this, so alt-tab cannot teleport anyone. */
export const MAX_FRAME_SECONDS = 1 / 30;

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

/** Terrain is a grid of square tiles this many world units across. */
export const TILE_SIZE = 40;

export const GRAVITY = 2150;
export const MAX_FALL_SPEED = 1150;

// ---------------------------------------------------------------------------
// The unicorn
// ---------------------------------------------------------------------------

export const UNICORN_HALF_WIDTH = 14;
export const UNICORN_HALF_HEIGHT = 22;

export const RUN_MAX_SPEED = 345;
export const RUN_ACCELERATION_GROUND = 2700;
export const RUN_ACCELERATION_AIR = 1900;
export const RUN_TURN_ACCELERATION = 4200;
export const GROUND_FRICTION = 3000;
export const AIR_FRICTION = 620;

/**
 * Peaks about 134 units up, a little over three tiles. Tall on purpose: the
 * rainbow leaves the horn well above the hooves, so a shorter jump cannot
 * comfortably reach a bridge the unicorn just painted for itself.
 */
export const JUMP_VELOCITY = -760;
/** Releasing the jump key mid-rise keeps only this fraction of the upward speed. */
export const JUMP_RELEASE_DAMPING = 0.42;
/** Grace period after walking off a ledge during which a jump still counts. */
export const COYOTE_SECONDS = 0.1;
/** A jump pressed this long before landing still fires on touchdown. */
export const JUMP_BUFFER_SECONDS = 0.12;
/** Extra downward acceleration while holding the dive key. */
export const DIVE_ACCELERATION = 2400;

// ---------------------------------------------------------------------------
// The rainbow ribbon - the core mechanic
// ---------------------------------------------------------------------------

/**
 * The paint head: the bright point the rainbow pours out of.
 *
 * The horn does not trail a ribbon behind the unicorn, it hoses one out ahead.
 * That is not a stylistic choice - a trail emitted at the horn sits permanently
 * above the hooves, so the unicorn could never land on an arc it painted during
 * the same jump, and the core loop would not close. A head that outruns the
 * unicorn and falls under its own gravity lays the ramp ahead and below, where
 * it can actually be used.
 */
export const PAINT_HEAD_SPEED = 560;
/**
 * Upward kick at firing, and how hard the stream falls.
 *
 * Tuned so a full-length stroke rises about thirty units and comes back down to
 * roughly the height it started at - a shallow hump that works as a bridge. A
 * heavier arc looks more dramatic but spends its second half too steep to stand
 * on, which makes most of the rainbow useless.
 */
export const PAINT_HEAD_LIFT = -180;
export const PAINT_HEAD_GRAVITY = 520;
/**
 * How much of the unicorn's own motion the stream carries with it. Vertical
 * inheritance is much weaker on purpose: at full jump speed, matching the
 * horizontal figure would fire the rainbow almost straight up and out of reach.
 */
export const PAINT_HEAD_INHERITANCE_X = 0.35;
export const PAINT_HEAD_INHERITANCE_Y = 0.16;

/**
 * Paint energy is normalised to 0..1 so the HUD meter is a direct read.
 * A full-length stroke takes about a fifth of a second, so these rates work out
 * to roughly three strokes on a full meter, refilled in under two seconds.
 * Draining per second rather than per stroke means a short stroke costs less.
 */
export const PAINT_DRAIN_PER_SECOND = 1.5;
export const PAINT_REFILL_PER_SECOND = 0.55;
/** Refilling only starts this long after the last paint stroke ended. */
export const PAINT_REFILL_DELAY_SECONDS = 0.22;

/**
 * Energy needed to begin a new stroke. An existing stroke may run all the way
 * down to zero, but without a floor to start one, holding the key through an
 * empty meter would spawn a new stub ribbon every few frames as it trickles up.
 */
export const PAINT_MINIMUM_TO_START = 0.2;

/** A new ribbon point is only appended once the horn has travelled this far. */
export const RIBBON_POINT_SPACING = 9;
/** Caps one stroke at roughly ten tiles, and bounds the collision work. */
export const RIBBON_MAX_POINTS = 44;
export const RIBBON_THICKNESS = 15;
/** Ribbons hold for this long, then dissolve over RIBBON_FADE_SECONDS. */
export const RIBBON_LIFE_SECONDS = 6;
export const RIBBON_FADE_SECONDS = 1;
/** Painting a fourth ribbon dissolves the oldest, which bounds the collision work. */
export const MAX_LIVE_RIBBONS = 3;
/** A ribbon only purifies Gloom while it is this fresh, so old arcs are terrain, not a weapon. */
export const RIBBON_PURIFY_SECONDS = 0.85;

/**
 * How far below the hooves to keep reaching for a ribbon that is already being
 * stood on. Without it, running down a curving arc steps off into space every
 * few frames and lands again, which reads as stuttering.
 */
export const RIBBON_SNAP_DISTANCE = 11;

/**
 * Steepest ribbon that still counts as a floor, as a rise-over-run ratio.
 * Anything steeper is a wall and is passed through, so a near-vertical stroke
 * cannot fling the unicorn up into the air.
 */
export const RIBBON_MAX_LANDABLE_SLOPE = 2.2;

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

export const CAMERA_FOLLOW_STIFFNESS = 7.5;
/** How far the camera leads the unicorn at full gallop. */
export const CAMERA_LOOK_AHEAD = 110;
export const CAMERA_LOOK_AHEAD_STIFFNESS = 2.4;

// ---------------------------------------------------------------------------
// Render order
// ---------------------------------------------------------------------------

export const LAYER_BACKGROUND = 0;
export const LAYER_TERRAIN = 10;
export const LAYER_PICKUP = 20;
export const LAYER_RIBBON = 30;
export const LAYER_GLOOM = 40;
export const LAYER_UNICORN = 50;
export const LAYER_PARTICLE = 60;
export const LAYER_OVERLAY = 70;
