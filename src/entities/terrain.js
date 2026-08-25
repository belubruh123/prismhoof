/**
 * The static level geometry: a grid of tiles that things collide against.
 *
 * Collision resolves one axis at a time using the actual movement delta rather
 * than the smaller penetration depth, which is what stops a fast-moving unicorn
 * from being ejected sideways out of a floor it merely landed on.
 *
 * Rendering does not pre-bake to an offscreen canvas, because the palette shifts
 * continuously as the Gloom is purified and a baked image would go stale. Instead
 * the grid is reduced once to merged horizontal runs and a single Path2D, so a
 * frame costs a handful of fills regardless of how many tiles the level has.
 *
 * With levels this size that is already few enough that culling the runs against
 * the view cost more bytes than the frames it saved, so nothing here is culled.
 */

import { LAYER_TERRAIN, TILE_SIZE } from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { createSeededRandom, floor, sin } from '../core/math.js';
import { Entity } from '../engine/entity.js';
import { palette } from '../graphics/palette.js';

export const TILE_EMPTY = 0;
export const TILE_SOLID = 1;
/** One-way: you land on it from above and jump up straight through it. */
export const TILE_PLATFORM = 2;

/** Pulls the collision box in slightly so a flush wall does not count as a floor. */
const COLLISION_INSET = 0.5;

const GRASS_CAP_HEIGHT = 9;
/**
 * Lit soil under the turf, before the rock below it.
 *
 * The camera sits close enough now that the ground fills a third of the screen,
 * and one flat fill across all of it reads as a hole in the artwork. Two tones
 * with a hard line between them is the cheapest thing that reads as depth -
 * the same trick the clouds use for their undersides.
 */
const SOIL_DEPTH = 22;

/**
 * The lake the chamber is suspended over. Its surface sits a little below the
 * level's own floor, so a gap in the ground is a hole straight down into it.
 *
 * Lava keeps its own colours rather than taking them from the palette. Everything
 * else in the world drains towards grey while the Gloom holds it; the one thing
 * that will kill you on contact has to read at a glance from the first frame of a
 * level to the last.
 */
export const LAVA_SURFACE_DEPTH = 24;
const LAVA_DEEP = '#8c1c10';
const LAVA_BRIGHT = '#ff6a24';
const LAVA_GLOW = '#ffc247';

export class Terrain extends Entity {
    categories = ['terrain'];
    layer = LAYER_TERRAIN;

    constructor(tileGrid) {
        super();
        this.tileGrid = tileGrid;
        this.rowTotal = tileGrid.length;
        this.columnTotal = tileGrid[0].length;

        this.buildRenderGeometry();
    }

    get widthInPixels() { return this.columnTotal * TILE_SIZE; }
    get heightInPixels() { return this.rowTotal * TILE_SIZE; }

    // --- grid queries -------------------------------------------------------

    columnAt(worldX) { return floor(worldX / TILE_SIZE); }
    rowAt(worldY) { return floor(worldY / TILE_SIZE); }

    tileAt(column, row) {
        // The left and right edges of a level are walls, so nothing can walk out
        // of the world sideways. Above and below stay open: the sky is where the
        // rainbows go, and falling out of the bottom is meant to be fatal.
        if (column < 0 || column >= this.columnTotal) return TILE_SOLID;
        if (row < 0 || row >= this.rowTotal) return TILE_EMPTY;
        return this.tileGrid[row][column];
    }

    isSolidAtWorld(worldX, worldY) {
        return this.tileAt(this.columnAt(worldX), this.rowAt(worldY)) === TILE_SOLID;
    }

    /** True if there is solid ground just below this point. Used for ledge-aware AI. */
    hasGroundBelow(worldX, worldY) {
        return this.tileAt(this.columnAt(worldX), this.rowAt(worldY + 2)) !== TILE_EMPTY;
    }

    // --- collision ----------------------------------------------------------

    /**
     * Moves an entity by the given delta, resolving against the grid on each axis.
     * Sets `isOnGround` and `wallDirection` on the entity.
     */
    moveWithCollision(entity, deltaX, deltaY) {
        entity.isOnGround = false;
        entity.wallDirection = 0;

        entity.x += deltaX;
        this.resolveHorizontal(entity, deltaX);

        const bottomBeforeMove = entity.y + entity.halfHeight;
        entity.y += deltaY;
        this.resolveVertical(entity, deltaY, bottomBeforeMove);
    }

