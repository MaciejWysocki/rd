// src/save/State.js
//
// State.js
//
// This class stores game data that does not reset when changing locations:
// the mission, the inventory, money, world flags and character statistics.
// Statistics are seeded from the character config files (see main.js). There
// is no save system — the game is session-only (owner decision 2026-10-11).
//
// The main character is named "Rudy".

import Mission from '../world/mission.js';

/** The identity of a street entity: its label plus its place in the section. */
function corpseKey(streetId, id, slot) {
    return slot == null ? `${streetId}/${id}` : `${streetId}/${id}#${slot}`;
}

export default class State {
    constructor() {
        this.mission = new Mission(); // the mission of the current street
        this.inventory = {};   // { itemId: { item, qty } }
        this.money = 0;
        this.flags = {};       // { flagName: boolean }
        this.stats = {};       // { characterName: statsObject }, seeded from character config
        this.playTimeMs = 0;   // session game timer (shown on the game over screen)
        // Defeated enemies persist as corpses across section visits:
        // "<street>/<enemyId>" -> { x, y, facing } (session-only, like everything else).
        this.defeatedEnemies = new Map();
    }

    /** Starts the mission of a street: the log lines and the first stage. */
    setMission(logs) {
        this.mission = new Mission(logs);
    }

    /** The mission-log rows for the HUD (the street's mission config). */
    get missionLogs() {
        return this.mission.displayLogs;
    }

    /**
     * Records a kill so the corpse is still lying there on later visits.
     * @param {string} streetId The street the entity belongs to.
     * @param {string} id The entity's label.
     * @param {number|null} slot The entity's place in the section (null for a boss) —
     *        it tells two entities with the same id apart, so each keeps its own body.
     * @param {{x:number,y:number,facing:number}} position Where the body lies.
     */
    markEnemyDefeated(streetId, id, slot, { x, y, facing }) {
        if (id == null) return;
        this.defeatedEnemies.set(corpseKey(streetId, id, slot), { x, y, facing });
    }

    /** @returns {{x:number,y:number,facing:number}|null} Where the corpse lies. */
    getDefeatedEnemy(streetId, id, slot) {
        return this.defeatedEnemies.get(corpseKey(streetId, id, slot)) ?? null;
    }

    /**
     * Starts a fresh game: only the character config seeds stats and money.
     * There is no save system — this is the whole restart story.
     * @param {object} playerDef The player character config.
     */
    resetForNewGame(playerDef) {
        this.mission = new Mission();
        this.inventory = {};
        this.money = playerDef.money ?? 0;
        this.flags = {};
        this.stats = { [playerDef.name]: { hp: playerDef.hp, maxHp: playerDef.hp, kills: 0 } };
        this.playTimeMs = 0;
        this.defeatedEnemies = new Map();
    }

    /* Flag helpers */
    setFlag(name, value) {
        this.flags[name] = value;
    }

    getFlag(name) {
        return this.flags[name];
    }

    /* Inventory helpers */
    addItem(id, quantity = 1) {
        if (!this.inventory[id]) this.inventory[id] = { item: id, qty: 0 };
        this.inventory[id].qty += quantity;
    }

    /* Money helpers */
    /** Pays a price — the purse never goes below zero. */
    spendMoney(amount) {
        this.money = Math.max(0, this.money - amount);
    }
}
