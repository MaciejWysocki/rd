// src/world/section.js

/**
 * section.js
 *
 * A single section of a street. Owns the background image, the collision
 * boundaries and the transient entities (enemies, boss, interactions).
 *
 * Transient data is rebuilt from the street JSON on enter() and wiped on
 * leave(). Persistent changes (the mission, the inventory, world flags, the
 * corpses of the defeated) live in the global State and are never touched here.
 *
 * The section config (data/streets/<street>.json):
 *   name       — the place shown in the section
 *   trigger    — what happens when the section is entered
 *                ({ "on": "enter", "mission": { "1": 2 } } moves the mission
 *                from stage 1 to stage 2)
 *   highlight  — background overlays: { x, y, position: [x1, x2], mission: [stages] }
 *   interactions — the walkable spots of the section
 *   enemies    — the enemies of the section
 *   boss       — the boss of the section
 */

import Enemy from '../actors/enemy.js';
import Boss from '../actors/boss.js';
import { loadCharacterDef } from '../actors/character-defs.js';

// The canvas is fixed (index.html): 1600x800 world pixels.
const CANVAS_W = 1600;
const CANVAS_H = 800;
const WALL_W = 40; // the width of the wall that closes the ends of the street

export default class Section {
    /**
     * @param {string} streetId   Street file name, e.g. "01-narutowicza".
     * @param {number} index      Position of the section in the street (0 = leftmost).
     * @param {object} config     Section definition taken from the street JSON.
     * @param {object} neighbours
     * @param {boolean} neighbours.hasPrevious A section lies to the left.
     * @param {boolean} neighbours.hasNext     A section lies to the right.
     */
    constructor(streetId, index, config, { hasPrevious, hasNext }) {
        this.streetId = streetId;
        this.index = index;
        this.number = index + 1; // the section number used in the asset names
        this.name = config.name ?? `${streetId} ${this.number}`;
        this.config = config;
        this.hasPrevious = hasPrevious;
        this.hasNext = hasNext;

        // Convention: assets/bg/<street>-<section>.png
        this.backgroundPath = `assets/bg/${streetId}-${this.number}.png`;

        // Convention: assets/bg/<street>-<section>-<highlight>.png
        this.highlights = (config.highlight ?? []).map((highlight, i) => ({
            ...highlight,
            image: `assets/bg/${streetId}-${this.number}-${i + 1}.png`,
        }));

        // Runtime state (reset on leave)
        this.background = null;
        this.boundaries = [];
        this.interactions = [];
        this.enemies = [];
        this.boss = null;
        this.active = false;
    }

    /**
     * Pipeline: background -> boundaries -> enemies -> section trigger -> boss -> interactions.
     * @param {State} state Global persistent state (the mission, the corpses).
     */
    async enter(state) {
        if (this.active) return;

        this.background = await this._loadBackground();
        this.boundaries = this._buildBoundaries();
        this.enemies = await this._spawnEnemies(state);
        this._applyTrigger(state);
        this.boss = await this._spawnBoss(state);
        this.interactions = this._loadInteractions();

        this.active = true;
    }

    /**
     * Resets section memory: enemies, boss and interactions.
     * Does not touch the global State.
     */
    leave() {
        this.enemies = [];
        this.boss = null;
        this.interactions = [];
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

    /**
     * The walls of the section: the street is closed on the left when no
     * section lies before it, and on the right when no section lies after it.
     * Everything in between is open — the player walks from section to section.
     */
    _buildBoundaries() {
        const walls = [];
        if (!this.hasPrevious) walls.push({ x: 0, y: 0, w: WALL_W, h: CANVAS_H });
        if (!this.hasNext) walls.push({ x: CANVAS_W - WALL_W, y: 0, w: WALL_W, h: CANVAS_H });
        return walls;
    }

    /** Applies the section's own trigger — e.g. the mission moving on when the player enters. */
    _applyTrigger(state) {
        const trigger = this.config.trigger;
        if (!trigger) return;
        if (trigger.on !== 'enter') {
            throw new Error(`Sekcja ${this.name}: nieobsługiwany odzew "${trigger.on}"`);
        }
        state.mission.apply(trigger.mission);
    }

    async _spawnEnemies(state) {
        const enemies = [];
        for (const [slot, config] of (this.config.enemies ?? []).entries()) {
            // Types without a character config file are not implemented yet and are skipped.
            const def = await loadCharacterDef(config.type);
            if (!def) continue;
            const enemy = new Enemy({
                x: config.x,
                y: config.y,
                def,
                id: config.id,
                trigger: config.trigger,
                distance: config.distance,
                slot,
            });
            await enemy.load();
            // A kill is persisted in the global State: on re-entry the corpse is
            // still lying where it fell instead of a fresh enemy appearing.
            // The slot tells two enemies with the same id apart.
            const corpse = state.getDefeatedEnemy(this.streetId, config.id, slot);
            if (corpse) enemy.spawnDefeated(corpse);
            enemies.push(enemy);
        }
        return enemies;
    }

    /**
     * Spawns the section boss when the mission is on one of the stages listed
     * in its config ("mission": [1, 2]). The boss stands idle until its fight
     * trigger is met (see boss.js) — the trigger is evaluated by the gameplay
     * state, not here.
     */
    async _spawnBoss(state) {
        const config = this.config.boss;
        if (!config) return null;
        if (config.mission && !config.mission.includes(state.mission.stage)) return null;

        // Types without a character config file are not implemented yet and are skipped.
        const def = await loadCharacterDef(config.type);
        if (!def) return null;

        const boss = new Boss({
            x: config.x,
            y: config.y,
            def,
            id: config.id,
            trigger: config.trigger,
            distance: config.distance,
        });
        await boss.load();
        // A kill is persisted in the global State: the body stays where it fell.
        const corpse = state.getDefeatedEnemy(this.streetId, config.id, null);
        if (corpse) boss.spawnDefeated(corpse);
        return boss;
    }

    /** The walkable spots of the section — the only interaction type for now. */
    _loadInteractions() {
        return (this.config.interactions ?? [])
            .filter(interaction => interaction.type === 'walkable')
            .map(interaction => ({ ...interaction }));
    }
}
