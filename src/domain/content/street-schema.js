// src/domain/content/street-schema.js
//
// Normalizes a street config (data/streets/<streetId>.json) into the Street
// model of the domain. A street is a list of sections placed from left to
// right; every section holds its overlays, its walkable interactions and its
// hostiles.
//
// The module is pure: it reads a plain object and returns a plain object —
// no fetch, no DOM. A new street, a new section or a new mission is nothing
// but a JSON file — nothing in the code has to change.
//
// The config (schema v2):
//   name     — the name of the street
//   mission  — the mission stages, one log line per stage
//   sections — the sections of the street
//     name        — the place shown in the section
//     onEnter     — the triggers fired when the player enters the section
//     overlays    — background overlays ({x, y, when, position})
//     interactions— the walkable spots ({id, type, x1, x2, when, triggers})
//     enemies     — the enemies of the section
//     neutrals   — the neutral pedestrians of the section
//     bosses      — the bosses of the section
//
// A condition ("when") and an effect are written in a terse JSON form and are
// normalized here into a tagged union the quest layer understands. The names
// themselves come from the quest layer's vocabulary — the schema and the
// engine must agree on them.

import { CONDITION_KEYS, EFFECT_TYPES } from '../quest/trigger-vocabulary.js';
import { FACING } from '../actors/actor.js';

const FIGHT_TYPES = ['always', 'distance', 'hit'];
const INTERACTION_TYPES = ['walkable'];

// The keys of every level of the config. The old v1 shape ("highlight",
// "trigger", "boss", ...) is not supported: a config that holds an unknown
// key is a typo (or an old file) and is refused instead of being silently
// read as an empty section.
const STREET_KEYS = ['name', 'mission', 'sections'];
const SECTION_KEYS = ['name', 'onEnter', 'overlays', 'interactions', 'enemies', 'neutrals', 'bosses'];
const OVERLAY_KEYS = ['x', 'y', 'when', 'position'];
const INTERACTION_KEYS = ['id', 'type', 'x1', 'x2', 'when', 'triggers'];
// Where an overlay is drawn: "back" with the background, "front" over the
// characters (e.g. a street light in the foreground).
const OVERLAY_POSITIONS = ['back', 'front'];
const TRIGGER_KEYS = ['when', 'stay', 'effects'];
const ENTITY_KEYS = ['id', 'type', 'x', 'y', 'facing', 'fight', 'presentWhen'];
const FIGHT_KEYS = ['type', 'distance'];

// The terse effect forms: {"mission": 2}, {"item": "beer", "count": 1},
// {"money": -1}, {"flag": "x", "value": true}. The types themselves come from
// the quest layer's vocabulary — the schema and the engine must agree.
const EFFECT_KEYS = {
    mission: ['mission'],
    item: ['item', 'count'],
    money: ['money'],
    flag: ['flag', 'value'],
};

/**
 * Normalizes a raw street config into the Street model.
 * @param {object} raw The parsed content of data/streets/<streetId>.json.
 * @param {string} streetId Street id, e.g. "01-narutowicza".
 * @returns {object} The Street model — {id, name, missionStages, sections}.
 */
export function normalizeStreet(raw, streetId) {
    const source = streetSource(streetId);
    if (!isPlainObject(raw)) {
        fail(streetId, source, '', 'plik nie zawiera obiektu ulicy.');
    }

    checkKeys(raw, STREET_KEYS, streetId, source, '');

    const name = raw.name === undefined || raw.name === null ? streetId : String(raw.name);
    const missionStages = normalizeMissionStages(raw.mission, streetId, source);
    if (!Array.isArray(raw.sections) || raw.sections.length === 0) {
        fail(streetId, source, '', 'pole "sections" musi być niepustą tablicą sekcji.');
    }
    const sections = raw.sections.map((section, index) => (
        normalizeSection(section, streetId, source, index)
    ));

    return { id: streetId, name, missionStages, sections };
}

/* ---------- The street ---------- */

