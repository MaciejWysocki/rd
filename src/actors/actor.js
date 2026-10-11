// src/actors/actor.js

/**
 * actor.js
 *
 * Universal base class for all characters (player, NPCs, bosses).
 * Owns position, collision box, sprite-sheet and row-based animation.
 *
 * Sprite-sheet convention: 150x150 frames, one animation per row.
 *   ROW_WALK   (row 0) - walk cycle, 8 frames
 *   ROW_ATTACK (row 1) - 8 frames: 0-3 = right-hand punch, 4-7 = left-hand punch
 *
 * An attack runs from startAttack() until endAttack(). It plays up to the last
 * frame of the current hand and then holds there; the caller decides when to end it.
 */

import SpriteSheet from '../render/sprite-sheet.js';

export const FRAME_SIZE = 150;
export const ROW_WALK = 0;
export const ROW_ATTACK = 1;
export const DEFAULT_ROW_FRAMES = [8, 8];

export const HAND_RIGHT = 0;
export const HAND_LEFT = 1;

const ATTACK_FRAMES_PER_HAND = 4;
const ATTACK_LAST_STEP = ATTACK_FRAMES_PER_HAND - 1;

// Milliseconds per frame. The punch must stay faster than the walk cycle.
const WALK_FRAME_DURATION = 80;
const ATTACK_FRAME_DURATION = 17.5;

export default class Actor {
    /**
     * @param {object} options
     * @param {number} options.x          Frame top-left X in world px.
     * @param {number} options.y          Frame top-left Y in world px.
     * @param {string} options.spritePath Sprite-sheet PNG path.
     * @param {number} options.walkSpeed  Walk speed in px/s.
     * @param {{x:number,y:number,w:number,h:number}} options.hitbox
     *        Collision box relative to the frame's top-left corner.
     */
    constructor({ x = 0, y = 0, spritePath, walkSpeed = 120, hitbox }) {
        this.x = x;
        this.y = y;
        this.walkSpeed = walkSpeed;
        this.hitbox = hitbox;

        this.vx = 0;          // current horizontal speed in px/s, set by subclasses
        this.facing = 1;      // 1 = right, -1 = left
        this.row = ROW_WALK;
        this.frame = 0;
        this.frameTimer = 0;

        // Attack state. The next attack uses nextHand; the hand alternates on each endAttack().
        this.attacking = false;
        this.nextHand = HAND_RIGHT;
        this.attackHand = HAND_RIGHT;
        this.attackStep = 0;
        this.attackTimer = 0;

        this.sheet = new SpriteSheet(spritePath, FRAME_SIZE, DEFAULT_ROW_FRAMES);
    }

    load() {
        return this.sheet.load();
    }

    setRow(row) {
        if (row === this.row) return;
        this.row = row;
        this.frame = 0;
        this.frameTimer = 0;
    }

    /**
     * Starts a punch with the next hand in the alternation.
     * @returns {boolean} false if an attack is already running.
     */
    startAttack() {
        if (this.attacking) return false;

        this.attacking = true;
        this.attackHand = this.nextHand;
        this.attackStep = 0;
        this.attackTimer = 0;
        this.vx = 0;

        this.setRow(ROW_ATTACK);
        this.frame = this._attackFrame();
        return true;
    }

    /**
     * Ends the punch and returns to the first walk frame. Alternates the hand.
     * Safe to call when no attack is running.
     */
    endAttack() {
        if (!this.attacking) return;

        this.attacking = false;
        this.nextHand = this.attackHand === HAND_RIGHT ? HAND_LEFT : HAND_RIGHT;
        this.setRow(ROW_WALK);
    }

    /** True once the punch has reached its last frame (full strike). */
    isAttackAtFullExtension() {
        return this.attacking && this.attackStep >= ATTACK_LAST_STEP;
    }

    _attackFrame() {
        return this.attackHand * ATTACK_FRAMES_PER_HAND + this.attackStep;
    }

    /**
     * Advances the animation. Walk speed scales with |vx| / walkSpeed.
     * During an attack the punch plays to its last frame and then holds.
     * @param {number} dt Delta time in ms.
     */
    update(dt) {
        if (this.attacking) {
            this._updateAttack(dt);
            return;
        }

        if (this.vx === 0) {
            this.frame = 0;
            this.frameTimer = 0;
            return;
        }

        const speedRatio = Math.abs(this.vx) / this.walkSpeed;
        this.frameTimer += dt * speedRatio;

        if (this.frameTimer >= WALK_FRAME_DURATION) {
            this.frameTimer -= WALK_FRAME_DURATION;
            this.frame = (this.frame + 1) % this.sheet.framesIn(this.row);
        }
    }

    _updateAttack(dt) {
        if (this.attackStep >= ATTACK_LAST_STEP) {
            // Hold on the last frame of the punch until endAttack().
            this.attackTimer = 0;
            return;
        }

        this.attackTimer += dt;
        while (this.attackTimer >= ATTACK_FRAME_DURATION && this.attackStep < ATTACK_LAST_STEP) {
            this.attackTimer -= ATTACK_FRAME_DURATION;
            this.attackStep++;
        }

        if (this.attackStep >= ATTACK_LAST_STEP) {
            this.attackStep = ATTACK_LAST_STEP;
            this.attackTimer = 0;
        }

        this.frame = this._attackFrame();
    }

    /**
     * Moves by (dx, dy) unless the hitbox would overlap any solid rectangle.
     * @param {Array<{x:number,y:number,w:number,h:number}>} solids
     * @returns {boolean} true if the move was applied.
     */
    tryMove(dx, dy, solids) {
        const nx = this.x + dx;
        const ny = this.y + dy;
        if (this._collides(nx, ny, solids)) return false;

        this.x = nx;
        this.y = ny;
        return true;
    }

    _collides(x, y, solids) {
        const hb = this.hitbox;
        const left = x + hb.x;
        const top = y + hb.y;
        const right = left + hb.w;
        const bottom = top + hb.h;

        return solids.some(s =>
            left < s.x + s.w &&
            right > s.x &&
            top < s.y + s.h &&
            bottom > s.y
        );
    }

    draw(ctx) {
        this.sheet.drawFrame(ctx, this.row, this.frame, this.x, this.y, this.facing);
    }
}
