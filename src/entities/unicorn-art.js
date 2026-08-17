/**
 * Drawing the unicorn.
 *
 * Everything here is flat vector: solid fills, thick round-capped strokes, no
 * gradients on the body, no sprites. The whole character is rebuilt from paths
 * every frame, which is what lets the pose be fully procedural - there are no
 * animation frames, only angles computed from the unicorn's state.
 *
 * Local space has the origin at the centre of the collision box, +x forward and
 * +y down. `facing` is applied as a horizontal flip by the caller, so everything
 * in here can assume the unicorn faces right.
 */

import { UNICORN_HALF_HEIGHT } from '../config.js';
import { canvasContext, wrap } from '../core/canvas.js';
import { abs, acos, atan2, clamp, cos, hypot, lerp, PI, sin, TAU } from '../core/math.js';
import { HORN_COLOR, RAINBOW_COLORS, UNICORN_COAT, UNICORN_EYE, UNICORN_HOOF, UNICORN_SHADE } from '../graphics/palette.js';
import { drawRadialGlow } from '../graphics/textures.js';

// --- proportions -----------------------------------------------------------

const BODY_CENTRE_Y = -10;
const RUMP_X = -11;
const RUMP_RADIUS = 11;
const CHEST_X = 10;
const CHEST_RADIUS = 10;

const HIP_Y = 0;
const UPPER_LEG_LENGTH = 10;
const LOWER_LEG_LENGTH = 8;
const UPPER_LEG_THICKNESS = 6.5;
const LOWER_LEG_THICKNESS = 4.5;
const HOOF_LENGTH = 3.5;

const NECK_ROOT_X = 11;
const NECK_ROOT_Y = -16;
const NECK_LENGTH = 14;
const NECK_THICKNESS = 11;

const CRANIUM_RADIUS = 8;
const MUZZLE_LENGTH = 12;
const MUZZLE_HEIGHT = 8.5;

const HORN_LENGTH = 18;
const HORN_BASE_WIDTH = 6;
/** Radians the horn tilts forward from vertical, relative to the head. */
const HORN_TILT = 0.45;

/**
 * How far the neck and head drop when the horn is charged.
 *
 * This is not only a flourish. The rainbow is emitted from the horn tip, and
 * with the head held high that tip sits about 57 units above the hooves - over
 * the heads of the ground-dwelling Gloom, so the stream would sail past them
 * and the "one verb, two uses" promise would break. Lowering the horn to aim
 * brings the tip down to chest height, where it can actually hit something.
 */
const AIM_NECK_DIP = 0.55;
const AIM_HEAD_DIP = 1;

/**
 * The four legs. Indices 0 and 2 are the near side, 1 and 3 the far side.
 * Phases form a trot - diagonal pairs move together - and the far legs sit a
 * little further along x so all four read in a flat side view.
 *
 * `bendSign` picks which way the joint folds: forelegs fold back at the knee,
 * hind legs fold forward at the hock.
 */
const LEG_DEFINITIONS = [
    { hipX: 10, phase: 0, isFront: true, bendSign: -1 },
    { hipX: 6, phase: 0.5, isFront: true, bendSign: -1 },
    { hipX: -11, phase: 0.52, isFront: false, bendSign: 1 },
    { hipX: -15, phase: 0.02, isFront: false, bendSign: 1 },
];

/** Local y the ankle sits at when the hoof is planted on the ground. */
const ANKLE_Y = UNICORN_HALF_HEIGHT - HOOF_LENGTH;
/** How far forward and back a hoof reaches during one stride. */
const STRIDE_REACH = 9;
/** Peak height of a hoof during the swing phase. */
const STEP_LIFT = 9;
/** Fraction of the gait cycle a hoof spends planted. */
const STANCE_FRACTION = 0.55;

/**
 * Draws the whole unicorn. `pose` is built by Unicorn.buildPose() and holds only
 * numbers, which keeps the animation logic and the drawing separable.
 */