/** The mission stages of a street: one log line per stage. */
function normalizeMissionStages(raw, streetId, source) {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) {
        fail(streetId, source, '', 'pole "mission" musi być tablicą etapów.');
    }
    return raw.map((stage, index) => {
        if (typeof stage !== 'string') {
            fail(streetId, source, '', `pole "mission[${index}]" musi być tekstem.`);
        }
        return stage;
    });
}

/* ---------- The sections ---------- */

/** A section of a street: 1-based number, name and everything it holds. */
function normalizeSection(raw, streetId, source, index) {
    const number = index + 1;
    const context = `sekcja ${number}`;
    if (!isPlainObject(raw)) {
        fail(streetId, source, context, 'musi być obiektem.');
    }
    checkKeys(raw, SECTION_KEYS, streetId, source, context);

    const name = raw.name === undefined || raw.name === null || raw.name === ''
        ? `${streetId} ${number}`
        : String(raw.name);
    const onEnter = normalizeTriggers(raw.onEnter, streetId, source, context);
    const overlays = normalizeOverlays(raw.overlays, streetId, source, context);
    const interactions = normalizeInteractions(raw.interactions, streetId, source, context);
    const enemies = normalizeEntities(raw.enemies, 'enemy', streetId, source, context);
    const neutrals = normalizeEntities(raw.neutrals, 'neutral', streetId, source, context);
    const bosses = normalizeEntities(raw.bosses, 'boss', streetId, source, context);

    return { number, name, onEnter, overlays, interactions, enemies, neutrals, bosses };
}

/** The background overlays of a section: [{x, y, when, position}]. */
function normalizeOverlays(raw, streetId, source, sectionContext) {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) {
        fail(streetId, source, sectionContext, 'pole "overlays" musi być tablicą.');
    }
    return raw.map((overlay, index) => {
        const context = `${sectionContext}, nakładka ${index + 1}`;
        if (!isPlainObject(overlay)) {
            fail(streetId, source, context, 'musi być obiektem.');
        }
        checkKeys(overlay, OVERLAY_KEYS, streetId, source, context);
        // "back" (the default) is drawn with the background, "front" over the
        // characters — e.g. a street light standing in the foreground.
        const position = overlay.position === undefined || overlay.position === null
            ? 'back'
            : String(overlay.position);
        if (!OVERLAY_POSITIONS.includes(position)) {
            fail(
                streetId, source, context,
                `pole "position" ma nieznaną wartość "${position}"`
                + ` (dozwolone: ${OVERLAY_POSITIONS.map(value => `"${value}"`).join(', ')}).`
            );
        }
        return {
            x: requireNumber(overlay.x, 'x', streetId, source, context),
            y: requireNumber(overlay.y, 'y', streetId, source, context),
            when: normalizeCondition(overlay.when, streetId, source, context),
            position,
        };
    });
}

/** The walkable spots of a section: [{id, type, x1, x2, triggers}]. */
function normalizeInteractions(raw, streetId, source, sectionContext) {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) {
        fail(streetId, source, sectionContext, 'pole "interactions" musi być tablicą.');
    }
    return raw.map((interaction, index) => {
        if (!isPlainObject(interaction)) {
            fail(streetId, source, sectionContext, `interakcja ${index + 1} musi być obiektem.`);
        }
        checkKeys(interaction, INTERACTION_KEYS, streetId, source, sectionContext);
        const id = interaction.id;
        if (typeof id !== 'string' || !id.trim()) {
            fail(streetId, source, sectionContext, `interakcja ${index + 1}: pole "id" jest wymagane.`);
        }
        const context = `${sectionContext}, interakcja "${id}"`;
        const type = interaction.type === undefined || interaction.type === null
            ? 'walkable'
            : String(interaction.type);
        if (!INTERACTION_TYPES.includes(type)) {
            fail(
                streetId, source, context,
                `pole "type" ma nieznaną wartość "${type}"`
                + ` (dozwolone: ${INTERACTION_TYPES.map(value => `"${value}"`).join(', ')}).`
            );
        }
        return {
            id,
            type,
            x1: requireNumber(interaction.x1, 'x1', streetId, source, context),
            x2: requireNumber(interaction.x2, 'x2', streetId, source, context),
            // The condition of the spot itself: while it does not hold, the
            // spot is not interactive at all — the player walks over it.
            when: normalizeCondition(interaction.when, streetId, source, context),
            triggers: normalizeTriggers(interaction.triggers, streetId, source, context),
        };
    });
}

