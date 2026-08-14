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
 */

import { LAYER_TERRAIN, TILE_SIZE } from '../config.js';
import { canvasContext } from '../core/canvas.js';
import { createSeededRandom, floor, max, min } from '../core/math.js';
import { Entity } from '../engine/entity.js';
import { TERRAIN_GRASS, palette, restoredColor } from '../graphics/palette.js';
import { grainTexture } from '../graphics/textures.js';

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
        if (row < 0 || row >= this.rowCount || column < 0 || column >= this.columnCount) return TILE_EMPTY;
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
     * Sets `isOnGround`, `touchedCeiling` and `wallDirection` on the entity.
     */
    moveWithCollision(entity, deltaX, deltaY) {
        entity.isOnGround = false;
        entity.touchedCeiling = false;
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
                entity.touchedCeiling = true;
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
            let solidRunStart = -1;
            let surfaceRunStart = -1;
            let platformRunStart = -1;

            for (let column = 0; column <= this.columnCount; column++) {
                const tile = this.tileAt(column, row);

                const isSolid = tile === TILE_SOLID;
                if (isSolid && solidRunStart < 0) solidRunStart = column;
                if (!isSolid && solidRunStart >= 0) {
                    this.solidPath.rect(
                        solidRunStart * TILE_SIZE, row * TILE_SIZE,
                        (column - solidRunStart) * TILE_SIZE, TILE_SIZE,
                    );
                    solidRunStart = -1;
                }

                // A surface is a solid tile with open sky directly above it.
                const isSurface = isSolid && this.tileAt(column, row - 1) === TILE_EMPTY;
                if (isSurface && surfaceRunStart < 0) surfaceRunStart = column;
                if (!isSurface && surfaceRunStart >= 0) {
                    this.surfaceRuns.push({
                        x: surfaceRunStart * TILE_SIZE,
                        y: row * TILE_SIZE,
                        width: (column - surfaceRunStart) * TILE_SIZE,
                    });
                    surfaceRunStart = -1;
                }

                const isPlatform = tile === TILE_PLATFORM;
                if (isPlatform && platformRunStart < 0) platformRunStart = column;
                if (!isPlatform && platformRunStart >= 0) {
                    this.platformRuns.push({
                        x: platformRunStart * TILE_SIZE,
                        y: row * TILE_SIZE,
                        width: (column - platformRunStart) * TILE_SIZE,
                    });
                    platformRunStart = -1;
                }
            }
        }

        this.buildGrassBlades();
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
        const camera = this.world.camera;

        context.fillStyle = palette.terrainBody;
        context.fill(this.solidPath);

        context.save();
        context.clip(this.solidPath);
        this.renderDepthShading(context, camera);
        this.renderGrain(context, camera);
        context.restore();

        this.renderSurfaces(context, camera);
        this.renderPlatforms(context, camera);
    }

    /** A lit band just under each surface fading into the dark interior. */
    renderDepthShading(context, camera) {
        const gradient = context.createLinearGradient(0, 0, 0, DEPTH_SHADE_HEIGHT);
        gradient.addColorStop(0, restoredColor(TERRAIN_GRASS, 0.28));
        gradient.addColorStop(0.25, 'transparent');
        gradient.addColorStop(1, palette.terrainShade);

        for (const run of this.surfaceRuns) {
            if (!this.isRunVisible(run, camera)) continue;
            context.save();
            context.translate(run.x, run.y);
            context.fillStyle = gradient;
            context.fillRect(0, 0, run.width, DEPTH_SHADE_HEIGHT);
            context.restore();
        }
    }

    renderGrain(context, camera) {
        const left = max(0, camera.viewLeft);
        const top = max(0, camera.viewTop);
        const right = min(this.widthInPixels, camera.viewRight);
        const bottom = min(this.heightInPixels, camera.viewBottom);

        context.globalAlpha = 0.07;
        context.fillStyle = grainTexture;
        context.fillRect(left, top, right - left, bottom - top);
        context.globalAlpha = 1;
    }

    /** The grass cap: blades behind, a band of colour, then a bright lit rim. */
    renderSurfaces(context, camera) {
        for (const run of this.surfaceRuns) {
            if (!this.isRunVisible(run, camera)) continue;

            context.fillStyle = palette.terrainGrass;
            context.fill(run.backBlades);
            context.fillRect(run.x, run.y, run.width, GRASS_CAP_HEIGHT);

            context.fillStyle = palette.terrainGrassLight;
            context.fill(run.frontBlades);
            context.fillRect(run.x, run.y, run.width, 2.5);
        }
    }

    renderPlatforms(context, camera) {
        for (const run of this.platformRuns) {
            if (!this.isRunVisible(run, camera)) continue;

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

    isRunVisible(run, camera) {
        return run.x + run.width > camera.viewLeft - TILE_SIZE
            && run.x < camera.viewRight + TILE_SIZE
            && run.y + DEPTH_SHADE_HEIGHT > camera.viewTop
            && run.y - 40 < camera.viewBottom;
    }
}

/** One tapered blade of grass, curving away from vertical by `bend`. */
function addBladeToPath(path, x, baseY, height, bend, halfWidth) {
    path.moveTo(x - halfWidth, baseY);
    path.quadraticCurveTo(x + bend * 0.35, baseY - height * 0.65, x + bend, baseY - height);
    path.quadraticCurveTo(x + bend * 0.15, baseY - height * 0.5, x + halfWidth, baseY);
    path.closePath();
}
