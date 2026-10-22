// src/domain/actors/behavior.js
//
// behavior.js — the AI behaviour of a hostile (the Strategy pattern).
//
// A hostile's behaviour is a config value ("patrol" / "sentry"); the
// behaviour decides what the hostile does while it is not fighting:
//   patrol — walks its stretch of the section until the fight starts
//   sentry — stands still, does not turn and cannot be hit until the fight
//            starts (a sentry with the "hit" trigger CAN be hit — the blow
//            itself starts the fight)
//
// The behaviour is a strategy: the Enemy class holds the mechanics of a
// hostile (the movement, the blow, the fight trigger) and delegates the
// policy to the behaviour object. A new behaviour is a new object here —
// the Enemy class does not change.

export const PATROL = 'patrol';
export const SENTRY = 'sentry';

const patrol = {
    name: PATROL,
    /** A patrolling hostile is never protected before the fight. */
    locked: () => false,
    /** A patrolling hostile fights while its trigger says so. */
    engaged: (enemy, target) => enemy.triggerMet(target),
    /** It shows its HP in the HUD while it fights. */
    fighting: (enemy, target) => enemy.engagedWith(target),
    /** A patrolling hostile walks its stretch. */
    idle: (enemy, dt, solids) => enemy.walkPatrol(dt, solids),
};

const sentry = {
    name: SENTRY,
    /** A sentry cannot be hit before the fight (the "hit" trigger excepted). */
    locked: (enemy) => !enemy.fightStarted && enemy.trigger.type !== 'hit',
    /** A sentry fights from the moment its fight starts — it never gives up. */
    engaged: (enemy) => enemy.fightStarted,
    fighting: (enemy) => enemy.fightStarted,
    /** A sentry stands still: no walking, no turning, no reaction at all. */
    idle: (enemy) => {
        enemy.vx = 0;
    },
};

const BEHAVIORS = {
    [PATROL]: patrol,
    [SENTRY]: sentry,
};

/**
 * The behaviour of a hostile.
 * @param {string} name The behaviour name from the character config.
 * @returns {object} The behaviour (its strategy object).
 */
export function behaviorFor(name) {
    const behavior = BEHAVIORS[name];
    if (!behavior) throw new Error(`Nieznane zachowanie wroga: "${name}".`);
    return behavior;
}