/** The entities of a section: enemies, neutral pedestrians and bosses. */
function normalizeEntities(raw, role, streetId, source, sectionContext) {
    const listName = role === 'boss' ? 'bosses' : role === 'neutral' ? 'neutrals' : 'enemies';
    const label = role === 'boss' ? 'boss' : role === 'neutral' ? 'postać neutralna' : 'przeciwnik';
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) {
        fail(streetId, source, sectionContext, `pole "${listName}" musi być tablicą.`);
    }
    return raw.map((entity, index) => {
        if (!isPlainObject(entity)) {
            fail(streetId, source, sectionContext, `${label} ${index + 1} musi być obiektem.`);
        }
        checkKeys(entity, ENTITY_KEYS, streetId, source, sectionContext);
        const id = entity.id;
        if (typeof id !== 'string' || !id.trim()) {
            fail(
                streetId, source, sectionContext,
                `${label} ${index + 1}: pole "id" jest wymagane.`
            );
        }
        const context = `${sectionContext}, ${label} "${id}"`;
        // A type without a character config is not an error: the spawn skips it.
        if (typeof entity.type !== 'string' || !entity.type.trim()) {
            fail(streetId, source, context, 'pole "type" jest wymagane.');
        }
        if (entity.role !== undefined && entity.role !== null && entity.role !== role) {
            fail(streetId, source, context, `pole "role" musi być "${role}".`);
        }
        return {
            id,
            type: entity.type,
            role,
            x: requireNumber(entity.x, 'x', streetId, source, context),
            y: requireNumber(entity.y, 'y', streetId, source, context),
            facing: normalizeFacing(entity.facing, streetId, source, context),
            fight: normalizeFight(entity.fight, streetId, source, context),
            presentWhen: normalizeCondition(entity.presentWhen, streetId, source, context),
            slot: index,
        };
    });
}

/** When a hostile starts to fight: {type, distance}. */
function normalizeFight(raw, streetId, source, context) {
    if (raw === undefined || raw === null) {
        return { type: 'always', distance: null };
    }
    if (!isPlainObject(raw)) {
        fail(streetId, source, context, 'pole "fight" musi być obiektem.');
    }
    checkKeys(raw, FIGHT_KEYS, streetId, source, context);
    const type = raw.type;
    if (typeof type !== 'string' || !FIGHT_TYPES.includes(type)) {
        fail(
            streetId, source, context,
            `pole "fight.type" ma nieznaną wartość "${type}"`
            + ` (dozwolone: ${FIGHT_TYPES.map(value => `"${value}"`).join(', ')}).`
        );
    }
    let distance = null;
    if (raw.distance !== undefined && raw.distance !== null) {
        if (typeof raw.distance !== 'number' || !Number.isFinite(raw.distance)) {
            fail(streetId, source, context, 'pole "fight.distance" musi być liczbą.');
        }
        distance = raw.distance;
    }
    if (type === 'distance' && !(distance !== null && distance > 0)) {
        fail(streetId, source, context, 'pole "fight.distance" musi być dodatnią liczbą.');
    }
    return { type, distance };
}

/**
 * Which way a hostile spawns facing and walking: "left" (the default, like
 * every hostile) or "right". The words and their mirror signs live in the
 * model with the field they describe (FACING in actors/actor.js) — the schema
 * only validates against that table.
 * @returns {number} -1 (left) or 1 (right).
 */
