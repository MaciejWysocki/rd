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

import Enemy from './enemy.js';

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

    /** Once the fight is on, the boss always closes in on the player. */
    _isEngaged(target) {
        return this.fightStarted && Boolean(target) && target.canBeHit();
    }
}
