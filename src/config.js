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

export const JUMP_VELOCITY = -655;
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

/** Paint energy is normalised to 0..1 so the HUD meter is a direct read. */
export const PAINT_DRAIN_PER_SECOND = 0.44;
export const PAINT_REFILL_PER_SECOND = 0.8;
/** Refilling only starts this long after the last paint stroke ended. */
export const PAINT_REFILL_DELAY_SECONDS = 0.22;

/** A new ribbon point is only appended once the horn has travelled this far. */
export const RIBBON_POINT_SPACING = 9;
export const RIBBON_MAX_POINTS = 90;
export const RIBBON_THICKNESS = 15;
/** Ribbons hold for this long, then dissolve over RIBBON_FADE_SECONDS. */
export const RIBBON_LIFE_SECONDS = 6;
export const RIBBON_FADE_SECONDS = 1;
/** Painting a fourth ribbon dissolves the oldest, which bounds the collision work. */
export const MAX_LIVE_RIBBONS = 3;
/** A ribbon only purifies Gloom while it is this fresh, so old arcs are terrain, not a weapon. */
export const RIBBON_PURIFY_SECONDS = 0.85;

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
