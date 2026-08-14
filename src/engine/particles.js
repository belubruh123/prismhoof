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

export const PARTICLE_CIRCLE = 0;
export const PARTICLE_SPARK = 1;
export const PARTICLE_STAR = 2;

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
        velocityX = 0,
        velocityY = 0,
        gravity = 0,
        drag = 1.4,
        size,
        endSize = 0,
        color,
        lifetime = 0.5,
        shape = PARTICLE_CIRCLE,
        spin = 0,
    }) {
        const particle = this.particles[this.nextSlot];
        this.nextSlot = (this.nextSlot + 1) % POOL_CAPACITY;

        particle.x = x;
        particle.y = y;
        particle.velocityX = velocityX;
        particle.velocityY = velocityY;
        particle.gravity = gravity;
        particle.drag = drag;
        particle.size = size;
        particle.endSize = endSize;
        particle.color = color;
        particle.age = 0;
        particle.lifetime = lifetime;
        particle.shape = shape;
        particle.rotation = randomBetween(0, TAU);
        particle.spin = spin;

        return particle;
    }

    /** Spawns `count` particles flung outwards from a point. */
    burst(x, y, count, { speed = 200, spread = 1, ...options }) {
        for (let index = 0; index < count; index++) {
            const angle = randomBetween(0, TAU);
            const magnitude = randomBetween(speed * (1 - spread * 0.6), speed);
            this.spawn({
                ...options,
                x,
                y,
                velocityX: cos(angle) * magnitude,
                velocityY: sin(angle) * magnitude,
            });
        }
    }

    update(elapsedSeconds) {
        super.update(elapsedSeconds);

        for (const particle of this.particles) {
            if (particle.age >= particle.lifetime) continue;

            particle.age += elapsedSeconds;
            particle.velocityY += particle.gravity * elapsedSeconds;

            const dragFactor = 1 - particle.drag * elapsedSeconds;
            particle.velocityX *= dragFactor;
            particle.velocityY *= dragFactor;

            particle.x += particle.velocityX * elapsedSeconds;
            particle.y += particle.velocityY * elapsedSeconds;
            particle.rotation += particle.spin * elapsedSeconds;
        }
    }

    render() {
        const context = canvasContext;

        for (const particle of this.particles) {
            const progress = particle.age / particle.lifetime;
            if (progress >= 1) continue;

            const size = particle.size + (particle.endSize - particle.size) * progress;
            if (size <= 0) continue;

            context.globalAlpha = progress > 0.7 ? (1 - progress) / 0.3 : 1;
            context.fillStyle = particle.color;

            if (particle.shape === PARTICLE_CIRCLE) {
                context.beginPath();
                context.arc(particle.x, particle.y, size, 0, TAU);
                context.fill();
            } else if (particle.shape === PARTICLE_SPARK) {
                context.save();
                context.translate(particle.x, particle.y);
                context.rotate(Math.atan2(particle.velocityY, particle.velocityX));
                context.fillRect(-size * 2, -size / 2, size * 4, size);
                context.restore();
            } else {
                drawFourPointStar(context, particle.x, particle.y, size, particle.rotation);
            }
        }

        context.globalAlpha = 1;
    }
}

/**
 * A radial burst of rainbow sparkles.
 *
 * Purifying a Gloom, collecting a shard and dying are all the same gesture -
 * something bursts into the colour it was holding - so they share one emitter
 * rather than three copies of the same twenty lines.
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
            velocityX: cos(angle) * magnitude,
            velocityY: sin(angle) * magnitude,
            gravity,
            size: randomBetween(minSize, maxSize),
            endSize: 0,
            lifetime: randomBetween(lifetime * 0.6, lifetime),
            color: RAINBOW_COLORS[index % RAINBOW_COLORS.length],
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
