/**
 * A World owns the entities of one level and drives their update and render.
 *
 * Entities are indexed by category so systems can find each other cheaply
 * (`world.entitiesOfCategory('gloom')`) without scanning the whole list.
 */

import { canvasContext, wrap } from '../core/canvas.js';
import { Camera } from './camera.js';

const NO_ENTITIES = [];

export class World {
    entities = [];
    entitiesByCategory = {};

    camera = new Camera();

    /**
     * Seconds the whole simulation is held still for. Purifying a Gloom sets
     * it; see `updateStep` for why a freeze is worth the bytes.
     */
    hitStopSeconds = 0;

    /** Level bounds in world units, used to clamp the camera and kill anything that falls out. */
    boundsLeft = 0;
    boundsTop = 0;
    boundsRight = 0;
    boundsBottom = 0;

    addEntity(entity) {
        entity.world = this;
        this.entities.push(entity);

        for (const category of entity.categories) {
            (this.entitiesByCategory[category] ||= []).push(entity);
        }

        return entity;
    }

    removeEntity(entity) {
        if (entity.isRemoved) return;
        entity.isRemoved = true;

        const index = this.entities.indexOf(entity);
        if (index >= 0) this.entities.splice(index, 1);

        for (const category of entity.categories) {
            const list = this.entitiesByCategory[category];
            const categoryIndex = list.indexOf(entity);
            if (categoryIndex >= 0) list.splice(categoryIndex, 1);
        }
    }

    entitiesOfCategory(category) {
        return this.entitiesByCategory[category] || NO_ENTITIES;
    }

    firstOfCategory(category) {
        return this.entitiesOfCategory(category)[0];
    }

    updateStep(elapsedSeconds) {
        // Hit stop. For a few frames after something is purified the world does
        // not advance at all, while the camera keeps shaking over the frozen
        // picture. It is the oldest trick there is for making a hit land, and it
        // is what turns the burst from confetti appearing in an indifferent
        // world into something the world visibly felt. Nothing is skipped here,
        // only delayed - every entity resumes on the exact frame it left off.
        if (this.hitStopSeconds > 0) {
            this.hitStopSeconds -= elapsedSeconds;
            this.camera.updateStep(elapsedSeconds, this);
            return;
        }

        // A copy, because entities routinely add or remove entities while updating.
        for (const entity of this.entities.slice()) {
            if (!entity.isRemoved) entity.updateStep(elapsedSeconds);
        }
        this.camera.updateStep(elapsedSeconds, this);
    }

    /** Draws every entity in camera space. Screen-space layers are the caller's job. */
    render() {
        this.entities.sort((first, second) => first.layer - second.layer);

        wrap(() => {
            this.camera.applyTransform(canvasContext);

            for (const entity of this.entities) wrap(() => entity.render());

            if (DEBUG) {
                for (const entity of this.entities) wrap(() => entity.renderDebug());
            }
        });
    }
}
