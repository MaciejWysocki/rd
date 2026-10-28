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
// the state of the hostiles) live in the session and are never touched here.
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
//   neutrals   — the neutral pedestrians of the section
//   bosses      — the bosses of the section

import Enemy from '../domain/actors/enemy.js';
import Neutral from '../domain/actors/neutral.js';
import SpriteSheet from '../render/sprite-sheet.js';
import Vomit from '../render/vomit.js';
import { planEntityHues } from './entity-hues.js';
import { FRAME_SIZE, spritePath, backgroundPath } from '../domain/content/asset-conventions.js';
import { applyEffects, matchesCondition } from '../domain/quest/triggers.js';
import { CANVAS_W, CANVAS_H, WALL_W, PATROL_X_MIN, PATROL_X_MAX } from './layout.js';

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
        this._fightSolids = null; // the boundaries + the barriers of a boss fight
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
        this._fightSolids = null;
        this._applyTriggers(context);
        this.enemies = await this._spawnEnemies(session, context);
        this.interactions = this.model.interactions.map(interaction => ({ ...interaction }));

        this.active = true;
    }

    /**
     * Resets section memory: the enemies and the walkable spots. The state of
     * the hostiles goes to the session — where they stood stays where they
     * stood, so the next visit finds them there.
     * @param {Session} session The session the hostiles' state is kept in.
     */
    leave(session) {
        for (const enemy of this.enemies) {
            if (enemy.defeated) continue; // the corpse was recorded where it fell
            session.saveHostile(this._identity(enemy), {
                x: enemy.x,
                y: enemy.y,
                facing: enemy.facing,
                direction: enemy.direction,
            });
        }
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

    /**
     * The solids of the section: the walls of the street ends. While a boss
     * fight is on, the **invisible barriers of the visible area** join them:
     * they are the very same walls the ends of a street have, so the player
     * and the hostiles stop exactly as they do at the end of the street —
     * nobody walks out of the screen during the fight (owner 2026-10-21).
     * @param {boolean} fighting True while a boss of the section is fighting.
     * @returns {Array<{x:number,y:number,w:number,h:number}>} The solids.
     */
    solids(fighting = false) {
        if (!fighting) return this.boundaries;
        if (!this._fightSolids) {
            this._fightSolids = [
                ...this.boundaries,
                { x: 0, y: 0, w: WALL_W, h: CANVAS_H },
                { x: CANVAS_W - WALL_W, y: 0, w: WALL_W, h: CANVAS_H },
            ];
        }
        return this._fightSolids;
    }

    /** Applies the section's own triggers — e.g. the mission moving on when the player enters. */
    _applyTriggers(context) {
        for (const trigger of this.model.onEnter) {
            if (!matchesCondition(trigger.when, context)) continue;
            applyEffects(trigger.effects, context);
        }
    }

    /**
     * Spawns the entities of the section: enemies, neutral pedestrians and bosses. A type
     * without a character config is not implemented yet and is skipped. An
     * entity with a "presentWhen" condition exists only while the condition
     * holds — the mission decides what is in the world. The state of a hostile
     * is persisted in the session: on re-entry a dead one is still lying where
     * it fell instead of a fresh enemy appearing, and a living one still
     * stands where the player left it instead of jumping back to its post.
     * A body stays on the street even when its condition no longer holds —
     * the boss keeps his corpse after his stage is over.
     *
     * Two hostiles of the same type get different colors: the first one of a
     * type keeps the original colors, every further copy of it gets one of
     * the random hues of the game (entity-hues.js), so the player can tell
     * them apart — in the street and in the HUD.
     */
    async _spawnEnemies(session, context) {
        const entities = [
            ...this.model.enemies.map(entity => ({ ...entity, role: 'enemy' })),
            ...this.model.neutrals.map(entity => ({ ...entity, role: 'neutral' })),
            ...this.model.bosses.map(entity => ({ ...entity, role: 'boss' })),
        ];

        // The hostiles that are really in the world: the ones whose condition
        // holds and whose type is implemented — plus the ones that FELL here:
        // their body lies where it fell, even when their condition no longer
        // holds (the boss keeps his corpse on the street after his stage is
        // over, exactly like the other enemies).
        const spawnable = [];
        for (const entity of entities) {
            if (!matchesCondition(entity.presentWhen, context) && !this._fellHere(session, entity)) continue;
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
            const ActorClass = entity.role === 'neutral' ? Neutral : Enemy;
            const enemy = new ActorClass({
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
                facing: entity.facing,
                // A patrolling hostile walks the whole section, wherever it spawns.
                patrolX1: PATROL_X_MIN,
                patrolX2: PATROL_X_MAX,
            });
            await enemy.load();

            const state = session.getHostile(this._identity(entity));
            if (state?.defeated) enemy.spawnDefeated(state); // the body lies where it fell
            else if (state) enemy.restoreState(state); // it stands where the player left it

            enemies.push(enemy);
        }
        return enemies;
    }

    /**
     * The identity of a hostile in the state store of the session: the
     * street, the section, the list it comes from, its label and its place
     * in that list.
     * @param {object} entity The entity (an enemy, neutral or boss of the model).
     * @returns {object} The identity.
     */
    _identity(entity) {
        return {
            streetId: this.street.id,
            section: this.number,
            role: entity.role,
            id: entity.id,
            slot: entity.slot,
        };
    }

    /**
     * True when this hostile fell in this section: its body lies where it
     * fell and it stays there — even when its condition ("presentWhen") no
     * longer holds. The boss is the case that needs it: his stage ends with
     * his death, but his corpse belongs to the street like the body of any
     * other enemy.
     * @param {Session} session The session (the state of the hostiles).
     * @param {object} entity The entity model of the section.
     * @returns {boolean}
     */
    _fellHere(session, entity) {
        const state = session.getHostile(this._identity(entity));
        return Boolean(state?.defeated);
    }
}
