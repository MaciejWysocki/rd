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
import Boss from '../actors/boss.js';
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
        this.enemies = await this._spawnEnemies(state);
        this.boss = await this._spawnBoss(state);
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

    async _spawnEnemies(state) {
        const enemies = [];
        for (const config of this.config.enemies ?? []) {
            // Types without a character config file are not implemented yet and are skipped.
            const def = await loadCharacterDef(config.type);
            if (!def) continue;
            const enemy = new Enemy({ x: config.x, y: config.y, def, id: config.id });
            await enemy.load();
            // A kill is persisted in the global State: on re-entry the corpse is
            // still lying where it fell instead of a fresh enemy appearing.
            const corpse = state.getDefeatedEnemy(config.id);
            if (corpse) enemy.spawnDefeated(corpse);
            enemies.push(enemy);
        }
        return enemies;
    }

    /**
     * Spawns the section boss when its conditions (flags + carried items) pass.
     * The boss stands idle until its fight trigger is met (see boss.js) — the
     * trigger is evaluated by the gameplay state, not here.
     */
    async _spawnBoss(state) {
        const config = this.config.boss;
        if (!config) return null;
        if (!state.matchesConditions(config.conditions)) return null;

        // Types without a character config file are not implemented yet and are skipped.
        const def = await loadCharacterDef(config.type);
        if (!def) return null;

        const boss = new Boss({ x: config.x, y: config.y, def, id: config.id, trigger: config.trigger });
        await boss.load();
        return boss;
    }

    _loadInteractions() {
        return (this.config.interactions ?? []).map(i => ({ ...i }));
    }
}
