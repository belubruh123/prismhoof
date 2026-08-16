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
import { createSeededRandom, floor } from '../core/math.js';
import { Entity } from '../engine/entity.js';
import { TERRAIN_GRASS, palette, restoredColor } from '../graphics/palette.js';

export const TILE_EMPTY = 0;
export const TILE_SOLID = 1;
/** One-way: you land on it from above and jump up straight through it. */
export const TILE_PLATFORM = 2;

/** Pulls the collision box in slightly so a flush wall does not count as a floor. */
const COLLISION_INSET = 0.5;

/** How deep the lit-to-dark gradient under a surface reaches. */
const DEPTH_SHADE_HEIGHT = 96;
const GRASS_CAP_HEIGHT = 9;

export class Terrain extends Entity {
    categories = ['terrain'];
    layer = LAYER_TERRAIN;

    constructor(tileGrid) {
        super();
        this.tileGrid = tileGrid;
        this.rowCount = tileGrid.length;
        this.columnCount = tileGrid[0].length;

        this.buildRenderGeometry();
    }

    get widthInPixels() { return this.columnCount * TILE_SIZE; }
    get heightInPixels() { return this.rowCount * TILE_SIZE; }

    // --- grid queries -------------------------------------------------------

    columnAt(worldX) { return floor(worldX / TILE_SIZE); }
    rowAt(worldY) { return floor(worldY / TILE_SIZE); }

    tileAt(column, row) {
        // The left and right edges of a level are walls, so nothing can walk out
        // of the world sideways. Above and below stay open: the sky is where the
        // rainbows go, and falling out of the bottom is meant to be fatal.
        if (column < 0 || column >= this.columnCount) return TILE_SOLID;
        if (row < 0 || row >= this.rowCount) return TILE_EMPTY;
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
                entity.velocityX = 0;
                entity.wallDirection = 1;
                return;
            }
        } else {
            const column = this.columnAt(entity.x - entity.halfWidth);
            for (let row = firstRow; row <= lastRow; row++) {
                if (this.tileAt(column, row) !== TILE_SOLID) continue;
                entity.x = (column + 1) * TILE_SIZE + entity.halfWidth;
                entity.velocityX = 0;
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
                entity.velocityY = 0;
                entity.isOnGround = true;
                return;
            }
        } else {
            const row = this.rowAt(entity.y - entity.halfHeight);
            for (let column = firstColumn; column <= lastColumn; column++) {
                if (this.tileAt(column, row) !== TILE_SOLID) continue;
                entity.y = (row + 1) * TILE_SIZE + entity.halfHeight;
                entity.velocityY = 0;
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

        for (let row = 0; row < this.rowCount; row++) {
            const top = row * TILE_SIZE;

            this.collectRuns(
                row,
                (column) => this.tileAt(column, row) === TILE_SOLID,
                (x, width) => this.solidPath.rect(x, top, width, TILE_SIZE),
            );

            // A surface is a solid tile with open sky directly above it.
            this.collectRuns(
                row,
                (column) => this.tileAt(column, row) === TILE_SOLID && !this.tileAt(column, row - 1),
                (x, width) => this.surfaceRuns.push({ x, y: top, width }),
            );

            this.collectRuns(
                row,
                (column) => this.tileAt(column, row) === TILE_PLATFORM,
                (x, width) => this.platformRuns.push({ x, y: top, width }),
            );
        }

        this.buildGrassBlades();
    }

    /** Scans one row and reports every maximal run of matching tiles, in pixels. */
    collectRuns(row, matches, emit) {
        let runStart = -1;

        for (let column = 0; column <= this.columnCount; column++) {
            if (column < this.columnCount && matches(column)) {
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

            for (let x = run.x + 3; x < run.x + run.width; x += 6) {
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

        context.fillStyle = palette.terrainBody;
        context.fill(this.solidPath);

        context.save();
        context.clip(this.solidPath);
        this.renderDepthShading(context);
        context.restore();

        this.renderSurfaces(context);
        this.renderPlatforms(context);
    }

    /** A lit band just under each surface fading into the dark interior. */
    renderDepthShading(context) {
        const gradient = context.createLinearGradient(0, 0, 0, DEPTH_SHADE_HEIGHT);
        gradient.addColorStop(0, restoredColor(TERRAIN_GRASS, 0.28));
        gradient.addColorStop(0.25, 'transparent');
        gradient.addColorStop(1, palette.terrainShade);

        for (const run of this.surfaceRuns) {
            context.save();
            context.translate(run.x, run.y);
            context.fillStyle = gradient;
            context.fillRect(0, 0, run.width, DEPTH_SHADE_HEIGHT);
            context.restore();
        }
    }

    /** The grass cap: blades behind, a band of colour, then a bright lit rim. */
    renderSurfaces(context) {
        for (const run of this.surfaceRuns) {
            context.fillStyle = palette.terrainGrass;
            context.fill(run.backBlades);
            context.fillRect(run.x, run.y, run.width, GRASS_CAP_HEIGHT);

            context.fillStyle = palette.terrainGrassLight;
            context.fill(run.frontBlades);
            context.fillRect(run.x, run.y, run.width, 2.5);
        }
    }

    renderPlatforms(context) {
        for (const run of this.platformRuns) {
            const height = TILE_SIZE / 3;

            context.fillStyle = palette.terrainBody;
            context.beginPath();
            context.roundRect(run.x, run.y, run.width, height, height / 2);
            context.fill();

            context.fillStyle = palette.terrainGrassLight;
            context.beginPath();
            context.roundRect(run.x, run.y, run.width, 3, 1.5);
            context.fill();
        }
    }
}

/** One tapered blade of grass, curving away from vertical by `bend`. */
function addBladeToPath(path, x, baseY, height, bend, halfWidth) {
    path.moveTo(x - halfWidth, baseY);
    path.quadraticCurveTo(x + bend * 0.35, baseY - height * 0.65, x + bend, baseY - height);
    path.quadraticCurveTo(x + bend * 0.15, baseY - height * 0.5, x + halfWidth, baseY);
    path.closePath();
}
