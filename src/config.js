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

/**
 * The air dash: one flat burst per airtime, refunded on landing, like the paint.
 *
 * Sized deliberately short. A jump already carries six tiles and the gaps that
 * ask for a bridge are six to ten, so a dash long enough to be exciting is also
 * long enough to make the one verb optional. Two tiles of extra reach rescues a
 * jump that was going to come up short without turning a bridge into a choice.
 */
export const DASH_SPEED = 560;
export const DASH_SECONDS = 0.14;
/** Speed the burst decays to when it ends, so it is a dash and not a launch. */
export const DASH_END_SPEED = 360;

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
export const PAINT_HEAD_LIFT = -120;
export const PAINT_HEAD_GRAVITY = 520;
/**
 * How much of the unicorn's own motion the stream carries with it.
 *
 * Vertical inheritance is what gives the one verb its three uses. Fired from
 * flat ground the stream barely rises, sweeping down through anything standing
 * there and splashing on the floor - that is the attack. Fired at the lip of a
 * chasm the same shot arcs over the gap, because the ground fell away - that is
 * the bridge. Fired on the way up out of a jump it inherits enough lift to climb
 * - that is the ramp.
 */
export const PAINT_HEAD_INHERITANCE_X = 0.35;
export const PAINT_HEAD_INHERITANCE_Y = 0.32;

/**
 * How hard the stream shoves back while the unicorn is off the ground, and the
 * fastest that shove alone will ever carry it upwards.
 *
 * This is what stops the one verb being only a way to build. A pour in mid-air
 * catches a fall and then holds a steady climb, so it is a glide, an extra step
 * of height and a bridge at once - and paid for out of the same meter, so how
 * long you can hang up there is exactly how much paint you left the ground with.
 *
 * Uncapped it was a rocket: the push simply beats gravity, so velocity kept
 * building and one stroke carried the unicorn a dozen tiles into the sky. The
 * cap is what turns it back into a move with a shape. Pouring never slows a jump
 * that is already rising faster than this - the recoil helps or does nothing.
 */
export const PAINT_RECOIL = 2600;
export const PAINT_RECOIL_TOP_SPEED = -300;

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

/**
 * How far in the view sits.
 *
 * The chamber no longer has to fit on the screen, so this is chosen for the
 * character rather than for the level: at 1.4 the unicorn is about sixty pixels
 * tall, which is enough for the gait, the blink and the mane to read, and the
 * view still shows fourteen tiles ahead - two more than the longest rainbow can
 * reach. Any tighter and you would be pouring bridges into ground you cannot
 * see yet, which is the one thing a chasing camera must never do to a game
 * whose whole verb is building ahead of yourself.
 */
export const CAMERA_ZOOM = 1.4;

/**
 * The window the unicorn is free to move around inside before the view starts
 * chasing it.
 *
 * This is the whole difference between a camera that watches and one that is
 * bolted on. Inside the window the pull is exactly zero, so hops, turns and
 * landings move the unicorn across the frame and leave the world still; only
 * sustained travel drags the view along behind it.
 */
export const CAMERA_WINDOW_HALF_WIDTH = 120;
export const CAMERA_WINDOW_HALF_HEIGHT = 84;

/**
 * The chase is a spring rather than a smooth follow, and it is deliberately
 * left under-damped.
 *
 * Critical damping - the fastest arrival with no overshoot - would be a drag of
 * 2*sqrt(CAMERA_PULL), about 15.7. Running at 10 puts the damping ratio near
 * 0.64, so the view arrives roughly eight percent past its mark and rocks back
 * over about three quarters of a second. That leftover is the wobble: it is
 * what a camera held in a hand does and what a lerp never does.
 */
export const CAMERA_PULL = 62;
export const CAMERA_DRAG = 10;
/**
 * The vertical spring is softened rather than damped harder. Height changes in
 * a platformer are sudden and constant, and a view that matches them exactly is
 * the most obvious tell there is that nobody tuned the camera.
 */
export const CAMERA_VERTICAL_SOFTNESS = 0.62;

/**
 * The second stage: the picture is hung off the camera on its own soft spring
 * rather than nailed to it.
 *
 * This is where the wobble actually comes from, and it has to be a separate
 * stage. The chase above is only ever pulled from outside its window, so it
 * switches off the instant it arrives and can never swing past its mark, whatever
 * its damping - a dead zone and an overshoot are mutually exclusive on one spring.
 *
 * Hung here at a damping ratio near 0.43, so every start, stop and landing leans
 * the whole frame into the movement by about forty pixels and rocks it back over
 * roughly half a second. It is the difference between a view that is carried and
 * one that is bolted on, and it is small enough to feel rather than to notice.
 */
export const CAMERA_LAG_PULL = 110;
export const CAMERA_LAG_DRAG = 9;

/** The window sits this far below the middle of the frame, leaving room to paint. */
export const CAMERA_HEIGHT_OFFSET = 34;
/** How far past the level floor the view may drop, so the lava stays in shot. */
export const CAMERA_FLOOR_REACH = 60;
/** How far the camera leads the unicorn at full gallop. */
export const CAMERA_LOOK_AHEAD = 110;
export const CAMERA_LOOK_AHEAD_STIFFNESS = 2.4;

// ---------------------------------------------------------------------------
// Render order
// ---------------------------------------------------------------------------

export const LAYER_TERRAIN = 10;
export const LAYER_PICKUP = 20;
export const LAYER_RIBBON = 30;
export const LAYER_GLOOM = 40;
export const LAYER_UNICORN = 50;
export const LAYER_PARTICLE = 60;
