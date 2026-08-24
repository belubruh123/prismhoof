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

const POOL_CAPACITY = 280;

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
     * Claims the next pool slot and fills it in.
     * Anything omitted falls back to the defaults below.
     */
    spawn({
        x,
        y,
        velocityAcross = 0,
        velocityDown = 0,
        gravity = 0,
        drag = 1.4,
        typeSize,
        endSize = 0,
        inkColor,
        lifetime = 0.5,
        shape = 0,
        spin = 0,
    }) {
        const particle = this.particles[this.nextSlot];
        this.nextSlot = (this.nextSlot + 1) % POOL_CAPACITY;

        particle.x = x;
        particle.y = y;
        particle.velocityAcross = velocityAcross;
        particle.velocityDown = velocityDown;
        particle.gravity = gravity;
        particle.drag = drag;
        particle.typeSize = typeSize;
        particle.endSize = endSize;
        particle.inkColor = inkColor;
        particle.age = 0;
        particle.lifetime = lifetime;
        particle.shape = shape;
        particle.rotation = randomBetween(0, TAU);
        particle.spin = spin;

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

            if (particle.shape) {
                drawFourPointStar(context, particle.x, particle.y, typeSize, particle.rotation);
            } else {
                context.beginPath();
                context.arc(particle.x, particle.y, typeSize, 0, TAU);
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
            shape: PARTICLE_STAR,
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