function normalizeFacing(raw, streetId, source, context) {
    if (raw === undefined || raw === null) return FACING.left;
    const facing = String(raw);
    const known = Object.keys(FACING);
    if (!known.includes(facing)) {
        fail(
            streetId, source, context,
            `pole "facing" ma nieznaną wartość "${facing}"`
            + ` (dozwolone: ${known.map(value => `"${value}"`).join(', ')}).`
        );
    }
    return FACING[facing];
}

/* ---------- The triggers ---------- */

/** A list of triggers: [{index, when, stay, effects}]. */
function normalizeTriggers(raw, streetId, source, context) {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) {
        fail(streetId, source, context, 'pole "triggers" musi być tablicą.');
    }
    return raw.map((trigger, index) => {
        if (!isPlainObject(trigger)) {
            fail(streetId, source, triggerContext(context, index), 'musi być obiektem.');
        }
        checkKeys(trigger, TRIGGER_KEYS, streetId, source, triggerContext(context, index));
        let stay = null;
        if (trigger.stay !== undefined && trigger.stay !== null) {
            if (typeof trigger.stay !== 'number' || !Number.isFinite(trigger.stay)) {
                fail(streetId, source, triggerContext(context, index), 'pole "stay" musi być liczbą.');
            }
            stay = trigger.stay;
        }
        return {
            index,
            when: normalizeCondition(trigger.when, streetId, source, triggerContext(context, index)),
            stay,
            effects: normalizeEffects(trigger.effects, streetId, source, triggerContext(context, index)),
        };
    });
}

/**
 * The path of a trigger in the error messages. The trigger index is added
 * only when the list holds more than one trigger — the interaction itself
 * already names the spot.
 */
function triggerContext(context, index) {
    const isInteraction = context.includes('interakcja');
    if (isInteraction) {
        return index > 0 ? `${context}, wyzwalacz ${index}` : context;
    }
    return `${context}, wyzwalacz ${index}`;
}

/* ---------- The conditions ---------- */

/**
 * A condition: {mission, flags, items, money, defeated, position}.
 * All the fields are optional; the ones that are not set are null.
 * @returns {object|null} null when there is no condition (always true).
 */
function normalizeCondition(raw, streetId, source, context) {
    if (raw === undefined || raw === null) return null;
    if (!isPlainObject(raw)) {
        fail(streetId, source, context, 'warunek musi być obiektem.');
    }
    for (const key of Object.keys(raw)) {
        if (!CONDITION_KEYS.includes(key)) {
            fail(streetId, source, context, `nieznany warunek "${key}".`);
        }
    }

    const condition = {
        mission: null,
        flags: null,
        items: null,
        money: null,
        defeated: null,
        position: null,
    };

    if (raw.mission !== undefined && raw.mission !== null) {
        if (!Array.isArray(raw.mission) || !raw.mission.every(isNumber)) {
            fail(streetId, source, context, 'warunek "mission" musi być tablicą numerów etapów.');
        }
        condition.mission = [...raw.mission];
    }

    if (raw.flags !== undefined && raw.flags !== null) {
        if (!isPlainObject(raw.flags) || !Object.values(raw.flags).every(value => typeof value === 'boolean')) {
            fail(streetId, source, context, 'warunek "flags" musi być obiektem flag z wartościami logicznymi.');
        }
        condition.flags = { ...raw.flags };
    }

    if (raw.items !== undefined && raw.items !== null) {
        if (!isPlainObject(raw.items) || !Object.values(raw.items).every(isNumber)) {
            fail(streetId, source, context, 'warunek "items" musi być obiektem ilości przedmiotów.');
        }
        condition.items = { ...raw.items };
    }

    if (raw.money !== undefined && raw.money !== null) {
        if (!isNumber(raw.money)) {
            fail(streetId, source, context, 'warunek "money" musi być liczbą.');
        }
        condition.money = raw.money;
    }

    if (raw.defeated !== undefined && raw.defeated !== null) {
        if (!Array.isArray(raw.defeated) || !raw.defeated.every(id => typeof id === 'string')) {
            fail(streetId, source, context, 'warunek "defeated" musi być tablicą identyfikatorów.');
        }
        condition.defeated = [...raw.defeated];
    }

    if (raw.position !== undefined && raw.position !== null) {
        if (!Array.isArray(raw.position) || raw.position.length !== 2 || !raw.position.every(isNumber)) {
            fail(streetId, source, context, 'warunek "position" musi być parą liczb [x1, x2].');
        }
        condition.position = [raw.position[0], raw.position[1]];
    }

    return condition;
}

