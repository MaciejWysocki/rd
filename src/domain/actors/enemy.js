// src/domain/actors/enemy.js
//
// enemy.js
//
// Every hostile in one config-driven class — the patrol enemy and the boss
// are the same thing now, only the behaviour differs.
//
// A patrol enemy (behavior: 'patrol') walks the whole section — it bounces
// between the edges of the screen, wherever it spawns — until the fight
// trigger from the street config is met:
//   'always'  — the enemy fights the player as soon as he is in the section
//   'distance' — the enemy is peaceful while the player is farther away than
//                the configured distance, and fights him when he comes closer
//   'hit'     — the enemy is peaceful until the player hits him; then he fights
// The trigger is re-evaluated every frame, so a patrol enemy disengages
// again when the player walks away.
//
// A sentry (behavior: 'sentry', the old boss) stands still, does not turn and
// cannot be hit until its fight starts. The fight starts when the trigger is
// met (shouldStartFight) and the caller latches it with engage(); from then
// on the sentry fights like a patrol enemy and never gives up the chase.
// The only exception: a sentry with the 'hit' trigger CAN be hit — the blow
// itself starts the fight.
//
// The two behaviours are strategy objects (actors/behavior.js): the class
// below holds the mechanics (the movement, the blow, the trigger) and the
// behaviour decides the policy. A new behaviour is a new strategy — this
// class does not change.
//
// In strike reach an enemy attacks IMMEDIATELY — no reaction pause (owner
// 2026-10-14). One blow per exchange (see combat.js): the blow is resolved
// at full extension and the only wait is between consecutive blows — the
// full-stretch hold (attackHoldMs) and the recovery (recoveryMs) before the
// next one. A defeated enemy stops acting and lies on the ground until the
// section is left (Actor.draw).
//
// A ranged character (character.attackKind === 'ranged', the old boss's
// vomit) does not trade melee blows: at the full extension it releases its
// injected projectile instead (releaseProjectile).

import Actor from './actor.js';
import { centerX } from './shitbox.js';
import { behaviorFor, PATROL } from './behavior.js';
import { HIT_DAMAGE, STRIKE_REACH_PX, isStrikeInRange } from '../combat/combat.js';

const DIR_LEFT = -1;
const DIR_RIGHT = 1;

const DEFAULT_ENGAGE_DISTANCE_PX = 350; // how close the player must come (no "distance" in the config)
const ATTACK_HOLD_MS = 150;   // default hold of the full-stretch frame after the blow resolves
// How far a ranged enemy starts his attack from — the old boss spat from
// 300 px away (VOMIT_HIT_PX in render/vomit.js).
const RANGED_ATTACK_REACH_PX = 300;

export default class Enemy extends Actor {
    /**
     * @param {object} options
     * @param {number} options.x         Spawn X (frame top-left) in world px.
     * @param {number} options.y         Frame top-left Y in world px.
     * @param {number} [options.facing]  The way it spawns facing and walking: -1 (left,
     *        the default — like every hostile) or 1 (right). The "facing" of the
     *        street config (FACING in actor.js).
     * @param {number} [options.patrolX1] The stretch of the section it patrols: it
     * @param {number} [options.patrolX2] bounces between these frame positions (the whole
     *        section — see PATROL_X_MIN / PATROL_X_MAX in world/layout.js).
     * @param {object} options.character Normalized Character model.
     * @param {object} options.sheet      Sprite sheet: { drawFrame(ctx, row, frame, x, y, facing) }.
     * @param {string|null} options.id    Street-entity id (the label of the entity).
     * @param {string|null} options.role  'enemy' or 'boss' — the app layer gives the boss
     *                                      the fight music and the intro sentence.
     * @param {{type:string, distance:number|null}} options.trigger
     *        The fight trigger: 'always', 'distance' or 'hit'.
     * @param {number|null} options.slot  The entity's place in the section's list — it tells
     *        two entities with the same id apart (each keeps its own corpse).
     * @param {object|null} options.projectile
     *        For a ranged character: { spawn(origin, dirX), update(dt, target), draw(ctx) }.
     * @param {number} options.hue
     *        The hue shift of this enemy in degrees — it tells two enemies of the same
     *        type apart (the sheet bakes it in, the HUD tints the HP row with it).
     */
    constructor({
        x, y, character, sheet, id = null, role = 'enemy',
        trigger = { type: 'distance', distance: null }, slot = null, projectile = null, hue = 0,
        facing = DIR_LEFT, patrolX1 = 0, patrolX2 = x,
    }) {
        super({ x, y, character, sheet, id, hue });
        this.role = role;
        this.slot = slot;
        this.facing = facing;
        this.direction = facing; // a patrol sets off the way it spawns facing
        this.patrolX1 = patrolX1;
        this.patrolX2 = patrolX2;
        // 'patrol' walks the section, 'sentry' stands still until the fight.
        this.behavior = behaviorFor(character.behavior ?? PATROL);
        // 'melee' trades blows, 'ranged' releases a projectile.
        this.attackKind = character.attackKind ?? 'melee';
        this.projectile = projectile;
        // The fight trigger from the street config.
        this.trigger = {
            type: trigger?.type ?? 'distance',
            distance: trigger?.distance ?? null,
        };
        // How close the player must be for this enemy to start a blow.
        this.engageDistancePx = this.trigger.distance ?? DEFAULT_ENGAGE_DISTANCE_PX;
        // How far the strike reaches (a ranged enemy reaches as far as its spray).
        this.attackReachPx = character.attackReachPx
            ?? (this.attackKind === 'ranged' ? RANGED_ATTACK_REACH_PX : STRIKE_REACH_PX);
        // How long the full-stretch frame is held before returning to the
        // straight pose (e.g. the bald thug lingers in the headbutt for 0.5 s).
        this.attackHoldMs = character.attackHoldMs ?? ATTACK_HOLD_MS;
        this.attackHoldElapsed = 0;
        this.fightStarted = false; // the sentry's latch — the fight never ends
        this.hitEngaged = false;   // the player hit him — from now on he fights back
    }

