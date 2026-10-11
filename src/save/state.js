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
