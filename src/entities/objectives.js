/**
 * The things that define a level's goal: the static Thorn hazard, the optional
 * Prism Shard pickup, and the Rainbow Gate that ends the level.
 *
 * The gate stays shut until every Gloom is purified, so the level's win
 * condition is readable from the world itself with no extra bookkeeping.
 */

import { LAYER_GLOOM, LAYER_PICKUP, TILE_SIZE } from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { clamp, cos, max, min, randomBetween, sin, TAU } from '../core/math.js';
import { boxesOverlap } from '../core/rect.js';
import { Entity } from '../engine/entity.js';
import { PARTICLE_STAR, drawFourPointStar } from '../engine/particles.js';
import { palette, RAINBOW_COLORS } from '../graphics/palette.js';
import { drawRadialGlow } from '../graphics/textures.js';

/** How much paint one shard puts back in the horn. */
const SHARD_PAINT_REWARD = 0.45;

/**
 * A cluster of spikes growing out of the ground. Purely static: it cannot be
 * purified, so it has to be jumped or bridged over.
 */
export class Thorn extends Entity {
    categories = ['hazard'];
    layer = LAYER_GLOOM;

    halfWidth = TILE_SIZE / 2 - 3;
    halfHeight = 11;

    constructor(x, y) {
        super();
        this.x = x;
        // Sits on the floor of its tile rather than the middle of it.
        this.y = y + TILE_SIZE / 2 - this.halfHeight;
    }

    update(elapsedSeconds) {
        super.update(elapsedSeconds);

        const unicorn = this.world.firstOfCategory('unicorn');
        if (unicorn && !unicorn.isDead && boxesOverlap(this, unicorn)) unicorn.die();
    }

    render() {
        const context = canvasContext;
        context.translate(this.x, this.y + this.halfHeight);

        const spikeCount = 3;
        const spacing = (this.halfWidth * 2) / spikeCount;

        for (let index = 0; index < spikeCount; index++) {
            const x = -this.halfWidth + spacing * (index + 0.5);
            const height = this.halfHeight * (index === 1 ? 2.1 : 1.6);

            context.fillStyle = palette.thorn;
            context.beginPath();
            context.moveTo(x - spacing * 0.45, 0);
            context.lineTo(x, -height);
            context.lineTo(x + spacing * 0.45, 0);
            context.fill();

            // A lit tip, so thorns stay readable against a dark, drained level.
            context.fillStyle = palette.thornTip;
            context.beginPath();
            context.moveTo(x - spacing * 0.16, -height * 0.62);
            context.lineTo(x, -height);
            context.lineTo(x + spacing * 0.16, -height * 0.62);
            context.fill();
        }
    }
}

/** A floating shard that tops the paint meter back up. */
export class PrismShard extends Entity {
    categories = ['shard'];
    layer = LAYER_PICKUP;

    halfWidth = 13;
    halfHeight = 13;

    constructor(x, y) {
        super();
        this.x = x;
        this.y = y;
        this.bobSeed = randomBetween(0, TAU);
    }

    get bobOffset() {
        return sin(this.age * 2.2 + this.bobSeed) * 5;
    }

    update(elapsedSeconds) {
        super.update(elapsedSeconds);

        const unicorn = this.world.firstOfCategory('unicorn');
        if (!unicorn || unicorn.isDead || !boxesOverlap(this, unicorn)) return;

        unicorn.paintEnergy = min(1, unicorn.paintEnergy + SHARD_PAINT_REWARD);
        unicorn.onShardCollected?.();
        this.burst();
        this.remove();
    }

    burst() {
        const particles = this.world.firstOfCategory('particles');
        if (!particles) return;

        for (let index = 0; index < 12; index++) {
            const angle = randomBetween(0, TAU);
            const speed = randomBetween(70, 230);
            particles.spawn({
                x: this.x,
                y: this.y,
                velocityX: cos(angle) * speed,
                velocityY: sin(angle) * speed,
                gravity: 140,
                size: randomBetween(3, 6),
                endSize: 0,
                lifetime: randomBetween(0.35, 0.8),
                color: RAINBOW_COLORS[index % RAINBOW_COLORS.length],
                shape: PARTICLE_STAR,
                spin: randomBetween(-9, 9),
            });
        }
    }

    render() {
        const context = canvasContext;
        const y = this.y + this.bobOffset;
        const colorIndex = (this.age * 4) | 0;

        drawRadialGlow(context, this.x, y, 26, RAINBOW_COLORS[colorIndex % RAINBOW_COLORS.length], 0.4);

        context.fillStyle = '#fff';
        drawFourPointStar(context, this.x, y, 11, this.age * 1.4);

        context.fillStyle = RAINBOW_COLORS[colorIndex % RAINBOW_COLORS.length];
        drawFourPointStar(context, this.x, y, 7, this.age * 1.4);
    }
}

/**
 * The level exit. Shut and grey while any Gloom remains, then it blooms open
 * and the unicorn only has to run through it.
 */
export class RainbowGate extends Entity {
    categories = ['gate'];
    layer = LAYER_PICKUP;

    halfWidth = 26;
    halfHeight = 40;

    /** 0..1, eased so the gate opens with a flourish rather than a snap. */
    openness = 0;
    isEntered = false;

    constructor(x, y) {
        super();
        this.x = x;
        this.y = y;
    }

    get isOpen() {
        return this.world.entitiesOfCategory('gloom').length === 0;
    }

    update(elapsedSeconds) {
        super.update(elapsedSeconds);

        this.openness = clamp(this.openness + (this.isOpen ? elapsedSeconds * 1.6 : -elapsedSeconds * 4), 0, 1);

        if (this.openness < 0.6 || this.isEntered) return;

        const unicorn = this.world.firstOfCategory('unicorn');
        if (unicorn && !unicorn.isDead && boxesOverlap(this, unicorn)) {
            this.isEntered = true;
            unicorn.onGateEntered?.();
        }
    }

    render() {
        const context = canvasContext;
        context.translate(this.x, this.y);

        const open = this.openness;

        if (open > 0.02) {
            drawRadialGlow(context, 0, 0, 90 * open, RAINBOW_COLORS[(this.age * 5 | 0) % 7], open * 0.5);
        }

        // A stack of rainbow arches, each one springing up as the gate opens.
        context.lineCap = 'round';
        for (let index = 0; index < RAINBOW_COLORS.length; index++) {
            const bandProgress = clamp(open * RAINBOW_COLORS.length - index, 0, 1);
            const radius = this.halfWidth - index * 3.2;

            context.strokeStyle = open > 0.02 ? RAINBOW_COLORS[index] : palette.gloomRim;
            context.globalAlpha = open > 0.02 ? 1 : 0.5;
            context.lineWidth = 3.4 * (0.4 + bandProgress * 0.6);

            context.beginPath();
            context.arc(0, this.halfHeight - radius, radius, TAU / 2, TAU);
            context.stroke();
        }

        context.globalAlpha = 1;

        // Sparkles rising through an open gate.
        if (open > 0.5) {
            for (let index = 0; index < 5; index++) {
                const phase = (this.age * 0.6 + index / 5) % 1;
                context.fillStyle = RAINBOW_COLORS[index % RAINBOW_COLORS.length];
                context.globalAlpha = (1 - phase) * open;
                drawFourPointStar(
                    context,
                    sin(index * 2.7 + this.age) * this.halfWidth * 0.6,
                    this.halfHeight - phase * this.halfHeight * 1.8,
                    3 + phase * 3,
                    this.age * 2,
                );
            }
            context.globalAlpha = 1;
        }
    }
}