    resolveHorizontal(entity, deltaX) {
        if (!deltaX) return;

        const firstRow = this.rowAt(entity.y - entity.halfHeight + COLLISION_INSET);
        const lastRow = this.rowAt(entity.y + entity.halfHeight - COLLISION_INSET);

        if (deltaX > 0) {
            const column = this.columnAt(entity.x + entity.halfWidth);
            for (let row = firstRow; row <= lastRow; row++) {
                if (this.tileAt(column, row) !== TILE_SOLID) continue;
                entity.x = column * TILE_SIZE - entity.halfWidth;
                entity.velocityAcross = 0;
                entity.wallDirection = 1;
                return;
            }
        } else {
            const column = this.columnAt(entity.x - entity.halfWidth);
            for (let row = firstRow; row <= lastRow; row++) {
                if (this.tileAt(column, row) !== TILE_SOLID) continue;
                entity.x = (column + 1) * TILE_SIZE + entity.halfWidth;
                entity.velocityAcross = 0;
                entity.wallDirection = -1;
                return;
            }
        }
    }

    resolveVertical(entity, deltaY, bottomBeforeMove) {
        if (!deltaY) return;

        const firstColumn = this.columnAt(entity.x - entity.halfWidth + COLLISION_INSET);
        const lastColumn = this.columnAt(entity.x + entity.halfWidth - COLLISION_INSET);

        if (deltaY > 0) {
            const row = this.rowAt(entity.y + entity.halfHeight);
            const surfaceY = row * TILE_SIZE;

            for (let column = firstColumn; column <= lastColumn; column++) {
                const tile = this.tileAt(column, row);
                if (tile === TILE_EMPTY) continue;

                // A one-way platform only stops you if you were already above it
                // and are not deliberately dropping through.
                if (tile === TILE_PLATFORM
                    && (bottomBeforeMove > surfaceY + 1 || entity.wantsToDropThrough)) continue;

                entity.y = surfaceY - entity.halfHeight;
                entity.velocityDown = 0;
                entity.isOnGround = true;
                return;
            }
        } else {
            const row = this.rowAt(entity.y - entity.halfHeight);
            for (let column = firstColumn; column <= lastColumn; column++) {
                if (this.tileAt(column, row) !== TILE_SOLID) continue;
                entity.y = (row + 1) * TILE_SIZE + entity.halfHeight;
                entity.velocityDown = 0;
                return;
            }
        }
    }

    // --- render geometry ----------------------------------------------------

    /**
     * Collapses the grid into merged horizontal runs, once, at construction.
     * `solidPath` doubles as the fill shape and as the clip for the texture pass.
     */
    buildRenderGeometry() {
        this.solidPath = new Path2D();
        this.surfaceRuns = [];
        this.platformRuns = [];

        for (let row = 0; row < this.rowTotal; row++) {
            const top = row * TILE_SIZE;

            this.collectRuns(
                row,
                (column) => this.tileAt(column, row) === TILE_SOLID,
                (x, runWidth) => this.solidPath.rect(x, top, runWidth, TILE_SIZE),
            );

            // A surface is a solid tile with open sky directly above it.
            this.collectRuns(
                row,
                (column) => this.tileAt(column, row) === TILE_SOLID && !this.tileAt(column, row - 1),
                (x, runWidth) => this.surfaceRuns.push({ x, y: top, runWidth }),
            );

            this.collectRuns(
                row,
                (column) => this.tileAt(column, row) === TILE_PLATFORM,
                (x, runWidth) => this.platformRuns.push({ x, y: top, runWidth }),
            );
        }

        this.buildGrassBlades();
    }

    /** Scans one row and reports every maximal run of matching tiles, in pixels. */
    collectRuns(row, matches, emit) {
        let runStart = -1;

        for (let column = 0; column <= this.columnTotal; column++) {
            if (column < this.columnTotal && matches(column)) {
                if (runStart < 0) runStart = column;
            } else if (runStart >= 0) {
                emit(runStart * TILE_SIZE, (column - runStart) * TILE_SIZE);
                runStart = -1;
            }
        }
    }

    /**
     * Individual blades along every surface, baked into two paths per run: a
     * taller darker layer behind a shorter lighter one.
     *
     * They are real geometry rather than a texture because a white pattern
     * cannot be tinted, and these have to follow the palette as the colour
     * returns to the world. Building them per run keeps them cullable.
     */
    buildGrassBlades() {
        const random = createSeededRandom(4421);

        for (const run of this.surfaceRuns) {
            run.backBlades = new Path2D();
            run.frontBlades = new Path2D();

            for (let x = run.x + 3; x < run.x + run.runWidth; x += 6) {
                const isBack = random() < 0.5;
                addBladeToPath(
                    isBack ? run.backBlades : run.frontBlades,
                    x + random() * 3,
                    run.y + 3,
                    random() * 6 + (isBack ? 8 : 4),
                    (random() - 0.5) * 9,
                    random() * 0.7 + 1.1,
                );
            }
        }
    }

