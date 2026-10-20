// src/world/entity-hues.js
//
// entity-hues.js — the hue plan of the hostiles of a section.
//
// Two hostiles of the same type in the same section would look exactly the
// same (they share one sprite sheet), so the player could not tell them
// apart. The first hostile of a type keeps the original colors; every
// further one of that type gets its own hue shift. The shifts follow the
// golden angle (137.5 degrees), so three or four of them stay far apart on
// the color wheel.
//
// The shifts are derived from the seed of the session: they stay the same
// during a playthrough (a corpse keeps the colors of the enemy that fell)
// and differ from one playthrough to the next.

import { normalizeHue } from '../render/hue.js';

const GOLDEN_ANGLE_DEG = 137.508; // the distance between two neighbors of the color wheel
const JITTER_DEG = 12;            // the random spread of a shift

/**
 * Plans the hue shift of every hostile of a section.
 * @param {Array<{type:string}>} entities The hostiles, in the order they are spawned.
 * @param {number} seed The seed of the session (a random number).
 * @returns {number[]} The hue shift of every entity, in degrees (0 = the original colors).
 */
export function planEntityHues(entities, seed = 0) {
    const counts = new Map();
    return entities.map(entity => {
        const index = counts.get(entity.type) ?? 0;
        counts.set(entity.type, index + 1);
        if (index === 0) return 0; // the first one of a type keeps the original colors
        return normalizeHue(index * GOLDEN_ANGLE_DEG + jitter(seed, entity.type, index));
    });
}

/**
 * The random spread of a shift — the same seed always gives the same spread.
 * @returns {number} The spread in degrees, within [-JITTER_DEG, JITTER_DEG].
 */
function jitter(seed, type, index) {
    const hash = hashString(`${seed}:${type}:${index}`);
    return (hash / 0xffffffff) * 2 * JITTER_DEG - JITTER_DEG;
}

/** FNV-1a: a small, stable hash of a string. */
function hashString(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}