export function drawUnicorn(unicorn, pose) {
    const context = canvasContext;

    // The mane and tail live in world space so their physics can react to real
    // movement, so they are drawn outside the local transform.
    drawTail(context, unicorn, pose);

    wrap(() => {
        context.translate(unicorn.x, unicorn.y);
        context.scale(unicorn.facing, 1);

        // Squash, stretch and the run lean all pivot on the hooves rather than
        // the centre. Pivoting on the centre would sink the unicorn into the
        // ground on a landing and tip its back feet off the floor at speed.
        context.translate(0, unicorn.halfHeight);
        context.scale(1 + pose.squash, 1 - pose.squash);
        context.rotate(pose.bodyLean);
        context.translate(0, -unicorn.halfHeight);

        context.translate(0, pose.bodyBobY);

        drawLegPair(context, pose, true);
        drawBody(context, pose);
        drawLegPair(context, pose, false);
        drawNeckAndHead(context, unicorn, pose);
    });

    drawMane(context, unicorn, pose);
}

// --- body ------------------------------------------------------------------

function drawBody(context, pose) {
    const breathe = pose.breathe;

    context.fillStyle = UNICORN_COAT;
    context.beginPath();
    // Rump and chest as circles joined by the barrel, filled as one shape.
    context.arc(RUMP_X, BODY_CENTRE_Y, RUMP_RADIUS * (1 + breathe * 0.4), 0, TAU);
    context.arc(CHEST_X, BODY_CENTRE_Y - 1, CHEST_RADIUS * (1 + breathe), 0, TAU);
    context.rect(RUMP_X, BODY_CENTRE_Y - RUMP_RADIUS, CHEST_X - RUMP_X, RUMP_RADIUS * 2);
    context.fill();

    // A soft shaded belly, clipped to the body so it cannot spill.
    wrap(() => {
        context.clip();
        context.fillStyle = UNICORN_SHADE;
        context.globalAlpha = 0.45;
        context.beginPath();
        context.ellipse(-2, BODY_CENTRE_Y + 12, 20, 8, 0, 0, TAU);
        context.fill();
    });
}

// --- legs ------------------------------------------------------------------

/**
 * Draws two of the four legs. The far pair is drawn behind the body in the
 * shade colour, the near pair in front in the coat colour, which is what gives
 * a flat side view any sense of depth.
 */
function drawLegPair(context, pose, isFarSide) {
    const color = isFarSide ? UNICORN_SHADE : UNICORN_COAT;
    const hoofColor = isFarSide ? UNICORN_SHADE : UNICORN_HOOF;
    const thicknessScale = isFarSide ? 0.86 : 1;
    const legs = isFarSide ? [pose.legs[1], pose.legs[3]] : [pose.legs[0], pose.legs[2]];

    for (const leg of legs) drawLeg(context, leg, color, hoofColor, thicknessScale);
}

function drawLeg(context, leg, color, hoofColor, thicknessScale) {
    context.strokeStyle = color;
    context.lineCap = 'round';

    context.lineWidth = UPPER_LEG_THICKNESS * thicknessScale;
    context.beginPath();
    context.moveTo(leg.hipX, HIP_Y);
    context.lineTo(leg.kneeX, leg.kneeY);
    context.stroke();

    context.lineWidth = LOWER_LEG_THICKNESS * thicknessScale;
    context.beginPath();
    context.moveTo(leg.kneeX, leg.kneeY);
    context.lineTo(leg.ankleX, leg.ankleY);
    context.stroke();

    // The hoof is a short stub carrying on in the direction of the shin.
    const shinAngle = atan2(leg.ankleY - leg.kneeY, leg.ankleX - leg.kneeX);
    context.strokeStyle = hoofColor;
    context.lineWidth = LOWER_LEG_THICKNESS * 1.3 * thicknessScale;
    context.beginPath();
    context.moveTo(leg.ankleX, leg.ankleY);
    context.lineTo(leg.ankleX + cos(shinAngle) * HOOF_LENGTH, leg.ankleY + sin(shinAngle) * HOOF_LENGTH);
    context.stroke();
}

// --- neck, head, horn ------------------------------------------------------

function drawNeckAndHead(context, unicorn, pose) {
    const neckAngle = pose.neckAngle;
    const headX = NECK_ROOT_X + cos(neckAngle) * NECK_LENGTH;
    const headY = NECK_ROOT_Y + sin(neckAngle) * NECK_LENGTH;

    context.strokeStyle = UNICORN_COAT;
    context.lineCap = 'round';
    context.lineWidth = NECK_THICKNESS;
    context.beginPath();
    context.moveTo(NECK_ROOT_X, NECK_ROOT_Y);
    context.lineTo(headX, headY);
    context.stroke();

    wrap(() => {
        context.translate(headX, headY);
        context.rotate(pose.headAngle);

        drawEar(context, pose);
        drawHead(context);
        drawEye(context, pose);
        drawHorn(context, unicorn, pose);
    });
}

