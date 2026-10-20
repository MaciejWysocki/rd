// src/world/section.js
//
// section.js
//
// A single section of a street — the runtime side of the content model.
// It owns the background image, the collision boundaries and the transient
// entities (the enemies) and the walkable spots.
//
// Transient data is rebuilt from the street model on enter() and wiped on
// leave(). Persistent changes (the mission, the inventory, the world flags,
// the corpses of the defeated) live in the session and are never touched here.
//
// The enter pipeline: background -> boundaries -> section triggers -> entities
// -> interactions. The triggers run first, so the entities that are present
// (their "presentWhen" condition) and the spots of the section match the
// state of the world the player just entered.
//
// The section model (data/streets/<street>.json, schema v2):
//   name        — the place shown in the section
//   onEnter     — the triggers fired when the player enters the section
//   overlays    — background overlays: { x, y, when }
//   interactions — the walkable spots of the section
//   enemies     — the hostiles of the section
//   bosses      — the bosses of the section

import Enemy from '../domain/actors/enemy.js';
import SpriteSheet from '../render/sprite-sheet.js';
import Vomit from '../render/vomit.js';
import { planEntityHues } from './entity-hues.js';
import { FRAME_SIZE, spritePath, backgroundPath } from '../domain/content/asset-conventions.js';
import { applyEffects, matchesCondition } from '../domain/quest/triggers.js';

// The canvas is fixed (index.html): 1600x800 world pixels.
const CANVAS_W = 1600;
const CANVAS_H = 800;
const WALL_W = 40; // the width of the wall that closes the ends of the street

export default class Section {
    /**
     * @param {object} street   The street model (id, name, sections).
     * @param {object} model    The section model (number, name, onEnter, overlays, ...).
     * @param {object} options
     * @param {boolean} options.hasPrevious A section lies to the left.
     * @param {boolean} options.hasNext     A section lies to the right.
     * @param {ContentRepository} options.content The content repository (character configs).
     */
    constructor(street, model, { hasPrevious, hasNext, content }) {
        this.street = street;
        this.model = model;
        this.number = model.number; // the section number used in the asset names
        this.name = model.name;
        this.hasPrevious = hasPrevious;
        this.hasNext = hasNext;
        this.content = content;

        // Runtime state (reset on leave)
        this.background = null;
        this.boundaries = [];
        this.interactions = [];
        this.enemies = [];
        this.active = false;
    }

    /**
     * Pipeline: background -> boundaries -> triggers -> entities -> interactions.
     * @param {Session} session The session (the mission, the corpses).
     * @param {object} context The trigger context: { session, mission, player, streetId }.
     */
    async enter(session, context) {
        if (this.active) return;

        this.background = await this._loadBackground();
        this.boundaries = this._buildBoundaries();
        this._applyTriggers(context);
        this.enemies = await this._spawnEnemies(session, context);
        this.interactions = this.model.interactions.map(interaction => ({ ...interaction }));

        this.active = true;
    }

    /**
     * Resets section memory: the enemies and the walkable spots.
     * Does not touch the session.
     */
    leave() {
        this.enemies = [];
        this.interactions = [];
        this.active = false;
    }

    /* ---------- Pipeline steps ---------- */

    _loadBackground() {
        const path = backgroundPath(this.street.id, this.number);
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Nie można wczytać tła: ${path}`));
            img.src = path;
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

    /** Applies the section's own triggers — e.g. the mission moving on when the player enters. */
    _applyTriggers(context) {
        for (const trigger of this.model.onEnter) {
            if (!matchesCondition(trigger.when, context)) continue;
            applyEffects(trigger.effects, context);
        }
    }

    /**
     * Spawns the hostiles of the section: the enemies and the bosses. A type
     * without a character config is not implemented yet and is skipped. An
     * entity with a "presentWhen" condition exists only while the condition
     * holds — the mission decides what is in the world. A kill is persisted in
     * the session: on re-entry the corpse is still lying where it fell instead
     * of a fresh enemy appearing.
     *
     * Two hostiles of the same type get different colors: the first one of a
     * type keeps the original colors, every further copy of it gets one of
     * the random hues of the game (entity-hues.js), so the player can tell
     * them apart — in the street and in the HUD.
     */
    async _spawnEnemies(session, context) {
        const entities = [
            ...this.model.enemies.map(entity => ({ ...entity, role: 'enemy' })),
            ...this.model.bosses.map(entity => ({ ...entity, role: 'boss' })),
        ];

        // The hostiles that are really in the world: the ones whose condition
        // holds and whose type is implemented.
        const spawnable = [];
        for (const entity of entities) {
            if (!matchesCondition(entity.presentWhen, context)) continue;
            const character = await this.content.getCharacter(entity.type);
            if (!character) continue; // not implemented yet
            spawnable.push({ entity, character });
        }

        const hues = planEntityHues(spawnable.map(({ entity }) => entity), session.huePool);

        const enemies = [];
        for (let i = 0; i < spawnable.length; i++) {
            const { entity, character } = spawnable[i];
            const hue = hues[i];

            const sheet = new SpriteSheet(
                spritePath(character.sprite),
                FRAME_SIZE,
                character.framesPerRow,
                hue,
            );
            const enemy = new Enemy({
                x: entity.x,
                y: entity.y,
                character,
                sheet,
                id: entity.id,
                role: entity.role,
                trigger: entity.fight,
                slot: entity.slot,
                projectile: character.attackKind === 'ranged' ? new Vomit() : null,
                hue,
            });
            await enemy.load();

            const corpse = session.getDefeated(this.street.id, entity.id, entity.slot);
            if (corpse) enemy.spawnDefeated(corpse);

            enemies.push(enemy);
        }
        return enemies;
    }
}
