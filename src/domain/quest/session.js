// src/domain/quest/session.js
//
// session.js
//
// The session aggregate: everything that survives a section change — the
// mission of the current street, the inventory, the purse, the world flags,
// the character statistics, the play timer and the corpses of the defeated
// hostiles. There are no saves: the session lives for one play-through
// (owner decision 2026-10-11).
//
// The statistics are seeded from the player character config, so the player is
// the only character that ever appears in them.

import Mission from './mission.js';

// How many random hues a game draws — the copies of the hostiles take them
// one by one (world/entity-hues.js). Far more than a section needs.
const HUE_POOL_SIZE = 48;

/**
 * Draws the random hues of a game: the angles on the color wheel that the
 * copies of the hostiles are colored with.
 * @returns {number[]} The angles in degrees.
 */
function drawHuePool() {
    const pool = [];
    for (let i = 0; i < HUE_POOL_SIZE; i++) pool.push(Math.random() * 360);
    return pool;
}

/**
 * The identity of a defeated entity: its label plus its place in the section.
 * @param {string} streetId The street the entity belongs to.
 * @param {string} id The entity's label.
 * @param {number|null} slot The entity's place in the section (null for a boss) —
 *        it tells two entities with the same id apart, so each keeps its own body.
 * @returns {string} The corpse key.
 */
function corpseKey(streetId, id, slot) {
    return slot == null ? `${streetId}/${id}` : `${streetId}/${id}#${slot}`;
}

export default class Session {
    constructor() {
        this._mission = new Mission();      // the mission of the current street
        this._inventory = {};               // { itemId: { item, qty } }
        this._money = 0;
        this._flags = {};                   // { flagName: boolean }
        this._stats = {};                   // { characterName: { hp, maxHp, kills } }
        this._playTimeMs = 0;               // session game timer (the game over screen)
        // The random hues of the world: the copies of the hostiles are colored
        // with them (world/entity-hues.js). They are drawn anew for every
        // game and stay for the whole playthrough — the street looks
        // different in every game, but a hostile keeps its colors within one.
        this._huePool = drawHuePool();
        // Defeated hostiles persist as corpses across section visits:
        // "<street>/<id>" -> { x, y, facing } (session-only, like everything else).
        this._defeatedEntities = new Map();
    }

    /** The mission of the current street. */
    get mission() {
        return this._mission;
    }

    /**
     * Starts the mission of a street: the log lines and the first stage.
     * @param {string[]} stages The log line of every stage of the street.
     */
    setMission(stages) {
        this._mission = new Mission(stages);
    }

    /** The mission-log rows for the HUD (the street's mission config). */
    get logRows() {
        return this._mission.logRows;
    }

    /** The purse (in coins). */
    get money() {
        return this._money;
    }

    /** @param {number} value The new purse content (never below zero). */
    set money(value) {
        const amount = Number(value);
        this._money = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    }

    /** The carried items: { itemId: { item, qty } }. */
    get inventory() {
        return this._inventory;
    }

    /** The world flags: { flagName: boolean }. */
    get flags() {
        return this._flags;
    }

    /** The character statistics: { characterName: { hp, maxHp, kills } }. */
    get stats() {
        return this._stats;
    }

    /** The session game timer in ms (shown on the game over screen). */
    get playTimeMs() {
        return this._playTimeMs;
    }

    /** The random hues of the hostiles: a new set for every game. */
    get huePool() {
        return this._huePool;
    }

    /** @param {number} value The new value of the game timer. */
    set playTimeMs(value) {
        const ms = Number(value);
        this._playTimeMs = Number.isFinite(ms) ? ms : 0;
    }

    /** The corpses of the defeated hostiles: Map<key, { x, y, facing }>. */
    get defeatedEntities() {
        return this._defeatedEntities;
    }

    /* Inventory helpers */

    /**
     * Puts an item into the inventory.
     * @param {string} id The item's id.
     * @param {number} qty How many items.
     */
    addItem(id, qty = 1) {
        if (!this._inventory[id]) this._inventory[id] = { item: id, qty: 0 };
        this._inventory[id].qty += qty;
    }

    /**
     * Takes an item out of the inventory — the count never goes below zero.
     * @param {string} id The item's id.
     * @param {number} qty How many items.
     */
    removeItem(id, qty = 1) {
        const entry = this._inventory[id];
        if (!entry) return;
        entry.qty = Math.max(0, entry.qty - qty);
    }

