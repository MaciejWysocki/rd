// src/domain/content/character-schema.js
//
// Normalizes a character config (data/characters/<type>.json) into the
// Character model of the domain. The config file is the only source of truth
// for a character's statistics and move set; the model is what the actors,
// the combat and the HUD work with.
//
// The module is pure: it reads a plain object and returns a plain object —
// no fetch, no DOM. The file name is the character's type (lysy-blokers ->
// data/characters/lysy-blokers.json); a type without a config file is simply
// not implemented and never reaches this module.
//
// Sprite-sheet convention (150x150 frames, one animation per row):
//   row 0            - the walk cycle, 8 frames
//   a move's row     - one attack = the move's "frames" frames (default 4); a
//                      move with "alternate" holds two such groups in the row
//   the death row    - the fall, deathFrames frames

import { ATTACK_FRAMES, WALK_FRAMES } from './asset-conventions.js';
import { PATROL, SENTRY } from '../actors/behavior.js';

// The AI behaviours a character config may name — the strategies of
// domain/actors/behavior.js. The schema accepts exactly those.
const BEHAVIORS = [PATROL, SENTRY];

const DEFAULT_WALK_FRAME_MS = 80;
const DEFAULT_ATTACK_HOLD_MS = 150;
const DEFAULT_RECOVERY_MS = 700;
const DEFAULT_DEATH_FRAMES = 4;
const DEFAULT_MONEY = 0;

const MOVE_TYPES = ['headbutt', 'punch', 'kick', 'vomit'];
const RANGED_MOVE_TYPE = 'vomit'; // the only move that does not hit with a fist

/**
 * Builds the Polish error of a character config.
 * The character is named by the file (the type), the file by its path.
 * @param {string} source Path of the config file, e.g. "data/characters/lysy-blokers.json".
 * @param {string} message Polish message, e.g. 'pole "hp" musi być liczbą dodatnią.'
 * @returns {Error}
 */
export function characterError(source, message) {
    return new Error(`Postać "${characterLabel(source)}" (${source}): ${message}`);
}

/**
 * Normalizes a raw character config into the Character model.
 * @param {object} raw The parsed content of data/characters/<type>.json.
 * @param {string} source Path of the config file (used in the error messages).
 * @returns {object} The Character model — every field is present.
 */
export function normalizeCharacter(raw, source) {
    if (!isPlainObject(raw)) {
        throw characterError(source, 'plik nie zawiera obiektu postaci.');
    }

    const name = requireString(raw.name, 'name', source);
    const sprite = raw.sprite === undefined || raw.sprite === null
        ? name
        : requireString(raw.sprite, 'sprite', source);
    const hp = requirePositiveNumber(raw.hp, 'hp', source);
    const maxHp = raw.maxHp === undefined || raw.maxHp === null
        ? hp
        : requirePositiveNumber(raw.maxHp, 'maxHp', source);
    const money = raw.money === undefined || raw.money === null
        ? DEFAULT_MONEY
        : requireNumber(raw.money, 'money', source);
    const walkSpeed = requireNumber(raw.walkSpeed, 'walkSpeed', source);
    const walkFrameMs = optionalNumber(raw.walkFrameMs, 'walkFrameMs', source) ?? DEFAULT_WALK_FRAME_MS;
    const attackFrameMs = requireNumber(raw.attackFrameMs, 'attackFrameMs', source);
    const attackHoldMs = optionalNumber(raw.attackHoldMs, 'attackHoldMs', source) ?? DEFAULT_ATTACK_HOLD_MS;
    const recoveryMs = optionalNumber(raw.recoveryMs, 'recoveryMs', source) ?? DEFAULT_RECOVERY_MS;
    const hitbox = normalizeHitbox(raw.hitbox, source);
    const deathRow = normalizeDeathRow(raw.deathRow, source);
    const deathFrames = optionalNumber(raw.deathFrames, 'deathFrames', source) ?? DEFAULT_DEATH_FRAMES;
    const bloodOnTarget = normalizeBloodOnTarget(raw.bloodOnTarget, source);
    const behavior = normalizeBehavior(raw.behavior, source);
    const moves = normalizeMoves(raw.moves, source);
    const jump = normalizeJump(raw, source);
    const attackKind = moves.some(move => move.type === RANGED_MOVE_TYPE) ? 'ranged' : 'melee';
    const framesPerRow = deriveFramesPerRow(moves, deathRow, deathFrames);

    return {
        name,
        sprite,
        hp,
        maxHp,
        money,
        walkSpeed,
        walkFrameMs,
        attackFrameMs,
        attackHoldMs,
        recoveryMs,
        hitbox,
        deathRow,
        deathFrames,
        bloodOnTarget,
        behavior,
        attackKind,
        moves,
        jump,
        walkFrames: WALK_FRAMES,
        attackFrames: ATTACK_FRAMES,
        framesPerRow,
    };
}

/* ---------- The parts of the model ---------- */

/**
 * The number of frames of every sprite-sheet row.
 * Rows: the walk row (0), one row per move and the death row. A move's row
 * holds one attack of `frames` frames (4 by default); an "alternate" move
 * holds two such groups and switches groups on every other attack. The walk
 * row has 8 frames, the death row has the frames of the fall.
 * @param {object[]} moves The normalized move list.
 * @param {number|null} deathRow The row of the fall animation.
 * @param {number} deathFrames The number of frames of the fall.
 * @returns {number[]} Frames per row.
 */
