// src/save/State.js

/**
 * State.js
 *
 * This class stores persistent game data that does not reset when changing locations.
 * It keeps track of quests, inventory, money, world flags, and character statistics.
 * The main character is named "Rudy".
 */

export default class State {
    constructor() {
        // Persistent data structures
        this.quests = {};          // { questId: questObject }
        this.inventory = {};        // { itemId: {item, qty} }
        this.money = 0;               // player money
        this.flags = {};            // { flagName: boolean }
        this.stats = {};            // { characterName: statsObject }

        // Default stats for the main hero Rudy
        this.stats.Rudy = {
            hp: 100,
            maxHp: 100,
            mp: 50,
            maxMp: 50,
            strength: 10,
            agility: 10,
            intelligence: 10,
            level: 1,
            experience: 0,
        };
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

    /* Serialise state for debugging / persistence */
    serialize() {
        return JSON.stringify(this, null, 2);
    }
}