    // --- render -------------------------------------------------------------

    render() {
        const context = canvasContext;

        this.renderSurroundingRock(context);
        this.renderLava(context);

        // The rock a chamber is cut out of, inside its floor and outside its
        // walls alike, is all one dark mass. Only the lit soil and the turf on
        // top of it - added by renderSurfaces below - say which parts of it you
        // are allowed to stand on.
        context.fillStyle = palette.terrainShade;
        context.fill(this.solidPath);

        this.renderSurfaces(context);
        this.renderPlatforms(context);
    }

    /**
     * Everything outside the level is solid rock.
     *
     * A level is a chamber cut out of a world, not a handful of islands adrift
     * in an open sky - the sky is what you can see *through* the chamber. Four
     * rectangles and a lit lip are most of what makes the edge of a level look
     * deliberate instead of like the end of the data.
     */
    renderSurroundingRock(context) {
        const width = this.widthInPixels;
        const height = this.heightInPixels;
        const reach = 2200;

        // A slab with the chamber punched out of it, rather than three separate
        // rectangles fitted around it - one path, one fill, and no arithmetic to
        // get wrong at the corners. It stops at the level's floor, because below
        // that is lava and the camera never looks past it.
        context.fillStyle = palette.terrainShade;
        context.beginPath();
        context.rect(-reach, -reach, width + reach * 2, height + reach);
        context.rect(0, 0, width, height);
        context.fill('evenodd');

        context.strokeStyle = palette.terrainGrassLight;
        context.lineWidth = 5;
        context.strokeRect(0, 0, width, height);
    }

    /**
     * The lava, with a surface that rolls. Two offset waves rather than one, so
     * the crest never repeats on a beat you can count.
     */
    renderLava(context) {
        const width = this.widthInPixels;
        const top = this.heightInPixels + LAVA_SURFACE_DEPTH;
        const reach = 2200;

        context.fillStyle = LAVA_DEEP;
        context.fillRect(-reach, top, width + reach * 2, reach);

        for (const [inkColor, height, phase] of [[LAVA_BRIGHT, 12, 0], [LAVA_GLOW, 4, 1.7]]) {
            context.fillStyle = inkColor;
            context.beginPath();
            context.moveTo(-reach, top + height * 3);

            for (let x = -reach; x <= width + reach; x += 30) {
                const wave = sin(x * 0.012 + this.age * 1.9 + phase) + sin(x * 0.031 - this.age * 1.3);
                context.lineTo(x, top + wave * 5 - height / 2);
            }

            context.lineTo(width + reach, top + height * 3);
            context.fill();
        }
    }


    /** The grass cap: blades behind, a band of colour, then a bright lit rim. */
    renderSurfaces(context) {
        for (const run of this.surfaceRuns) {
            context.fillStyle = palette.terrainGrass;
            context.fill(run.backBlades);
            context.fillRect(run.x, run.y, run.runWidth, GRASS_CAP_HEIGHT);

            context.fillStyle = palette.terrainBody;
            context.fillRect(run.x, run.y + GRASS_CAP_HEIGHT, run.runWidth, SOIL_DEPTH);

            context.fillStyle = palette.terrainGrassLight;
            context.fill(run.frontBlades);
            context.fillRect(run.x, run.y, run.runWidth, 2.5);
        }
    }

    renderPlatforms(context) {
        for (const run of this.platformRuns) {
            const height = TILE_SIZE / 3;

            context.fillStyle = palette.terrainBody;
            context.beginPath();
            context.roundRect(run.x, run.y, run.runWidth, height, height / 2);
            context.fill();

            context.fillStyle = palette.terrainGrassLight;
            context.beginPath();
            context.roundRect(run.x, run.y, run.runWidth, 3, 1.5);
            context.fill();
        }
    }
}

/** One tapered blade of grass, curving away from vertical by `bend`. */
function addBladeToPath(path, x, baseY, height, bend, halfWidth) {
    path.moveTo(x - halfWidth, baseY);
    path.quadraticCurveTo(x + bend * 0.35, baseY - height * 0.65, x + bend, baseY - height);
    path.lineTo(x + halfWidth, baseY);
}
