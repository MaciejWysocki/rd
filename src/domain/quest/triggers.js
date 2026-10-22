// src/domain/quest/triggers.js
//
// triggers.js
//
// The unified trigger model: conditions, effects and trigger selection.
//
// A trigger is the only way the world reacts to the player:
//   { index, when, stay, effects }
//   index   — the 0-based position in the config list (it names the sound file)
//   when    — the condition that has to hold; null means "always"
//   stay    — how long the player stays hidden in the spot (walkable spots)
//   effects — what happens when the trigger fires
//
// The condition is a bag of optional checks (all of them have to hold):
//   mission  — the mission is on one of these stages
//   flags    — these world flags have exactly these values
//   items    — the inventory holds at least this many of each item
//   money    — the purse holds at least this much
//   defeated — these entities are defeated in the current street
//              (the id may be "id" — any slot — or "id#slot")
//   position — the player's x is within [x1, x2] (inclusive)
//
// The effects are a tagged union: mission / item / money / flag.
//
// Both are registries: every condition field and every effect type is one
// entry in a table. The vocabulary of the model lives in one place
// (content/trigger-vocabulary.js) — the config schema validates against
// those same lists, so the two can never drift apart.

import { CONDITION_KEYS, EFFECT_TYPES } from './trigger-vocabulary.js';

/**
 * The condition checks, keyed by the field of the condition.
 * Each check answers "does this field hold?"; a field that is not set
 * (null / undefined) is not checked at all.
 */
const CONDITION_CHECKS = {
    mission: (value, { mission }) => {
        if (!mission) return false;
        const stages = Array.isArray(value) ? value : [value];
        return stages.some(stage => mission.isAt(stage));
    },
    flags: (value, { session }) => Object.entries(value)
        .every(([name, expected]) => session.getFlag(name) === expected),
    items: (value, { session }) => Object.entries(value)
        .every(([id, count]) => session.countItem(id) >= count),
    money: (value, { session }) => session.money >= value,
    defeated: (value, { session, streetId }) => value
        .every(ref => {
            const { id, slot } = parseEntityRef(ref);
            return session.isDefeated(streetId, id, slot);
        }),
    position: (value, { player }) => {
        if (!player) return false;
        const [x1, x2] = value;
        return player.x >= x1 && player.x <= x2;
    },
};

/** The effect appliers, keyed by the effect type. */
const EFFECT_APPLIERS = {
    mission: (effect, { mission }) => {
        if (!mission) throw new Error('Efekt misji bez misji w kontekście.');
        mission.advanceTo(effect.stage);
    },
    item: (effect, { session }) => {
        const count = effect.count ?? 0;
        if (count >= 0) session.addItem(effect.id, count);
        else session.removeItem(effect.id, -count);
    },
    money: (effect, { session }) => {
        const amount = effect.amount ?? 0;
        if (amount < 0) session.spendMoney(-amount);
        else session.addMoney(amount);
    },
    flag: (effect, { session }) => session.setFlag(effect.name, effect.value),
};

// The registries must cover the vocabulary exactly: a condition field or an
// effect type without an implementation would silently never fire.
assertCoversVocabulary('warunek', CONDITION_KEYS, Object.keys(CONDITION_CHECKS));
assertCoversVocabulary('efekt', EFFECT_TYPES, Object.keys(EFFECT_APPLIERS));

/**
 * Fails loudly when the vocabulary and the implementation disagree.
 * @param {string} label What is compared (for the error message).
 * @param {string[]} vocabulary The declared names.
 * @param {string[]} implemented The names that have an implementation.
 */
function assertCoversVocabulary(label, vocabulary, implemented) {
    const missing = vocabulary.filter(name => !implemented.includes(name));
    const extra = implemented.filter(name => !vocabulary.includes(name));
    if (missing.length === 0 && extra.length === 0) return;
    throw new Error(
        `Niezgodność słownika (${label}): brakuje [${missing.join(', ')}], `
        + `nieznane [${extra.join(', ')}].`
    );
}

/**
 * Splits an entity reference into its id and its slot.
 * @param {string} ref "id" or "id#slot".
 * @returns {{id:string, slot:number|null}} The parsed reference.
 */
function parseEntityRef(ref) {
    const raw = String(ref ?? '');
    const hash = raw.lastIndexOf('#');
    if (hash < 0) return { id: raw, slot: null };
    const slot = Number(raw.slice(hash + 1));
    return { id: raw.slice(0, hash), slot: Number.isFinite(slot) ? slot : null };
}

/**
 * Checks a condition against the world.
 * @param {object|null|undefined} condition The condition (null = always true).
 * @param {{session:object, mission:object, player:object|null, streetId:string}} context
 *        The world the condition is checked against.
 * @returns {boolean} true when every present field of the condition holds.
 */
export function matchesCondition(condition, context) {
    if (!condition) return true;

    const world = context ?? {};
    // Every key is checked first: an unknown one is an error even when
    // another field of the condition would already have failed.
    for (const key of Object.keys(condition)) {
        if (!CONDITION_CHECKS[key]) throw new Error(`Nieznany warunek: "${key}".`);
    }
    for (const [key, value] of Object.entries(condition)) {
        if (value == null) continue;
        if (!CONDITION_CHECKS[key](value, world)) return false;
    }
    return true;
}

/**
 * Applies the effects of a trigger to the world.
 * @param {Array<{type:string}>} effects The effects to apply.
 * @param {{session:object, mission:object}} context The world that changes.
 * @returns {void}
 */
export function applyEffects(effects, context) {
    if (!effects) return;

    const world = context ?? {};
    for (const effect of effects) {
        const apply = EFFECT_APPLIERS[effect?.type];
        if (!apply) throw new Error(`Nieznany efekt: "${effect?.type}".`);
        apply(effect, world);
    }
}

/**
 * Picks the trigger that applies to the current world: the first one whose
 * condition holds. An unconditional trigger (when === null) matches every
 * world, so the fallback belongs last in the list.
 * @param {Array<{index?:number, when:object|null}>} triggers The trigger list.
 * @param {{session:object, mission:object, player:object|null, streetId:string}} context
 *        The world the triggers are checked against.
 * @returns {object|null} The trigger (with its index) or null when the list is empty.
 */
export function selectTrigger(triggers, context) {
    const list = triggers ?? [];
    for (let i = 0; i < list.length; i++) {
        const trigger = list[i];
        if (!trigger) continue;
        if (matchesCondition(trigger.when ?? null, context)) {
            return trigger.index == null ? { ...trigger, index: i } : trigger;
        }
    }
    return null;
}
