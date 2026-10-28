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
// Hostiles normally target the player, but retaliate against neutral attackers.
// Neutrals target their attacker; the player targets the nearest opponent in reach.

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
        const target = strikeTarget(attacker, player, combatants);

        // A ranged attack does not use the RPS: it releases its projectile.
        if (isRangedAttack(attacker)) {
            attacker.releaseProjectile();
            events.push({ type: 'ranged', attacker });
            continue;
        }

        // Hostiles still choose their normal target, but a melee swing can also
        // catch pedestrians in its path. Resolve each victim through the same
        // range and RPS rules as the selected target.
        const hostile = attacker.role === 'enemy' || attacker.role === 'boss';
        const targets = [hostile && target !== player && target?.role !== 'neutral' ? null : target];
        if (hostile) {
            for (const candidate of combatants ?? []) {
                if (candidate.role === 'neutral' && !targets.includes(candidate)) targets.push(candidate);
            }
        }

        let connected = false;
        for (const victim of targets) {
            const opposing = victim && strikeTarget(victim, player, combatants) === attacker;
            const outcome = resolveStrike(attacker, victim, solids, opposing);
            if (outcome === 'hit') {
                connected = true;
                events.push({ type: 'hit', attacker, target: victim, direction: strikeDirection(attacker, victim), defeated: victim.defeated });
            } else if (outcome === 'draw') {
                connected = true;
                events.push({ type: 'draw', attacker, target: victim });
            }
        }
        if (!connected) events.push({ type: 'miss', attacker });
    }

    return events;
}
/** Selects the actor a combatant's current blow is directed at. */
function strikeTarget(attacker, player, combatants) {
    if (attacker === player) return pickStrikeTarget(player, combatants);
    return attacker.selectTarget(player);
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
