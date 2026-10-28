// src/domain/combat/combat.js
//
// combat.js
//
// Universal melee arbitration: hits resolve at full extension. Already-started
// opposing blows finishing within 100 ms use headbutt > punch > kick > headbutt.
// Compare their finish times while both windups are known, without delaying a
// single strike or allowing a later dodge to undo damage. Vomit never uses RPS.
//
// The arbitration is pure domain code: it plays no sounds and spawns no blood
// — it only returns the outcome, and the application layer turns the outcome
// into sound and blood.

import { shitboxRect, centerX } from '../actors/shitbox.js';

export const STRIKE_REACH_PX = 80;
export const ATTACK_COOLDOWN_MS = 700; // recovery after a blow ends or a hit lands
export const HIT_DAMAGE = 1;
export const HIT_KNOCKBACK_PX = 100;
export const TIE_BUFFER_MS = 100;

const BEATS = { headbutt: 'punch', punch: 'kick', kick: 'headbutt' };

/**
 * True when the target's hitbox lies in front of the attacker, close enough
 * to be struck. Overlapping hitboxes are always in reach.
 * @param {Actor} attacker
 * @param {Actor} target
 * @param {number} [reachPx] Reach override (e.g. a ranged attack's range).
 */
export function isStrikeInRange(attacker, target, reachPx = STRIKE_REACH_PX) {
    const a = shitboxRect(attacker);
    const t = shitboxRect(target);

    if (a.bottom <= t.top || a.top >= t.bottom) return false;

    const aCenter = (a.left + a.right) / 2;
    const tCenter = (t.left + t.right) / 2;
    if ((tCenter - aCenter) * attacker.facing <= 0) return false; // target not in front

    const gap = tCenter > aCenter ? t.left - a.right : a.left - t.right;
    return gap <= reachPx;
}

/**
 * The direction a blow pushes its target: towards the target's centre, the
 * attacker's facing as the fallback. The knockback and the blood spray both
 * use it, so it is defined once.
 * @param {Actor} attacker
 * @param {Actor} target
 * @returns {number} -1 (left) or 1 (right).
 */
export function strikeDirection(attacker, target) {
    return Math.sign(centerX(target) - centerX(attacker)) || attacker.facing;
}

/**
 * Resolves a melee blow at full extension. A competing, already-started melee
 * attack inside the tie window can beat it even if its extension comes later;
 * that winner still has to reach its own extension and pass the hitbox check.
 * Equal moves favor the earlier finish; exactly equal finishes draw.
 * @returns {'hit'|'miss'|'draw'} Outcome of the blow — the application layer
 *   turns it into sound and blood.
 */
export function resolveStrike(attacker, target, solids = [], opposing = true) {
    attacker.attackResolved = true;

    const connects = target && target.canBeHit() && !target.jumping && target.drawOffsetY <= 0
        && isStrikeInRange(attacker, target);
    if (!connects) return 'miss';

    const move = attacker.attackMove?.type;
    const counter = target.attackMove?.type;
    if (opposing && BEATS[move] && BEATS[counter] && target.attacking && !target.attackResolved
        && attacker.canBeHit() && !attacker.jumping && attacker.drawOffsetY <= 0
        && isStrikeInRange(target, attacker)) {
        const finishDelta = attacker.attackFinishInMs() - target.attackFinishInMs();
        if (Math.abs(finishDelta) <= TIE_BUFFER_MS) {
            // The attacker lost the RPS tie (or the equal move finished later).
            if (BEATS[counter] === move || (move === counter && finishDelta > 0)) return 'miss';
            if (move === counter && finishDelta === 0) {
                // An exact tie: both attackers miss, the defender's blow is
                // marked resolved so it cannot land later.
                target.attackResolved = true;
                return 'draw';
            }
        }
    }

    target.takeDamage(HIT_DAMAGE, strikeDirection(attacker, target), solids, attacker);
    return 'hit';
}
