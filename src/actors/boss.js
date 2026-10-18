// src/actors/boss.js
//
// boss.js
//
// A section boss — the PoC bum `boss_zul` (PLAN.md P0.4). Unlike a patrol
// enemy it stands still and does not react at all until its fight trigger is
// met (e.g. carrying `beer`, checked against the global State). Then the
// caller plays the intro audio, starts the boss music and calls engage():
// from that moment the boss fights like any enemy (combat.js) but never gives
// up the chase. Before the fight it cannot be struck — punches just whiff.
// On defeat it lies on the ground like every other character (Actor.draw).
//
// One combined attack (owner 2026-10-15): the boss plays its attack animation
// and at the END of it the green vomit flies out toward the player — there is
// no separate melee blow, the vomit IS the damage (render/vomit.js: it hits
// "in about 300 px" and the squares land at "600 px"). The vomit hurts without
// drawing blood: zul never makes the player bleed (`bloodOnTarget: false` in
// his config); the player still bleeds zul with every landed punch.

import Enemy from './enemy.js';
import Vomit, { VOMIT_HIT_PX } from '../render/vomit.js';
import { playAttackSound } from '../audio/audio.js';

const VOMIT_DAMAGE = 1; // 1 damage, like every blow

export default class Boss extends Enemy {
    /**
     * @param {object} options
     * @param {number} options.x       Frame top-left X in world px.
     * @param {number} options.y       Frame top-left Y in world px.
     * @param {object} options.def     Character config (data/characters/<type>.json).
     * @param {string} options.id      Street-entity id (e.g. "boss_zul"); its
     *                                  defeat sets the world flag `<id>_defeated`.
     * @param {object|null} options.trigger Conditions object for the fight start,
     *                                  e.g. { hasItem: ["beer"] } (State.matchesConditions).
     * @param {object|null} options.idleOverlay Static pose shown instead of the
     *                                  sprite's first frame while the boss waits
     *                                  for its trigger ({ image, x, y }).
     */
    constructor({ x, y, def, id, trigger = null, idleOverlay = null }) {
        super({ x, y, def, id });
        this.trigger = trigger;
        this.idleOverlay = idleOverlay;
        this.fightStarted = false;
        this.vomit = new Vomit();
        this.attackReachPx = VOMIT_HIT_PX; // the combined attack reaches as far as the vomit
    }

    /** Starts the fight. The intro audio and boss music are the caller's job. */
    engage() {
        this.fightStarted = true;
    }

    /** Once the fight is on, the boss never gives up — fight mode until death. */
    isFighting() {
        return this.fightStarted && !this.defeated;
    }

    /** Untouchable until the fight starts: the idle bum just takes the punch. */
    canBeHit() {
        return this.fightStarted && super.canBeHit();
    }

    /** Standing idle: no walking, no turning, no reaction of any kind. */
    _patrol() {
        this.vx = 0;
    }

    /** Called in finish-time order alongside melee strikes, but never uses RPS. */
    releaseVomit() {
        this.attackResolved = true;
        this.vomit.spawn(this, this.facing);
    }

    /** Flying bursts finish after defeat, but cannot deal posthumous damage. */
    updateVomit(dt, target = null) {
        const livingTarget = this.defeated ? null : target;
        const outcome = this.vomit.update(dt, livingTarget);
        if (livingTarget) {
            if (outcome === 'hit') {
                livingTarget.takeDamage(VOMIT_DAMAGE);
                playAttackSound(this.name, 'hit');
            } else if (outcome === 'miss') {
                playAttackSound(this.name, 'miss');
            }
        }
    }

    draw(ctx) {
        super.draw(ctx);
        this.vomit.draw(ctx);
    }

    /** Once the fight is on, the boss always closes in on the player. */
    _isEngaged(target) {
        return this.fightStarted && Boolean(target) && target.canBeHit();
    }
}