function drawHead(context) {
    context.fillStyle = UNICORN_COAT;
    context.beginPath();
    context.arc(0, 0, CRANIUM_RADIUS, 0, TAU);
    // The muzzle runs forward and slightly down from the cranium.
    context.roundRect(2, -MUZZLE_HEIGHT / 2 + 1.5, MUZZLE_LENGTH, MUZZLE_HEIGHT, MUZZLE_HEIGHT / 2);
    context.fill();

    context.fillStyle = UNICORN_SHADE;
    context.beginPath();
    context.arc(MUZZLE_LENGTH - 0.5, 2.5, 1.4, 0, TAU);
    context.fill();
}

function drawEar(context, pose) {
    wrap(() => {
        context.translate(-3, -CRANIUM_RADIUS + 1);
        context.rotate(pose.earAngle);

        context.fillStyle = UNICORN_COAT;
        context.beginPath();
        context.moveTo(-3, 1);
        context.quadraticCurveTo(-2, -8, 3, -7);
        context.quadraticCurveTo(3, -1, 3, 1);
        context.fill();

        context.fillStyle = UNICORN_SHADE;
        context.beginPath();
        context.moveTo(-1, 0);
        context.quadraticCurveTo(-0.5, -5.5, 1.8, -5);
        context.quadraticCurveTo(1.8, -1, 1.8, 0);
        context.fill();
    });
}

function drawEye(context, pose) {
    const openness = pose.eyeOpenness;

    context.fillStyle = UNICORN_EYE;

    if (openness < 0.2) {
        // A closed eye is a short lash line, not a squashed circle.
        context.lineWidth = 1.6;
        context.strokeStyle = UNICORN_EYE;
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(1.5, -0.5);
        context.lineTo(5.5, -0.5);
        context.stroke();
        return;
    }

    context.beginPath();
    context.ellipse(3.6, -0.8, 2.1, 2.6 * openness, 0, 0, TAU);
    context.fill();

    context.fillStyle = '#fff';
    context.beginPath();
    context.arc(4.4, -1.8 * openness, 0.85, 0, TAU);
    context.fill();
}

function drawHorn(context, unicorn, pose) {
    const glow = pose.hornGlow;

    wrap(() => {
        context.translate(4, -CRANIUM_RADIUS + 1.5);
        context.rotate(HORN_TILT);

        if (glow > 0.01) {
            drawRadialGlow(context, 0, -HORN_LENGTH * 0.6, 26 * glow, RAINBOW_COLORS[pose.hornColorIndex], glow * 0.75);
        }

        context.fillStyle = HORN_COLOR;
        context.beginPath();
        context.moveTo(-HORN_BASE_WIDTH / 2, 0);
        context.lineTo(HORN_BASE_WIDTH / 2, 0);
        context.lineTo(0, -HORN_LENGTH);
        context.fill();

        // Three grooves, narrowing towards the tip, sell it as a spiral.
        context.strokeStyle = UNICORN_SHADE;
        context.lineWidth = 1;
        for (let index = 1; index <= 3; index++) {
            const alongHorn = index / 4;
            const halfWidth = (HORN_BASE_WIDTH / 2) * (1 - alongHorn);
            const y = -HORN_LENGTH * alongHorn;
            context.beginPath();
            context.moveTo(-halfWidth, y + 1.5);
            context.lineTo(halfWidth, y);
            context.stroke();
        }

        if (glow > 0.01) {
            context.fillStyle = RAINBOW_COLORS[pose.hornColorIndex];
            context.globalAlpha = glow;
            context.beginPath();
            context.arc(0, -HORN_LENGTH, 3 + glow * 2, 0, TAU);
            context.fill();
        }
    });
}

// --- mane and tail ---------------------------------------------------------

/**
 * World-space root of one mane strand.
 *
 * Roots sit on the crest - the back edge of the neck - rather than on its
 * centreline, so the mane reads as growing along the top of the neck instead of
 * being painted across it. `MANE_CREST_OFFSET` is the perpendicular push back.
 */
const MANE_CREST_OFFSET = 4.5;