    /**
     * True when the fight should start now. The sentry starts its fight once
     * (the caller latches it with engage()); a patrol enemy just switches
     * its stance.
     * @param {Actor|null} target The player.
     */
    shouldStartFight(target) {
        return this.triggerMet(target);
    }

    /** Starts the fight. The intro audio and the boss music are the caller's job. */
    engage() {
        this.fightStarted = true;
    }

    /**
     * Puts the enemy back where it stood when the player left the section:
     * the position, the facing and the direction of the patrol.
     * @param {{x:number,y:number,facing:number,direction:number}} state Where it stood.
     */
    restoreState({ x, y, facing, direction }) {
        this.x = x;
        this.y = y;
        if (facing) this.facing = facing;
        if (direction) this.direction = direction;
    }

    /** A hit ends the peace: the enemy fights back from now on. */
    takeDamage(amount = 1, direction = 0, solids = []) {
        this.hitEngaged = true;
        super.takeDamage(amount, direction, solids);
    }

    /** True while this enemy is fighting the player (the HUD shows its HP). */
    isFighting(target) {
        if (this.defeated) return false;
        return this.behavior.fighting(this, target);
    }

    /** A sentry is untouchable until the fight starts — the 'hit' trigger excepted. */
    canBeHit() {
        if (this.defeated) return false;
        if (this.behavior.locked(this)) return false;
        return true;
    }

    startAttack(move) {
        const started = super.startAttack(move);
        if (started) this.attackHoldElapsed = 0;
        return started;
    }

    /**
     * @param {number} dt Delta time in ms.
     * @param {object} env The world around the enemy: { solids, target }.
     */
    update(dt, env = {}) {
        const { solids = [], target = null } = env;
        if (this.defeated) {
            this.advance(dt); // the fall animation keeps playing
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
            this.advance(dt);
            return;
        }

        if (this.engagedWith(target)) this._combatStance(dt, solids, target);
        else this.behavior.idle(this, dt, solids);

        this.advance(dt);
    }

    /** Releases the ranged attack: the projectile leaves the mouth, no RPS. */
    releaseProjectile() {
        this.attackResolved = true;
        if (this.projectile) this.projectile.spawn(this, this.facing);
    }

    /**
     * Flies the projectile and applies its damage. The app layer calls it once
     * per frame, after the melee blows have been resolved.
     * @param {number} dt Delta time in ms.
     * @param {Actor|null} target The player, when present and hittable.
     * @returns {'hit'|'miss'|null} The outcome of the burst — the app layer
     *   turns it into the sound of the impact.
     */
    updateProjectile(dt, target = null) {
        if (!this.projectile) return null;
        const livingTarget = this.defeated ? null : target;
        const outcome = this.projectile.update(dt, livingTarget);
        if (livingTarget && outcome === 'hit') livingTarget.takeDamage(HIT_DAMAGE);
        return outcome;
    }

    draw(ctx) {
        super.draw(ctx);
        if (this.projectile) this.projectile.draw(ctx);
    }

    /** True when the fight trigger is met — the raw trigger, without the sentry's latch. */
    triggerMet(target) {
        if (this.trigger.type === 'always') return Boolean(target) && target.canBeHit();
        if (this.trigger.type === 'hit') return this.hitEngaged;
        if (!target || !target.canBeHit()) return false;
        return Math.abs(centerX(this) - centerX(target)) <= this.engageDistancePx;
    }

    /** True while this enemy is fighting the player — the trigger decides when. */
    engagedWith(target) {
        if (this.defeated) return false;
        if (!target || !target.canBeHit()) return false;
        return this.behavior.engaged(this, target);
    }

    /** Faces the player, closes in and trades single blows. */
    _combatStance(dt, solids, target) {
        const targetCenter = centerX(target);
        this.facing = targetCenter >= centerX(this) ? DIR_RIGHT : DIR_LEFT;

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
     * Patrols the whole section: it bounces between the edges of its patrol
     * stretch (the whole screen) and any solid in the way.
     * @param {number} dt Delta time in ms.
     * @param {Array<{x:number,y:number,w:number,h:number}>} solids Section boundaries.
     */
    walkPatrol(dt, solids) {
        if (!this.tryMove(this.direction * this.walkSpeed * (dt / 1000), 0, solids)) {
            this._turnAround();
        } else if (this.direction === DIR_RIGHT && this.x >= this.patrolX2) {
            this.x = this.patrolX2;
            this._turnAround();
        } else if (this.direction === DIR_LEFT && this.x <= this.patrolX1) {
            this.x = this.patrolX1;
            this._turnAround();
        }

        this.vx = this.direction * this.walkSpeed;
        this.facing = this.direction;
    }

    _turnAround() {
        this.direction = this.direction === DIR_LEFT ? DIR_RIGHT : DIR_LEFT;
    }
}
