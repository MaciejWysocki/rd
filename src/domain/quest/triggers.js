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

/** The condition fields the model knows about. */
const CONDITION_KEYS = ['mission', 'flags', 'items', 'money', 'defeated', 'position'];

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

    const { session, mission, player, streetId } = context ?? {};

    for (const key of Object.keys(condition)) {
        if (!CONDITION_KEYS.includes(key)) {
            throw new Error(`Nieznany warunek: "${key}".`);
        }
    }

    if (condition.mission) {
        if (!mission) return false;
        const stages = Array.isArray(condition.mission) ? condition.mission : [condition.mission];
        if (!stages.some(stage => mission.isAt(stage))) return false;
    }

    if (condition.flags) {
        for (const [name, value] of Object.entries(condition.flags)) {
            if (session.getFlag(name) !== value) return false;
        }
    }

    if (condition.items) {
        for (const [id, count] of Object.entries(condition.items)) {
            if (session.countItem(id) < count) return false;
        }
    }

    if (condition.money != null) {
        if (session.money < condition.money) return false;
    }

    if (condition.defeated) {
        for (const ref of condition.defeated) {
            const { id, slot } = parseEntityRef(ref);
            if (!session.isDefeated(streetId, id, slot)) return false;
        }
    }

    if (condition.position) {
        if (!player) return false;
        const [x1, x2] = condition.position;
        if (player.x < x1 || player.x > x2) return false;
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

    const { session, mission } = context ?? {};

    for (const effect of effects) {
        switch (effect?.type) {
            case 'mission': {
                if (!mission) throw new Error('Efekt misji bez misji w kontekście.');
                mission.advanceTo(effect.stage);
                break;
            }
            case 'item': {
                const count = effect.count ?? 0;
                if (count >= 0) session.addItem(effect.id, count);
                else session.removeItem(effect.id, -count);
                break;
            }
            case 'money': {
                const amount = effect.amount ?? 0;
                if (amount < 0) session.spendMoney(-amount);
                else session.addMoney(amount);
                break;
            }
            case 'flag': {
                session.setFlag(effect.name, effect.value);
                break;
            }
            default:
                throw new Error(`Nieznany efekt: "${effect?.type}".`);
        }
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