function maneRoot(unicorn, pose, alongNeck) {
    const neckDirectionX = cos(pose.neckAngle);
    const neckDirectionY = sin(pose.neckAngle);

    const localX = NECK_ROOT_X + neckDirectionX * NECK_LENGTH * alongNeck + neckDirectionY * MANE_CREST_OFFSET;
    const localY = NECK_ROOT_Y + neckDirectionY * NECK_LENGTH * alongNeck - neckDirectionX * MANE_CREST_OFFSET;

    return {
        x: unicorn.x + localX * unicorn.facing,
        y: unicorn.y + localY + pose.bodyBobY,
    };
}

/** Strands run from the poll down to the withers, not onto the shoulder. */
function maneStrandPosition(index, strandCount) {
    return 0.42 + (index / (strandCount - 1)) * 0.62;
}

function drawMane(context, unicorn, pose) {
    unicorn.maneStrands.forEach((strand, index) => {
        const root = maneRoot(unicorn, pose, maneStrandPosition(index, unicorn.maneStrands.length));
        strand.render(context, root.x, root.y, RAINBOW_COLORS[index % RAINBOW_COLORS.length]);
    });
}

function drawTail(context, unicorn, pose) {
    unicorn.tailStrands.forEach((strand, index) => {
        // Rooted at the top-back corner of the rump, fanning slightly downwards.
        const localX = RUMP_X - RUMP_RADIUS * 0.72;
        const localY = BODY_CENTRE_Y - RUMP_RADIUS * 0.55 + index * 2.6;

        strand.render(
            context,
            unicorn.x + localX * unicorn.facing,
            unicorn.y + localY + pose.bodyBobY,
            RAINBOW_COLORS[(index + 3) % RAINBOW_COLORS.length],
        );
    });
}

/** Where the horn tip is in world space. The rainbow ribbon is emitted from here. */
export function hornTipPosition(unicorn, pose) {
    const headX = NECK_ROOT_X + cos(pose.neckAngle) * NECK_LENGTH;
    const headY = NECK_ROOT_Y + sin(pose.neckAngle) * NECK_LENGTH + pose.bodyBobY;

    // Walk the same transform chain the renderer uses: head rotation, then the
    // horn's own offset and tilt.
    const hornBaseX = 4;
    const hornBaseY = -CRANIUM_RADIUS + 1.5;
    const hornAngle = pose.headAngle + HORN_TILT - PI / 2;

    const localX = headX
        + hornBaseX * cos(pose.headAngle) - hornBaseY * sin(pose.headAngle)
        + cos(hornAngle) * HORN_LENGTH;
    const localY = headY
        + hornBaseX * sin(pose.headAngle) + hornBaseY * cos(pose.headAngle)
        + sin(hornAngle) * HORN_LENGTH;

    return {
        x: unicorn.x + localX * unicorn.facing,
        y: unicorn.y + localY,
    };
}

// --- pose construction -----------------------------------------------------

/**
 * Turns the unicorn's physical state into the numbers the drawing code needs.
 *
 * Kept separate from both the physics and the rendering so the animation can be
 * read as one piece: this function is the entire character performance.
 */
export function buildUnicornPose(unicorn) {
    const { age, velocityX, velocityY, isOnGround, runSpeed, idleAmount } = unicorn;

    // Breathing and the idle weight-shift only show when standing still.
    const breathe = sin(age * 2.1) * 0.03 * idleAmount;
    const idleSway = sin(age * 0.8) * 0.03 * idleAmount;

    // A trot lands two hooves per cycle, so the body bobs at twice the gait rate.
    const gaitBob = -abs(sin(unicorn.runPhase * TAU)) * 2.4 * runSpeed;
    const airborneRise = isOnGround ? 0 : clamp(velocityY / 900, -1, 1) * 2;

    const legs = LEG_DEFINITIONS.map((definition, index) => buildLegPose(unicorn, definition, index));

    // Leaning into acceleration, and tipping nose-down when diving.
    const bodyLean = idleSway
        + (velocityX / 900) * 0.28 * unicorn.facing
        + (isOnGround ? 0 : clamp(velocityY / 1400, -0.35, 0.4));

    // Charging the horn lowers it to aim, which is what puts the stream at a
    // height where it can hit something standing on the ground.
    const aim = unicorn.hornGlow;

    const neckAngle = -PI / 2.35
        + sin(age * 1.7) * 0.05 * idleAmount
        - clamp(velocityY / 1600, -0.25, 0.3)
        + AIM_NECK_DIP * aim;

    const headAngle = 0.35
        + sin(age * 1.9 + 0.7) * 0.07 * idleAmount
        + runSpeed * sin(unicorn.runPhase * TAU) * 0.06
        - clamp(velocityY / 2200, -0.2, 0.2)
        + AIM_HEAD_DIP * aim;

    return {
        squash: unicorn.squash,
        breathe,
        bodyBobY: gaitBob + airborneRise + sin(age * 2.1) * 0.7 * idleAmount,
        bodyLean,
        neckAngle,
        headAngle,
        earAngle: sin(age * 1.3) * 0.06 * idleAmount - 0.1,
        eyeOpenness: unicorn.eyeOpenness,
        hornGlow: unicorn.hornGlow,
        hornColorIndex: unicorn.hornColorIndex,
        legs,
    };
}

