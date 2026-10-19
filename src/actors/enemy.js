// src/actors/enemy.js
//
// enemy.js
//
// An enemy that patrols its section until the player comes near. It starts at
// its spawn point and walks left; when a solid boundary blocks it, it turns
// around and walks right, turning again at its spawn point so it never leaves
// the patrol range.
//
// Combat (PLAN.md P0.2): the fight trigger comes from the street config:
//   'always'  — the enemy fights the player as soon as he is in the section
//   'distance' — the enemy is peaceful while the player is farther away than
//                the configured distance, and fights him when he comes closer
//   'hit'     — the enemy is peaceful until the player hits him; then he fights
// While peaceful the enemy just patrols its stretch of the section. In strike
// reach it attacks IMMEDIATELY — no reaction pause (owner 2026-10-14). One blow
// per exchange (see combat.js): the blow is resolved at full extension and the
// only wait is between consecutive blows — the full-stretch hold (attackHoldMs)
// and the recovery (recoveryMs) before the next one. A defeated enemy stops
// acting and lies on the ground until the section is left (Actor.draw).
//
// All statistics and moves come from a character config (data/characters/<type>.json),
// loaded by the caller; a type without a config file is not implemented and is
// never constructed (see character-defs.js).

import Actor from './actor.js';
import { isStrikeInRange, STRIKE_REACH_PX } from './combat.js';

const DIR_LEFT = -1;
const DIR_RIGHT = 1;

const DEFAULT_ENGAGE_DISTANCE_PX = 350; // how close the player must come (no "distance" in the config)
const ATTACK_HOLD_MS = 150;   // default hold of the full-stretch frame after the blow resolves

export default class Enemy extends Actor {
    /**
     * @param {object} options
     * @param {number} options.x   Spawn X (frame top-left) in world px. Right end of the patrol.
     * @param {number} options.y   Frame top-left Y in world px.
     * @param {object} options.def Character config (data/characters/<type>.json).
     * @param {string} options.id  Street-entity id (persisted when defeated).
     * @param {string} options.trigger Fight trigger: 'always', 'distance' or 'hit'.
     * @param {number} options.distance Distance of the 'distance' trigger, in world px.
     */
    constructor({ x, y, def, id = null, trigger = 'distance', distance = null }) {
        super({ x, y, def, id });
        this.spawnX = x;
        this.direction = DIR_LEFT;
        // How close the player must be for this enemy to start a blow
        // (the boss overrides it with its vomit range).
        this.attackReachPx = def.attackReachPx ?? STRIKE_REACH_PX;
        // How long the full-stretch frame is held before returning to the
        // straight pose (e.g. the bald thug lingers in the headbutt for 0.5 s).
        this.attackHoldMs = def.attackHoldMs ?? ATTACK_HOLD_MS;
        this.attackHoldElapsed = 0;
        // The fight trigger from the street config.
        this.trigger = trigger;
        this.engageDistancePx = distance ?? DEFAULT_ENGAGE_DISTANCE_PX;
        this.hitEngaged = false; // the player hit him — from now on he fights back
    }

    /**
     * True when the fight should start now. The boss starts its fight once
     * (see boss.js); the regular enemies just switch their stance.
     * @param {Actor|null} target The player.
     */
    shouldStartFight(target) {
        if (this.trigger === 'always') return Boolean(target) && target.canBeHit();
        if (this.trigger === 'hit') return this.hitEngaged;
        return this._isEngaged(target);
    }

    /** A hit ends the peace: the enemy fights back from now on. */
    takeDamage(amount = 1, direction = 0, solids = []) {
        this.hitEngaged = true;
        super.takeDamage(amount, direction, solids);
    }

    /** True while this enemy is fighting the player (broke the patrol / chasing). */
    isFighting(target) {
        return this._isEngaged(target);
    }

    startAttack(move) {
        const started = super.startAttack(move);
        if (started) this.attackHoldElapsed = 0;
        return started;
    }

    /**
     * @param {number} dt Delta time in ms.
     * @param {Array<{x:number,y:number,w:number,h:number}>} solids Section boundaries.
     * @param {Actor|null} target The player, when present and hittable.
     */
    update(dt, solids, target = null) {
        if (this.defeated) {
            super.update(dt); // the fall animation keeps playing
            return;
        }

        this.attackCooldownMs = Math.max(0, this.attackCooldownMs - dt);

        if (this.attacking) {
            this.vx = 0;
            // Hold the full-stretch frame until the blow has been resolved and shown.
            if (this.attackResolved) {
                this.attackHoldElapsed += dt;
                if (this.attackHoldElapsed >= this.attackHoldMs) this.endAttack();
            }
            super.update(dt);
            return;
        }

        if (this._isEngaged(target)) this._combatStance(dt, solids, target);
        else this._patrol(dt, solids);

        super.update(dt);
    }

    /** True while the enemy fights the player — the trigger decides when. */
    _isEngaged(target) {
        if (!target || !target.canBeHit()) return false;
        if (this.trigger === 'always') return true;
        if (this.trigger === 'hit') return this.hitEngaged;
        return Math.abs(this._centerX() - this._targetCenterX(target)) <= this.engageDistancePx;
    }

    /** Faces the player, closes in and trades single blows. */
    _combatStance(dt, solids, target) {
        const targetCenter = this._targetCenterX(target);
        this.facing = targetCenter >= this._centerX() ? DIR_RIGHT : DIR_LEFT;

        if (isStrikeInRange(this, target, this.attackReachPx)) {
            this.vx = 0;
            // No reaction pause: the blow comes immediately in reach. The only
            // wait is between consecutive blows (attackHoldMs + recoveryMs).
            if (this.attackCooldownMs <= 0) this.startAttack();
        } else {
            this.tryMove(this.facing * this.walkSpeed * (dt / 1000), 0, solids);
            this.vx = this.facing * this.walkSpeed;
        }
    }

    /**
     * Patrols between the spawn point (right) and the left end of the section
     * (or the first solid in the way).
     * @param {number} dt Delta time in ms.
     * @param {Array<{x:number,y:number,w:number,h:number}>} solids Section boundaries.
     */
    _patrol(dt, solids) {
        if (!this.tryMove(this.direction * this.walkSpeed * (dt / 1000), 0, solids)) {
            this._turnAround();
        } else if (this.direction === DIR_RIGHT && this.x >= this.spawnX) {
            this.x = this.spawnX;
            this._turnAround();
        } else if (this.direction === DIR_LEFT && this.x <= 0) {
            this.x = 0;
            this._turnAround();
        }

        this.vx = this.direction * this.walkSpeed;
        this.facing = this.direction;
    }

    _turnAround() {
        this.direction = this.direction === DIR_LEFT ? DIR_RIGHT : DIR_LEFT;
    }

    _centerX() {
        return this.x + this.hitbox.x + this.hitbox.w / 2;
    }

    _targetCenterX(target) {
        return target.x + target.hitbox.x + target.hitbox.w / 2;
    }
}
