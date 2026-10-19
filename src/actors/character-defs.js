// src/actors/character-defs.js
//
// Loads character configuration files (data/characters/<type>.json).
// A character config holds all statistics and the move set of one character
// type (player, enemies, bosses). A type without a config file is not
// implemented yet; callers skip it. Results are cached, and a missing file
// is cached as null so it is only requested once.

const cache = new Map();

/**
 * @param {string} type Character type key, e.g. "player", "lysy-blokers".
 * @returns {Promise<object|null>} The character config, or null if it does not exist.
 */
export async function loadCharacterDef(type) {
    if (cache.has(type)) return cache.get(type);

    let def = null;
    try {
        const response = await fetch(`data/characters/${type}.json`);
        if (response.ok) def = await response.json();
    } catch {
        def = null;
    }
    cache.set(type, def);
    return def;
}
