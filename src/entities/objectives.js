/**
 * The furniture a level is built out of: the gate that ends it, and the signs
 * that stand along the way.
 */

import { playGateSound } from '../audio/sfx.js';
import { LAYER_PICKUP } from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { clamp, sin, TAU } from '../core/math.js';
import { boxesOverlap } from '../core/rect.js';
import { Entity } from '../engine/entity.js';
import { palette, RAINBOW_COLORS } from '../graphics/palette.js';
import { drawRadialGlow } from '../graphics/textures.js';
import { drawText } from '../graphics/typography.js';
import { TEXT_BRIGHT } from '../graphics/ui.js';

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

    updateStep(elapsedSeconds) {
        super.updateStep(elapsedSeconds);

        this.openness = clamp(this.openness + (this.isOpen ? elapsedSeconds * 1.6 : -elapsedSeconds * 4), 0, 1);

        if (this.openness < 0.6 || this.isEntered) return;

        const unicorn = this.world.firstOfCategory('unicorn');
        if (unicorn && !unicorn.isDead && boxesOverlap(this, unicorn)) {
            this.isEntered = true;
            playGateSound();
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
    }
}

/**
 * A line of text standing in the level itself.
 *
 * The game teaches itself where the player is already looking rather than in a
 * banner across the top of the screen. The picture in `levels.js` says where
 * each sign stands and the level's `signs` list says what it reads, in the
 * order they are walked past.
 */
export class LevelSign extends Entity {
    categories = ['sign'];
    layer = LAYER_PICKUP;

    constructor(x, y, text) {
        super();
        this.x = x;
        this.y = y;
        this.text = text;
    }

    render() {
        const y = this.y + sin(this.age * 1.5) * 3;
        const width = drawText(this.text, this.x, y, {
            typeSize: 21,
            typeWeight: 800,
            typeSpacing: 1.6,
            inkColor: TEXT_BRIGHT,
        });

        // A rainbow rule the width of the line. It costs almost nothing and it
        // is what stops the words reading as HUD that drifted into the world.
        const bandWidth = width / RAINBOW_COLORS.length;
        RAINBOW_COLORS.forEach((inkColor, index) => {
            canvasContext.fillStyle = inkColor;
            canvasContext.fillRect(this.x - width / 2 + index * bandWidth, y + 16, bandWidth + 1, 3);
        });
    }
}
