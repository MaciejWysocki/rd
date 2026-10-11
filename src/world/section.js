// src/world/Section.js

/**
 * Section.js
 *
 * A single section of a street. Owns the background image, collision boundaries
 * and transient entities (regular NPCs, enemies, boss, corpses).
 *
 * Transient data is rebuilt from the street JSON on enter() and wiped on leave().
 * Persistent changes (quests, flags, inventory) live in the global State and are
 * never touched here.
 */

import Enemy from '../actors/enemy.js';
import { loadCharacterDef } from '../actors/character-defs.js';

export default class Section {
    /**
     * @param {string} streetName  Street name, e.g. "ulica-01".
     * @param {string} id          Section number, e.g. "01".
     * @param {object} config      Section definition taken from the street JSON.
     */
    constructor(streetName, id, config) {
        this.streetName = streetName;
        this.id = id;
        this.name = config.name ?? `${streetName} ${id}`;
        this.config = config;

        // Convention: assets/bg/<street>_<section>.png
        this.backgroundPath = `assets/bg/${streetName}_${id}.png`;

        // Runtime state (reset on leave)
        this.background = null;
        this.boundaries = [];
        this.interactions = [];
        this.npcs = [];
        this.enemies = [];
        this.boss = null;
        this.corpses = [];
        this.active = false;
    }

    /**
     * Pipeline: background -> boundaries -> NPCs -> enemies -> boss check -> interactions.
     * @param {State} state Global persistent state, used for boss conditions.
     */
    async enter(state) {
        if (this.active) return;

        this.background = await this._loadBackground();
        this.boundaries = this._setBoundaries();
        this.npcs = this._spawnNpcs();
        this.enemies = await this._spawnEnemies();
        this.boss = this._checkBoss(state);
        this.interactions = this._loadInteractions();

        this.active = true;
    }

    /**
     * Resets section memory: regular NPCs, enemies, boss and corpses.
     * Does not touch the global State.
     */
    leave() {
        this.npcs = [];
        this.enemies = [];
        this.boss = null;
        this.corpses = [];
        this.active = false;
    }

    /* ---------- Pipeline steps ---------- */

    _loadBackground() {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Nie można wczytać tła: ${this.backgroundPath}`));
            img.src = this.backgroundPath;
        });
    }

    _setBoundaries() {
        return (this.config.boundaries ?? []).map(b => ({ ...b }));
    }

    _spawnNpcs() {
        return (this.config.npcs ?? []).map(n => ({ ...n }));
    }

    async _spawnEnemies() {
        const enemies = [];
        for (const config of this.config.enemies ?? []) {
            // Types without a character config file are not implemented yet and are skipped.
            const def = await loadCharacterDef(config.type);
            if (!def) continue;
            const enemy = new Enemy({ x: config.x, y: config.y, def });
            await enemy.load();
            enemies.push(enemy);
        }
        return enemies;
    }

    _checkBoss(state) {
        const boss = this.config.boss;
        if (!boss) return null;

        const { flagsTrue = [], flagsFalse = [] } = boss.conditions ?? {};
        const trueOk = flagsTrue.every(flag => Boolean(state.getFlag(flag)));
        const falseOk = flagsFalse.every(flag => !state.getFlag(flag));

        return trueOk && falseOk ? { ...boss } : null;
    }

    _loadInteractions() {
        return (this.config.interactions ?? []).map(i => ({ ...i }));
    }
}