/**
 * One leg, solved from where its hoof wants to be.
 *
 * Driving legs from a hoof target rather than from joint angles is what keeps
 * the feet on the floor: during the stance phase the target is pinned to ground
 * level and sweeps backwards, so the hoof stays planted while the body passes
 * over it, instead of swinging in an arc that lifts it off the ground.
 */
function buildLegPose(unicorn, definition, index) {
    const { hipX, isFront, bendSign } = definition;
    const target = buildHoofTarget(unicorn, definition, index);

    const knee = solveKnee(hipX, HIP_Y, target.x, target.y, UPPER_LEG_LENGTH, LOWER_LEG_LENGTH, bendSign);

    return {
        hipX,
        isFront,
        kneeX: knee.x,
        kneeY: knee.y,
        ankleX: target.x,
        ankleY: target.y,
    };
}

/** Where the ankle wants to be, in local space. */
function buildHoofTarget(unicorn, { hipX, phase: phaseOffset, isFront }, index) {
    const { runSpeed, runPhase, airborneAmount, idleAmount, age } = unicorn;

    const cyclePosition = (runPhase + phaseOffset) % 1;

    let strideX;
    let lift = 0;

    if (cyclePosition < STANCE_FRACTION) {
        // Planted: the hoof sweeps backwards at ground level.
        strideX = lerp(STRIDE_REACH, -STRIDE_REACH, cyclePosition / STANCE_FRACTION);
    } else {
        // Swing: lifted, and thrown forward to reload the stride.
        const swingProgress = (cyclePosition - STANCE_FRACTION) / (1 - STANCE_FRACTION);
        strideX = lerp(-STRIDE_REACH, STRIDE_REACH, swingProgress);
        lift = sin(swingProgress * PI) * STEP_LIFT;
    }

    // A barely-there weight shift keeps a standing unicorn from looking frozen.
    const idleShift = sin(age * 1.5 + index * 1.7) * 0.7 * idleAmount;

    const groundedX = hipX + strideX * runSpeed + idleShift;
    const groundedY = ANKLE_Y - lift * runSpeed;

    // Airborne, the legs tuck: forelegs fold up and forward, hind legs trail.
    const tuckX = hipX + (isFront ? 7 : -7);
    const tuckY = ANKLE_Y - 12;

    return {
        x: lerp(groundedX, tuckX, airborneAmount),
        y: lerp(groundedY, tuckY, airborneAmount),
    };
}

/**
 * Two-bone inverse kinematics: the knee position that puts the ankle on the
 * target. `bendSign` chooses between the two mirrored solutions.
 */
function solveKnee(hipX, hipY, ankleX, ankleY, upperLength, lowerLength, bendSign) {
    const toAnkleX = ankleX - hipX;
    const toAnkleY = ankleY - hipY;

    // Clamped just inside full extension, so the triangle never degenerates.
    const reach = clamp(hypot(toAnkleX, toAnkleY), 0.01, upperLength + lowerLength - 0.01);

    const cosineAtHip = clamp(
        (reach * reach + upperLength * upperLength - lowerLength * lowerLength) / (2 * reach * upperLength),
        -1, 1,
    );
    const hipAngle = atan2(toAnkleY, toAnkleX) + acos(cosineAtHip) * bendSign;

    return {
        x: hipX + cos(hipAngle) * upperLength,
        y: hipY + sin(hipAngle) * upperLength,
    };
}