    /**
     * @param {string} id The item's id.
     * @returns {number} How many of the item are carried (0 when it is not carried).
     */
    countItem(id) {
        return this._inventory[id]?.qty ?? 0;
    }

    /**
     * @param {string} id The item's id.
     * @param {number} qty How many items.
     * @returns {boolean} true when at least that many items are carried.
     */
    hasItem(id, qty = 1) {
        return this.countItem(id) >= qty;
    }

    /* Money helpers */

    /**
     * Pays a price — the purse never goes below zero.
     * @param {number} amount How much to pay.
     */
    spendMoney(amount = 0) {
        const value = Number(amount);
        if (!Number.isFinite(value)) return;
        this.money = Math.max(0, this._money - value);
    }

    /**
     * Earns money — the purse never goes below zero.
     * @param {number} amount How much to earn.
     */
    addMoney(amount = 0) {
        const value = Number(amount);
        if (!Number.isFinite(value)) return;
        this.money = Math.max(0, this._money + value);
    }

    /* Flag helpers */

    /**
     * @param {string} name The flag's name.
     * @param {boolean} value The flag's value.
     */
    setFlag(name, value) {
        this._flags[name] = value;
    }

    /**
     * @param {string} name The flag's name.
     * @returns {boolean|undefined} The flag's value (undefined when it is not set).
     */
    getFlag(name) {
        return this._flags[name];
    }

    /* Corpses of the defeated hostiles */

    /**
     * Records a kill so the corpse is still lying there on later visits.
     * @param {string} streetId The street the entity belongs to.
     * @param {string} id The entity's label.
     * @param {number|null} slot The entity's place in the section (null for a boss).
     * @param {{x:number,y:number,facing:number}} position Where the body lies.
     */
    markDefeated(streetId, id, slot, { x, y, facing }) {
        if (id == null) return;
        this._defeatedEntities.set(corpseKey(streetId, id, slot), { x, y, facing });
    }

    /**
     * @param {string} streetId The street the entity belongs to.
     * @param {string} id The entity's label.
     * @param {number|null} slot The entity's place in the section (null = any slot).
     * @returns {boolean} true when the entity lies dead in the street.
     */
    isDefeated(streetId, id, slot) {
        if (id == null) return false;
        if (slot != null) return this._defeatedEntities.has(corpseKey(streetId, id, slot));
        const base = `${streetId}/${id}`;
        for (const key of this._defeatedEntities.keys()) {
            if (key === base || key.startsWith(`${base}#`)) return true;
        }
        return false;
    }

    /**
     * @param {string} streetId The street the entity belongs to.
     * @param {string} id The entity's label.
     * @param {number|null} slot The entity's place in the section (null for a boss).
     * @returns {{x:number,y:number,facing:number}|null} Where the corpse lies.
     */
    getDefeated(streetId, id, slot) {
        return this._defeatedEntities.get(corpseKey(streetId, id, slot)) ?? null;
    }

    /* Statistics helpers */

    /**
     * Counts a kill in the statistics of a character.
     * @param {string} characterName The character's name.
     */
    recordKill(characterName) {
        const stats = this._stats[characterName];
        if (!stats) return;
        stats.kills = (stats.kills ?? 0) + 1;
    }

    /**
     * Stores the current HP of a character.
     * @param {string} characterName The character's name.
     * @param {number} hp The character's HP.
     */
    setHp(characterName, hp) {
        const stats = this._stats[characterName];
        if (!stats) return;
        stats.hp = hp;
    }

    /**
     * Starts a fresh game: only the character config seeds money and stats.
     * There is no save system — this is the whole restart story.
     * @param {object} character The player character model
     *        ({ name, hp, maxHp?, money? }).
     */
    resetForNewGame(character) {
        this._mission = new Mission();
        this._inventory = {};
        this.money = character.money ?? 0;
        this._flags = {};
        this._stats = {
            [character.name]: {
                hp: character.hp,
                maxHp: character.maxHp ?? character.hp,
                kills: 0,
            },
        };
        this._playTimeMs = 0;
        this._huePool = drawHuePool(); // a new look for every game
        this._defeatedEntities = new Map();
    }
}
