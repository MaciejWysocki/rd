// src/domain/combat/arena.js
//
// arena.js
//
// The chronological arbitration of the melee — ported from the old
// PlayState._resolveCombat. Ready attacks are not resolved in the order the
// actors happen to be updated, but in the order in which they reach their full
// extension, so the outcome does not depend on the update order.
//
// The function is pure: it plays no sounds and spawns no blood. It returns the
// events and the application layer reacts to them:
//   { type: 'hit',    attacker, target, direction } — a landed blow
//   { type: 'miss',   attacker }                     — a whiff (or a lost RPS tie)
//   { type: 'draw',   attacker, target }             — an exact tie: both miss
//   { type: 'ranged', attacker }                     — a released projectile
//
// An enemy's target is always the player; the player's target is the nearest
// opponent it can reach.

import { isStrikeInRange, resolveStrike, strikeDirection } from './combat.js';

/**
 * Resolves every blow that is ready and returns the events.
 * @param {Array<Actor>} combatants Every actor that may strike (the player + the enemies).
 * @param {object} options
 * @param {Actor} options.player The player.
 * @param {Array<{x:number,y:number,w:number,h:number}>} options.solids Section boundaries.
 * @returns {Array<object>} The events of this arbitration.
 */
export function arbitrate(combatants, { player, solids = [] }) {
    const events = [];
    const strikes = [];

    for (const actor of combatants ?? []) {
        if (!actor.defeated && actor.isAttackAtFullExtension() && !actor.attackResolved) {
            strikes.push(actor);
        }
    }
    strikes.sort((a, b) => a.attackFinishInMs() - b.attackFinishInMs());

    for (const attacker of strikes) {
        // An earlier blow may have interrupted or defeated this attacker.
        if (attacker.defeated || !attacker.attacking || attacker.attackResolved) continue;
        const target = attacker === player ? pickStrikeTarget(player, combatants) : player;

        // A ranged attack does not use the RPS: it releases its projectile.
        if (isRangedAttack(attacker)) {
            attacker.releaseProjectile();
            events.push({ type: 'ranged', attacker });
            continue;
        }

        const outcome = resolveStrike(attacker, target, solids);
        if (outcome === 'hit') {
            events.push({ type: 'hit', attacker, target, direction: strikeDirection(attacker, target) });
        } else if (outcome === 'draw') {
            events.push({ type: 'draw', attacker, target });
        } else {
            events.push({ type: 'miss', attacker });
        }
    }

    return events;
}

/** Nearest opponent the player's blow can reach right now, or null (whiff). */
function pickStrikeTarget(player, combatants) {
    let best = null;
    let bestDistance = Infinity;
    for (const opponent of combatants ?? []) {
        if (opponent === player) continue;
        if (!opponent.canBeHit() || !isStrikeInRange(player, opponent)) continue;
        const distance = Math.abs(opponent.x - player.x);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = opponent;
        }
    }
    return best;
}

/** True when the blow in progress is a ranged one (the old boss's vomit). */
function isRangedAttack(attacker) {
    const moveType = attacker.attackMove?.type;
    if (moveType) return moveType === 'vomit';
    return attacker.attackKind === 'ranged';
}
