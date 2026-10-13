// src/save/State.js
//
// State.js
//
// This class stores game data that does not reset when changing locations:
// quests, inventory, money, world flags and character statistics. Statistics
// are seeded from the character config files (see main.js). There is no save
// system — the game is session-only (owner decision 2026-10-11).
//
// The main character is named "Rudy".

export default class State {
    constructor() {
        this.quests = {};      // { questId: questObject }
        this.inventory = {};   // { itemId: { item, qty } }
        this.money = 0;
        this.flags = {};       // { flagName: boolean }
        this.stats = {};       // { characterName: statsObject }, seeded from character config
        this.playTimeMs = 0;   // session game timer (shown on the game over screen)
        // Defeated enemies persist as corpses across section visits:
        // enemyId -> { x, y, facing } (session-only, like everything else).
        this.defeatedEnemies = new Map();
    }

    /** Records a kill so the corpse is still lying there on later visits. */
    markEnemyDefeated(id, { x, y, facing }) {
        if (id == null) return;
        this.defeatedEnemies.set(id, { x, y, facing });
    }

    /** @returns {{x:number,y:number,facing:number}|null} Where the corpse lies. */
    getDefeatedEnemy(id) {
        return this.defeatedEnemies.get(id) ?? null;
    }

    /**
     * Condition check for world entities (boss spawn/fight triggers):
     * every listed flag must be set/unset and every listed item carried.
     * @param {{flagsTrue?:string[], flagsFalse?:string[], hasItem?:string[]}} conditions
     */
    matchesConditions(conditions = {}) {
        const { flagsTrue = [], flagsFalse = [], hasItem = [] } = conditions;
        return flagsTrue.every(flag => Boolean(this.flags[flag]))
            && flagsFalse.every(flag => !this.flags[flag])
            && hasItem.every(id => Boolean(this.inventory[id]));
    }

    /**
     * Starts a fresh game: only the character config seeds stats and money.
     * There is no save system — this is the whole restart story.
     * @param {object} playerDef The player character config.
     */
    resetForNewGame(playerDef) {
        this.quests = {};
        this.inventory = {};
        this.money = playerDef.money ?? 0;
        this.flags = {};
        this.stats = { [playerDef.name]: { hp: playerDef.hp, maxHp: playerDef.hp, kills: 0 } };
        this.playTimeMs = 0;
        this.defeatedEnemies = new Map();
    }

    /* Quest helpers */
    addQuest(id, quest) {
        this.quests[id] = quest;
    }

    removeQuest(id) {
        delete this.quests[id];
    }

    /* Inventory helpers */
    addItem(id, item, quantity = 1) {
        if (!this.inventory[id]) {
            this.inventory[id] = { item, qty: 0 };
        }
        this.inventory[id].qty += quantity;
    }

    removeItem(id, quantity = 1) {
        const entry = this.inventory[id];
        if (!entry) return;
        entry.qty -= quantity;
        if (entry.qty <= 0) {
            delete this.inventory[id];
        }
    }

    /* Money helpers */
    addMoney(amount) {
        this.money += amount;
    }

    /* Flag helpers */
    setFlag(name, value) {
        this.flags[name] = value;
    }

    getFlag(name) {
        return this.flags[name];
    }

    /* Stats helpers */
    getStats(name) {
        return this.stats[name];
    }
}
