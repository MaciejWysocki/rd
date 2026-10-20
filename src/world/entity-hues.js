// src/world/entity-hues.js
//
// entity-hues.js — the hue plan of the hostiles of a section.
//
// Two hostiles of the same type in the same section would look exactly the
// same (they share one sprite sheet), so the player could not tell them
// apart. The first hostile of a type keeps the original colors; every further
// copy of that type gets one of the random hues of the game, so the copies
// are clearly different from the original and from each other.
//
// The hues are drawn anew for every game (the hue pool of the session) and
// stay the same for the whole playthrough: the street looks different in
// every playthrough, but a hostile keeps its colors within one — a corpse
// keeps the colors of the enemy that fell.

const CLEAR_DEG = 45; // a copy must be clearly different from the other colors

/**
 * Plans the hue shift of every hostile of a section.
 * @param {Array<{type:string}>} entities The hostiles, in the order they are spawned.
 * @param {number[]} pool The random hues of the game (the session's hue pool).
 * @returns {number[]} The hue shift of every entity, in degrees (0 = the original colors).
 */
export function planEntityHues(entities, pool = []) {
    const counts = new Map();
    const taken = []; // the hues already handed out
    return entities.map(entity => {
        const index = counts.get(entity.type) ?? 0;
        counts.set(entity.type, index + 1);
        if (index === 0) return 0; // the first one of a type keeps the original colors
        return takeHue(pool, taken);
    });
}

/**
 * The first hue of the pool that is clear of the original colors and of the
 * hues already taken.
 * @param {number[]} pool The random hues of the game.
 * @param {number[]} taken The hues already taken (grows with every call).
 * @returns {number} The hue in degrees.
 */
function takeHue(pool, taken) {
    for (const hue of pool) {
        if (!isClear(hue, taken)) continue;
        taken.push(hue);
        return hue;
    }
    // The pool is short (it holds far more hues than a section needs): take
    // the hue that is the farthest from the original colors and from the hues
    // already taken.
    let best = 0;
    let bestScore = -1;
    for (const hue of pool) {
        const score = Math.min(distance(hue, 0), ...taken.map(other => distance(hue, other)));
        if (score > bestScore) {
            bestScore = score;
            best = hue;
        }
    }
    taken.push(best);
    return best;
}

/** True when a hue is far enough from the original colors and from the taken ones. */
function isClear(hue, taken) {
    if (distance(hue, 0) < CLEAR_DEG) return false;
    return taken.every(other => distance(hue, other) >= CLEAR_DEG);
}

/** The distance between two hues on the color wheel (0 to 180 degrees). */
function distance(a, b) {
    const delta = Math.abs(a - b) % 360;
    return delta > 180 ? 360 - delta : delta;
}
