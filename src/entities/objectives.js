/**
 * The furniture a level is built out of: the gate that ends it, and the signs
 * that stand along the way.
 */

import { playGateSound } from '../audio/sfx.js';
import { LAYER_PICKUP } from '../config.js';
import { canvasContext, wrap } from '../core/canvas.js';
import { clamp, sin, TAU } from '../core/math.js';
import { boxesOverlap } from '../core/rect.js';
import { Entity } from '../engine/entity.js';
import { burstRainbow } from '../engine/particles.js';
import { HORN_COLOR, INK_BLACK, palette, RAINBOW_COLORS } from '../graphics/palette.js';
import { drawText } from '../graphics/typography.js';
import { TEXT_BRIGHT } from '../graphics/ui.js';

/**
 * How tall the arch stands above the floor it is planted on, and how far below
 * the gate's own centre that floor is. A gate spawns on the centre of its tile,
 * and the tile's floor is half a tile further down.
 */
const GATE_HEIGHT = 76;
const GATE_FOOT_DROP = 20;


/**
 * The level exit: a standing archway with a rainbow behind it.
 *
 * This is the one thing in a chamber the player is trying to reach, so it is
 * built to be read from across the level and out of the corner of an eye. Two
 * posts on the floor carrying an arch, a hole punched through the world between
 * them, and a keystone over the top - the shape of a doorway, at a size no other
 * object in the game comes near, so it never has to compete for attention.
 *
 * Shut, the whole thing is dead grey stone and the doorway is black: it reads as
 * masonry, not as a target. When the last Gloom goes, the hole fills from the
 * floor upwards with rainbow. A rising line says "go" at any size, which a door
 * swinging open does not - and the keystone lights at the same moment, so the
 * change is legible even when the gate is a thumbnail at the far end of a level.
 */
export class RainbowGate extends Entity {
    categories = ['gate'];
    layer = LAYER_PICKUP;

    /** The collision box the unicorn has to run into. The drawing is bigger. */
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

    updateStep(elapsedSeconds) {
        super.updateStep(elapsedSeconds);

        const isOpen = !this.world.entitiesOfCategory('gloom').length;

        // The instant the last Gloom goes, the gate announces itself. A player
        // three screens away needs to know the level just changed shape, and a
        // kick plus a plume carries across a chamber where a colour change does
        // not. The purify chime is already sounding on this exact frame, so this
        // deliberately stays silent rather than talking over it.
        if (isOpen && !this.openness) {
            this.world.camera.shake(9, 0.45);
            burstRainbow(this.world.firstOfCategory('particles'), this.x, this.y, 24, {
                speed: 300,
                // Upwards: the plume rises out of the arch instead of falling
                // out of it, which is the same "go" the curtain is drawing.
                gravity: -90,
                lifetime: 1.5,
            });
        }

        this.openness = clamp(this.openness + (isOpen ? elapsedSeconds * 1.6 : -elapsedSeconds * 4), 0, 1);

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
        const open = this.openness;
        const isLit = open > 0.02;
        const halfWidth = this.halfWidth;

        // The gate stands on the floor of its tile, which is twenty units below
        // the spawn point, so everything below is measured up from there.
        context.translate(this.x, this.y + GATE_FOOT_DROP);

        // Where the arch springs from the posts, and so where the posts stop.
        const springY = halfWidth - GATE_HEIGHT;

        // The doorway: a round-topped hole punched clean through the world.
        context.beginPath();
        context.moveTo(-halfWidth, 0);
        context.lineTo(-halfWidth, springY);
        context.arc(0, springY, halfWidth, TAU / 2, 0);
        context.lineTo(halfWidth, 0);
        context.closePath();

        context.fillStyle = INK_BLACK;
        context.fill();

        // The curtain, clipped to the doorway: seven bands climbing out of the
        // floor a beat behind one another, with a rippling top edge so it reads
        // as liquid light rather than as a progress bar filling up.
        wrap(() => {
            context.clip();

            const bandWidth = halfWidth * 2 / RAINBOW_COLORS.length;
            RAINBOW_COLORS.forEach((inkColor, index) => {
                const rise = clamp(open * 2.4 - index * 0.2, 0, 1) * (GATE_HEIGHT + 12);
                context.fillStyle = inkColor;
                context.fillRect(
                    -halfWidth + index * bandWidth,
                    -rise + sin(this.age * 5 + index * 0.9) * 4,
                    bandWidth + 1,
                    rise + 20,
                );
            });
        });

        // Two posts standing on the floor, as wide as the arch they carry...
        //
        // Open, the masonry is the colour of the unicorn's own horn, which ties
        // the gate to the thing that opens it and - unlike the grass green it
        // borrowed at first - does not fight the rainbow standing inside it. Shut,
        // it is the same dead violet the Gloom is made of. Neither colour comes
        // from the palette: like the lava, the gate has to read identically in a
        // fully drained chamber and a fully restored one.
        const stone = isLit ? HORN_COLOR : palette.gloomRim;
        context.fillStyle = stone;
        for (const side of [-1, 1]) {
            context.fillRect(side * halfWidth, springY, side * 9, -springY);
        }

        // ...carrying an arch over the top, struck as one thick round stroke.
        context.strokeStyle = stone;
        context.lineWidth = 9;
        context.beginPath();
        context.arc(0, springY, halfWidth + 4.5, TAU / 2, 0);
        context.stroke();

        // The keystone. Dead grey while any Gloom is left, walking the rainbow
        // once the way is open: the smallest piece on the gate and the one that
        // carries the whole message.
        context.fillStyle = isLit ? RAINBOW_COLORS[(this.age * 5 | 0) % 7] : palette.gloomBody;
        context.beginPath();
        context.moveTo(0, -GATE_HEIGHT - 18);
        context.lineTo(10, -GATE_HEIGHT - 5);
        context.lineTo(0, -GATE_HEIGHT + 7);
        context.lineTo(-10, -GATE_HEIGHT - 5);
        context.fill();
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
        this.signText = text;
    }

    render() {
        const y = this.y + sin(this.age * 1.5) * 3;
        // Sized for the chase camera. The view is zoomed in far enough that the
        // old size ran two thirds of the way across the screen and got clipped
        // by the edge of the frame before it could be read.
        const width = drawText(this.signText, this.x, y, {
            typeSize: 15,
            typeWeight: 800,
            typeSpacing: 1.6,
            inkColor: TEXT_BRIGHT,
        });

        // A rainbow rule the width of the line. It costs almost nothing and it
        // is what stops the words reading as HUD that drifted into the world.
        const bandWidth = width / RAINBOW_COLORS.length;
        RAINBOW_COLORS.forEach((inkColor, index) => {
            canvasContext.fillStyle = inkColor;
            canvasContext.fillRect(this.x - width / 2 + index * bandWidth, y + 12, bandWidth + 1, 2.5);
        });
    }
}