/* ---------- The effects ---------- */

/** A list of effects, normalized from the terse JSON form. */
function normalizeEffects(raw, streetId, source, context) {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) {
        fail(streetId, source, context, 'pole "effects" musi być tablicą.');
    }
    return raw.map((effect, index) => normalizeEffect(effect, streetId, source, `${context}, efekt ${index + 1}`));
}

/** One effect, normalized from the terse JSON form into a tagged union. */
function normalizeEffect(raw, streetId, source, context) {
    if (!isPlainObject(raw)) {
        fail(streetId, source, context, 'efekt musi być obiektem.');
    }
    const keys = Object.keys(raw);
    // The terse forms: {"mission": 2}, {"item": "beer", "count": 1},
    // {"money": -1}, {"flag": "x", "value": true}.
    const type = EFFECT_TYPES.find(candidate => keys.includes(candidate));
    if (!type) {
        fail(streetId, source, context, `nieznany efekt "${keys[0] ?? ''}".`);
    }
    for (const key of keys) {
        if (!EFFECT_KEYS[type].includes(key)) {
            fail(streetId, source, context, `nieznany efekt "${key}".`);
        }
    }
    const value = raw[type];

    if (type === 'mission') {
        if (!isNumber(value)) {
            fail(streetId, source, context, 'efekt "mission" musi być numerem etapu.');
        }
        return { type: 'mission', stage: value };
    }

    if (type === 'item') {
        if (typeof value !== 'string' || !value.trim()) {
            fail(streetId, source, context, 'efekt "item" musi mieć identyfikator przedmiotu.');
        }
        const count = raw.count === undefined || raw.count === null ? 1 : raw.count;
        if (!isNumber(count)) {
            fail(streetId, source, context, 'pole "count" efektu "item" musi być liczbą.');
        }
        return { type: 'item', id: value, count };
    }

    if (type === 'money') {
        if (!isNumber(value)) {
            fail(streetId, source, context, 'efekt "money" musi być liczbą.');
        }
        return { type: 'money', amount: value };
    }

    if (type === 'flag') {
        if (typeof value !== 'string' || !value.trim()) {
            fail(streetId, source, context, 'efekt "flag" musi mieć nazwę flagi.');
        }
        const flagValue = raw.value === undefined || raw.value === null ? true : raw.value;
        if (typeof flagValue !== 'boolean') {
            fail(streetId, source, context, 'pole "value" efektu "flag" musi być wartością logiczną.');
        }
        return { type: 'flag', name: value, value: flagValue };
    }
}

/* ---------- Small helpers ---------- */

/** The path of the street config file (used in the error messages). */
function streetSource(streetId) {
    return `data/streets/${streetId}.json`;
}

/** Builds the Polish error of a street config. */
function streetError(streetId, source, message) {
    return new Error(`Ulica "${streetId}" (${source}): ${message}`);
}

/** Throws the Polish error of a street config; the context is the JSON path. */
function fail(streetId, source, context, message) {
    throw streetError(streetId, source, context ? `${context}: ${message}` : message);
}

/** Refuses a config that holds a key the schema does not know. */
function checkKeys(raw, allowed, streetId, source, context) {
    for (const key of Object.keys(raw)) {
        if (!allowed.includes(key)) {
            fail(streetId, source, context, `nieznane pole "${key}".`);
        }
    }
}

function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function requireNumber(value, field, streetId, source, context) {
    if (!isNumber(value)) {
        fail(streetId, source, context, `pole "${field}" musi być liczbą.`);
    }
    return value;
}
