/**
 * All particles in a level live in one entity, drawn in a single pass.
 *
 * The pool is a fixed-size ring: spawning past capacity overwrites the oldest
 * particle. That keeps allocation at zero after warm-up and puts a hard ceiling
 * on per-frame cost, which matters because the juice pass leans on particles
 * heavily.
 */

import { LAYER_PARTICLE } from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { cos, randomBetween, sin, TAU } from '../core/math.js';
import { RAINBOW_COLORS } from '../graphics/palette.js';
import { Entity } from './entity.js';

export const PARTICLE_STAR = 1;
/** An expanding hoop, for shockwaves. Stroked rather than filled. */
export const PARTICLE_RING = 2;

const POOL_CAPACITY = 280;

/** Everything a spawn may leave out. `typeSize` and `inkColor` never are. */
const PARTICLE_DEFAULTS = {
    velocityAcross: 0,
    velocityDown: 0,
    gravity: 0,
    drag: 1.4,
    endSize: 0,
    lifetime: 0.5,
    particleShape: 0,
    spin: 0,
};

export class ParticleField extends Entity {
    categories = ['particles'];
    layer = LAYER_PARTICLE;

    particles = [];
    nextSlot = 0;

    constructor() {
        super();
        for (let index = 0; index < POOL_CAPACITY; index++) {
            this.particles.push({ age: 0, lifetime: 0 });
        }
    }

    /**
     * Claims the next pool slot and fills it in. Anything omitted falls back to
     * the defaults above.
     *
     * One Object.assign rather than a named parameter for every field and an
     * assignment to go with it: those were sixty-odd tokens saying nothing the
     * defaults object does not already say. It is safe under the release build's
     * property mangling because both the defaults and every call site are object
     * literals, so the mangler renames the keys and the reads together.
     */
    spawn(options) {
        const particle = Object.assign(this.particles[this.nextSlot], PARTICLE_DEFAULTS, options);
        this.nextSlot = (this.nextSlot + 1) % POOL_CAPACITY;

        particle.age = 0;
        particle.rotation = randomBetween(0, TAU);

        return particle;
    }

    updateStep(elapsedSeconds) {
        super.updateStep(elapsedSeconds);

        for (const particle of this.particles) {
            if (particle.age >= particle.lifetime) continue;

            particle.age += elapsedSeconds;
            particle.velocityDown += particle.gravity * elapsedSeconds;

            const dragFactor = 1 - particle.drag * elapsedSeconds;
            particle.velocityAcross *= dragFactor;
            particle.velocityDown *= dragFactor;

            particle.x += particle.velocityAcross * elapsedSeconds;
            particle.y += particle.velocityDown * elapsedSeconds;
            particle.rotation += particle.spin * elapsedSeconds;
        }
    }

    render() {
        const context = canvasContext;

        for (const particle of this.particles) {
            const progress = particle.age / particle.lifetime;
            if (progress >= 1) continue;

            const typeSize = particle.typeSize + (particle.endSize - particle.typeSize) * progress;
            if (typeSize <= 0) continue;

            context.globalAlpha = progress > 0.7 ? (1 - progress) / 0.3 : 1;
            context.fillStyle = particle.inkColor;

            if (particle.particleShape === PARTICLE_STAR) {
                drawFourPointStar(context, particle.x, particle.y, typeSize, particle.rotation);
                continue;
            }

            // One circle serves both remaining shapes: filled it is a mote,
            // stroked it is a shockwave. Thinning as it grows is what makes the
            // ring read as travelling outwards rather than as inflating.
            context.beginPath();
            context.arc(particle.x, particle.y, typeSize, 0, TAU);

            if (particle.particleShape) {
                context.strokeStyle = particle.inkColor;
                context.lineWidth = (1 - progress) * 6;
                context.stroke();
            } else {
                context.fill();
            }
        }

        context.globalAlpha = 1;
    }
}

/**
 * A radial burst of rainbow sparkles.
 *
 * Purifying a Gloom, jumping and dying are all the same gesture - something
 * bursts into the colour it was holding - so they share one emitter rather than
 * three copies of the same twenty lines.
 */
export function burstRainbow(particles, x, y, count, {
    speed = 240,
    spread = 0.7,
    gravity = 260,
    minSize = 3,
    maxSize = 7,
    lifetime = 0.8,
} = {}) {
    if (!particles) return;

    for (let index = 0; index < count; index++) {
        const angle = randomBetween(0, TAU);
        const magnitude = randomBetween(speed * (1 - spread), speed);

        particles.spawn({
            x,
            y,
            velocityAcross: cos(angle) * magnitude,
            velocityDown: sin(angle) * magnitude,
            gravity,
            typeSize: randomBetween(minSize, maxSize),
            endSize: 0,
            lifetime: randomBetween(lifetime * 0.6, lifetime),
            inkColor: RAINBOW_COLORS[index % RAINBOW_COLORS.length],
            particleShape: PARTICLE_STAR,
            spin: randomBetween(-9, 9),
        });
    }
}

/** A pinched four-point sparkle - the shape that reads as "magic" at any size. */
export function drawFourPointStar(context, x, y, radius, rotation) {
    const waist = radius * 0.22;

    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.beginPath();
    context.moveTo(0, -radius);
    context.quadraticCurveTo(waist, -waist, radius, 0);
    context.quadraticCurveTo(waist, waist, 0, radius);
    context.quadraticCurveTo(-waist, waist, -radius, 0);
    context.quadraticCurveTo(-waist, -waist, 0, -radius);
    context.fill();
    context.restore();
}
