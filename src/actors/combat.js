// src/actors/combat.js
//
// combat.js
//
// Universal combat resolution shared by the player, regular enemies and
// bosses (PLAN.md P0.2: trading single blows). The hit is resolved at the
// finish of the attack animation ("full stretch"): the first strike to
// finish lands, cancels the defender's own blow and stuns it for a short
// recovery. Whether the blow connects is checked against the two hitboxes
// at that moment — the defender only needs to be out of reach or turned away.
//
// PoC rules: 1 damage per blow, HP 0 means defeat. Simultaneous finishes
// and timed evasion are Phase 1 (P1.1/P1.2).

import { playAttackSound } from '../audio/audio.js';

// The blow connects hitbox-to-hitbox: from the attacker's hitbox front edge to
// the target's hitbox near edge (owner 2026-10-13: revert the centre rule, the
// slightly narrower character hitboxes are the fine-tuning).
export const STRIKE_REACH_PX = 80;
export const ATTACK_COOLDOWN_MS = 700; // recovery after a blow ends or a hit lands
export const HIT_DAMAGE = 1;

/**
 * True when the target's hitbox lies in front of the attacker, close enough
 * to be struck. Overlapping hitboxes are always in reach.
 * @param {Actor} attacker
 * @param {Actor} target
 */
export function isStrikeInRange(attacker, target) {
    const a = attacker.hitbox;
    const t = target.hitbox;
    const aLeft = attacker.x + a.x;
    const aRight = aLeft + a.w;
    const aTop = attacker.y + a.y;
    const aBottom = aTop + a.h;
    const tLeft = target.x + t.x;
    const tRight = tLeft + t.w;
    const tTop = target.y + t.y;
    const tBottom = tTop + t.h;

    if (aBottom <= tTop || aTop >= tBottom) return false;

    const aCenter = aLeft + a.w / 2;
    const tCenter = tLeft + t.w / 2;
    if ((tCenter - aCenter) * attacker.facing <= 0) return false; // target not in front

    const gap = tCenter > aCenter ? tLeft - aRight : aLeft - tRight;
    return gap <= STRIKE_REACH_PX;
}

/**
 * Resolves one blow at the finish of the attacker's animation. The hit
 * interrupts the struck character's own attack (blows are traded, not
 * doubled up) and lands only on a target that can currently be struck
 * (an unengaged boss just takes the punch without a scratch).
 *
 * @param {Actor} attacker
 * @param {Actor|null} target Best target in reach, or null for a whiff.
 * @returns {'hit'|'miss'} What happened, for sounds and stats.
 */
export function resolveStrike(attacker, target) {
    attacker.attackResolved = true;

    const connects = target && target.canBeHit() && isStrikeInRange(attacker, target);
    if (!connects) {
        playAttackSound(attacker.name, 'miss');
        return 'miss';
    }

    target.takeDamage(HIT_DAMAGE);
    playAttackSound(attacker.name, 'hit');
    return 'hit';
}
