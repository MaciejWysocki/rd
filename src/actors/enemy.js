// src/actors/enemy.js

/**
 * enemy.js
 *
 * An enemy that patrols its section. It starts at its spawn point and walks left.
 * When a solid boundary blocks it, it turns around and walks right. At its spawn
 * point it turns around again, so it never leaves the patrol range.
 */

import Actor from './actor.js';

// Enemy types that have a sprite and behaviour. Other types from street JSON are not spawned yet.
const ENEMY_TYPES = {
    lysyblokers: {
        spritePath: 'assets/sprites/lysyblokers.png',
        walkSpeed: 100,
        // Feet area, same as the player's.
        hitbox: { x: 50, y: 120, w: 50, h: 25 },
    },
};

const DIR_LEFT = -1;
const DIR_RIGHT = 1;

export function isEnemyType(type) {
    return Object.hasOwn(ENEMY_TYPES, type);
}

export default class Enemy extends Actor {
    /**
     * @param {object} options
     * @param {number} options.x    Spawn X (frame top-left) in world px. Right end of the patrol.
     * @param {number} options.y    Frame top-left Y in world px.
     * @param {string} options.type Key of ENEMY_TYPES.
     */
    constructor({ x, y, type }) {
        const def = ENEMY_TYPES[type];
        if (!def) throw new Error(`Nieznany typ przeciwnika: ${type}`);

        super({ x, y, spritePath: def.spritePath, walkSpeed: def.walkSpeed, hitbox: def.hitbox });
        this.spawnX = x;
        this.direction = DIR_LEFT;
    }

    /**
     * Patrols between the spawn point (right) and the first solid on the left.
     * @param {number} dt Delta time in ms.
     * @param {Array<{x:number,y:number,w:number,h:number}>} solids Section boundaries.
     */
    update(dt, solids) {
        if (!this.tryMove(this.direction * this.walkSpeed * (dt / 1000), 0, solids)) {
            this._turnAround();
        } else if (this.direction === DIR_RIGHT && this.x >= this.spawnX) {
            this.x = this.spawnX;
            this._turnAround();
        }

        this.vx = this.direction * this.walkSpeed;
        this.facing = this.direction;
        super.update(dt);
    }

    _turnAround() {
        this.direction = this.direction === DIR_LEFT ? DIR_RIGHT : DIR_LEFT;
    }
}
