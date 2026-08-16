/**
 * Turns a parsed level into a populated World.
 *
 * This is the one place that knows how a spawn letter becomes an entity, which
 * keeps both the level format and the gameplay screen ignorant of the cast.
 */

import { TILE_SIZE } from '../config.js';
import { GloomMurk, GloomWisp } from '../entities/gloom.js';
import { LevelSign, RainbowGate } from '../entities/objectives.js';
import { Terrain } from '../entities/terrain.js';
import { Unicorn } from '../entities/unicorn.js';
import { ParticleField } from '../engine/particles.js';
import { World } from '../engine/world.js';
import { parseLevel } from './level-format.js';

const SPAWN_BUILDERS = new Map([
    ['murk', (world, spawn) => world.addEntity(new GloomMurk(spawn.x, spawn.y))],
    ['wisp', (world, spawn) => world.addEntity(new GloomWisp(spawn.x, spawn.y))],
    ['gate', (world, spawn) => world.addEntity(new RainbowGate(spawn.x, spawn.y))],
]);

export function buildLevelWorld(definition) {
    const level = parseLevel(definition);

    const world = new World();
    const terrain = world.addEntity(new Terrain(level.tileGrid));
    world.addEntity(new ParticleField());

    world.boundsLeft = 0;
    world.boundsTop = 0;
    world.boundsRight = terrain.widthInPixels;
    world.boundsBottom = terrain.heightInPixels;

    let unicorn = null;
    // Signs take their text from the level's list in the order they are met,
    // so the picture carries the positions and the list carries the words.
    let signIndex = 0;

    for (const spawn of level.spawns) {
        if (spawn.type === 'player') {
            // Nudged up so the unicorn starts standing on its tile, not inside it.
            unicorn = world.addEntity(new Unicorn(spawn.x, spawn.y - TILE_SIZE / 2 + 1));
            continue;
        }
        if (spawn.type === 'sign') {
            world.addEntity(new LevelSign(spawn.x, spawn.y, level.signs[signIndex++]));
            continue;
        }
        SPAWN_BUILDERS.get(spawn.type)?.(world, spawn);
    }

    world.camera.target = unicorn;
    world.camera.snapTo(unicorn.x, unicorn.y);

    return {
        world,
        unicorn,
        name: level.name,
        /** Captured up front so the colour restoration has a denominator. */
        gloomTotal: world.entitiesOfCategory('gloom').length,
    };
}
