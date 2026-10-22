// src/domain/quest/session.js
//
// session.js
//
// The session aggregate: everything that survives a section change — the
// mission of the current street, the inventory, the purse, the world flags,
// the character statistics, the play timer and the state of the hostiles
// (where they stand and where they fell). There are no saves: the session
// lives for one play-through (owner decision 2026-10-11).
//
// The statistics are seeded from the player character config, so the player is
// the only character that ever appears in them.
//
// The state of the hostiles lives in their own store (hostile-states.js) —
// the session owns it, but the store owns the keys and the bookkeeping.

import Mission from './mission.js';
import HostileStates from './hostile-states.js';

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
        // The state of the hostiles survives the section they stand in: where
        // they stand and whether they lie dead. Keyed by the hostile's
        // identity: "<street>/<section>/<role>/<id>#<slot>"
        // (session-only, like everything else).
        this._hostileStates = new HostileStates();
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

    /** The character statistics: { characterName: { hp, maxHp, kills } }. */
    get stats() {
        return this._stats;
    }

    /** The session game timer in ms (shown on the game over screen). */
    get playTimeMs() {
        return this._playTimeMs;
    }

    /** @param {number} value The new value of the game timer. */
    set playTimeMs(value) {
        const ms = Number(value);
        this._playTimeMs = Number.isFinite(ms) ? ms : 0;
    }

    /** The random hues of the hostiles: a new set for every game. */
    get huePool() {
        return this._huePool;
    }

    /** The state of the hostiles (the store — see hostile-states.js). */
    get hostileStates() {
        return this._hostileStates;
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
     * The last one is gone for good: the entry leaves the inventory, so the
     * item disappears from the HUD as well.
     * @param {string} id The item's id.
     * @param {number} qty How many items.
     */
    removeItem(id, qty = 1) {
        const entry = this._inventory[id];
        if (!entry) return;
        entry.qty = Math.max(0, entry.qty - qty);
        if (entry.qty === 0) delete this._inventory[id];
    }

    /**
     * @param {string} id The item's id.
     * @returns {number} How many of the item are carried (0 when it is not carried).
     */
    countItem(id) {
        return this._inventory[id]?.qty ?? 0;
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

    /* The state of the hostiles */

    /**
     * Remembers where a hostile stands, so it is still there on the next visit
     * to the section — it does not jump back to its post.
     * @param {object} identity The hostile's identity (see hostileIdentity).
     * @param {{x:number,y:number,facing:number,direction:number}} state Where it stands.
     */
    saveHostile(identity, state) {
        this._hostileStates.save(identity, state);
    }

    /**
     * The state of a hostile: where it stands and whether it lies dead.
     * @param {object} identity The hostile's identity (see hostileIdentity).
     * @returns {object|null} The state, or null when the hostile was never seen.
     */
    getHostile(identity) {
        return this._hostileStates.get(identity);
    }

    /**
     * Records a kill so the corpse is still lying there on later visits.
     * @param {object} identity The hostile's identity (see hostileIdentity).
     * @param {{x:number,y:number,facing:number}} position Where the body lies.
     */
    markDefeated(identity, position) {
        this._hostileStates.markDefeated(identity, position);
    }

    /**
     * @param {string} streetId The entity belongs to.
     * @param {string} id The entity's label.
     * @param {number|null} [slot] The entity's place in the list (null = any slot).
     * @returns {boolean} true when the entity lies dead in the street.
     */
    isDefeated(streetId, id, slot) {
        return this._hostileStates.isDefeated(streetId, id, slot);
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
        this._hostileStates.clear();
    }
}
