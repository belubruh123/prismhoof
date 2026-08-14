/**
 * The base class for everything that lives in a World.
 *
 * Entities are centre-positioned and carry their own half-extents, so they
 * double as collision boxes without a separate hitbox object.
 */

export class Entity {
    x = 0;
    y = 0;

    /** Position at the start of this frame. Swept collision tests need it. */
    previousX = 0;
    previousY = 0;

    /** Seconds since the entity was created. Almost all animation is driven from this. */
    age = 0;

    halfWidth = 0;
    halfHeight = 0;

    /** Draw order. See the LAYER_* constants in config.js. */
    layer = 0;

    /** Names this entity can be looked up by, e.g. ['gloom']. */
    categories = [];

    world = null;
    isRemoved = false;

    /**
     * Subclasses should call `super.update(elapsedSeconds)` first and then move,
     * so that previousX/previousY hold the pre-movement position.
     */
    update(elapsedSeconds) {
        this.age += elapsedSeconds;
        this.previousX = this.x;
        this.previousY = this.y;
    }

    render() {}

    /** Only ever called in debug builds. */
    renderDebug() {}

    remove() {
        this.world.removeEntity(this);
    }
}