function deriveFramesPerRow(moves, deathRow, deathFrames) {
    const rows = Math.max(0, ...moves.map(move => move.row), deathRow ?? -1) + 1;
    const rowFrames = Array.from({ length: rows }, () => ATTACK_FRAMES);
    rowFrames[0] = WALK_FRAMES;
    for (const move of moves) {
        rowFrames[move.row] = Math.max(rowFrames[move.row], move.frames * (move.alternate ? 2 : 1));
    }
    if (deathRow !== null) rowFrames[deathRow] = deathFrames;
    return rowFrames;
}

/** The collision box of a character: {x, y, w, h}. */
function normalizeHitbox(raw, source) {
    if (!isPlainObject(raw)) {
        throw characterError(source, 'pole "hitbox" musi mieć cztery liczby (x, y, w, h).');
    }
    const box = {};
    for (const key of ['x', 'y', 'w', 'h']) {
        if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key])) {
            throw characterError(source, 'pole "hitbox" musi mieć cztery liczby (x, y, w, h).');
        }
        box[key] = raw[key];
    }
    return box;
}

/** The row of the fall animation; null when the character has no fall row. */
function normalizeDeathRow(raw, source) {
    if (raw === undefined || raw === null) return null;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        throw characterError(source, 'pole "deathRow" musi być liczbą.');
    }
    return raw;
}

/** Whether the character's blows make the target bleed. */
function normalizeBloodOnTarget(raw, source) {
    if (raw === undefined || raw === null) return true;
    if (typeof raw !== 'boolean') {
        throw characterError(source, 'pole "bloodOnTarget" musi być wartością logiczną.');
    }
    return raw;
}

/** The AI behaviour of a character: "patrol" (the default) or "sentry". */
function normalizeBehavior(raw, source) {
    if (raw === undefined || raw === null) return 'patrol';
    if (typeof raw !== 'string' || !BEHAVIORS.includes(raw)) {
        throw characterError(
            source,
            `pole "behavior" ma nieznaną wartość "${raw}" (dozwolone: ${BEHAVIORS.map(behavior => `"${behavior}"`).join(', ')}).`
        );
    }
    return raw;
}

/** The move set of a character: [{key, row, type, frames, hitFrame, alternate}]. */
function normalizeMoves(raw, source) {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) {
        throw characterError(source, 'pole "moves" musi być tablicą.');
    }
    return raw.map((move, index) => {
        if (!isPlainObject(move)) {
            throw characterError(source, `pole "moves[${index}]" musi być obiektem.`);
        }
        if (typeof move.row !== 'number' || !Number.isFinite(move.row) || move.row < 0) {
            throw characterError(source, `pole "moves[${index}].row" musi być liczbą.`);
        }
        if (typeof move.type !== 'string' || !move.type) {
            throw characterError(source, `pole "moves[${index}].type" jest wymagane.`);
        }
        if (!MOVE_TYPES.includes(move.type)) {
            throw characterError(
                source,
                `pole "moves[${index}].type" ma nieznaną wartość "${move.type}"`
                + ` (dozwolone: ${MOVE_TYPES.map(type => `"${type}"`).join(', ')}).`
            );
        }
        const key = move.key === undefined || move.key === null ? null : String(move.key);
        const frames = move.frames === undefined || move.frames === null
            ? ATTACK_FRAMES
            : requirePositiveNumber(move.frames, `moves[${index}].frames`, source);
        const hitFrame = move.hitFrame === undefined || move.hitFrame === null
            ? frames - 1
            : move.hitFrame;
        if (!Number.isInteger(hitFrame) || hitFrame < 0 || hitFrame > frames - 1) {
            throw characterError(source, `pole "moves[${index}].hitFrame" musi być liczbą całkowitą od 0 do ${frames - 1}.`);
        }
        const alternate = move.alternate === undefined || move.alternate === null
            ? false
            : Boolean(move.alternate);
        return { key, row: move.row, type: move.type, frames, hitFrame, alternate };
    });
}

/** The jump of a character: {key, durationMs, heightPx} or null. */
function normalizeJump(raw, source) {
    if (raw.jumpKey === undefined || raw.jumpKey === null || raw.jumpKey === '') return null;
    return {
        key: String(raw.jumpKey),
        durationMs: optionalNumber(raw.jumpDurationMs, 'jumpDurationMs', source) ?? 0,
        heightPx: optionalNumber(raw.jumpHeightPx, 'jumpHeightPx', source) ?? 0,
    };
}

/* ---------- Small helpers ---------- */

/** The name of the character in the error messages: the file name without the extension. */
function characterLabel(source) {
    const file = String(source).split(/[\\/]/).pop() ?? String(source);
    return file.replace(/\.json$/i, '') || String(source);
}

function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value, field, source) {
    if (typeof value !== 'string' || !value.trim()) {
        throw characterError(source, `pole "${field}" jest wymagane.`);
    }
    return value;
}

function requireNumber(value, field, source) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw characterError(source, `pole "${field}" musi być liczbą.`);
    }
    return value;
}

function requirePositiveNumber(value, field, source) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw characterError(source, `pole "${field}" musi być liczbą dodatnią.`);
    }
    return value;
}

function optionalNumber(value, field, source) {
    if (value === undefined || value === null) return null;
    return requireNumber(value, field, source);
}
