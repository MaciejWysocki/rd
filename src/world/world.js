// src/world/world.js
//
// world.js
//
// The world: the streets of the game and the section the player is in.
//
// A street is a JSON file (data/streets/<number>-<name>.json) holding a list
// of sections placed from left to right. The player walks between the
// neighbouring sections; the ends of the street are walled (section.js).
// There is no route any more: the sections of a file are simply its sections.
//
// The streets themselves are played one after another, in file-name order
// (see content-repository.js): the game ends when the last street is finished.
// A street is finished when the mission has been advanced PAST its last stage
// (the config ends a street that way) and no boss of the street is still
// standing.
//
// The world also owns the **trigger context** — the snapshot of the world
// the conditions and the effects of the config are read against. There is
// exactly one builder of it (context()), so every reader sees the same
// world: the sections, the entities and the play screen all ask the world
// for it.

import Section from './section.js';
import { matchesCondition } from '../domain/quest/triggers.js';

export default class World {
    /**
     * @param {Session} session The session — the mission, the flags, the corpses.
     * @param {ContentRepository} content The content repository (the street and character configs).
     */
    constructor(session, content) {
        this.session = session;
        this.content = content;
        this.streetIds = [];   // the street ids, in play order
        this.streetIndex = -1;
        this.street = null;    // the street model of the current street
        this.sections = [];
        this.sectionIndex = -1;
        this.currentSection = null;
        this.player = null;    // the player — the context needs him
        // The context is rebuilt in place (one object, no allocation per
        // frame) and handed out to every reader of the world.
        this._context = {
            session: this.session,
            mission: null,
            player: null,
            streetId: null,
        };
    }

    /** @param {string[]} ids Street ids, in play order. */
    setStreets(ids) {
        this.streetIds = [...ids];
    }

    /**
     * Sets the player the context is built around. The player belongs to
     * the running game, not to the world — the world only knows him so that
     * the conditions can ask where he stands.
     * @param {Player} player The player.
     */
    setPlayer(player) {
        this.player = player;
    }

    /** The id of the current street, e.g. "01-narutowicza" — the asset/name convention. */
    get streetId() {
        return this.street?.id ?? null;
    }

    /** True when a street follows the current one. */
    get hasNextStreet() {
        return this.streetIndex + 1 < this.streetIds.length;
    }

    /** True when a section follows the current one (the street goes on to the right). */
    get hasNextSection() {
        return this.sectionIndex + 1 < this.sections.length;
    }

    /** True when a section precedes the current one (the street goes on to the left). */
    get hasPreviousSection() {
        return this.sectionIndex > 0;
    }

    /**
     * The context of the triggers: the session, the current mission, the
     * player and the current street. The conditions of the config are read
     * against it. It is the same object every time — the fields are refreshed
     * on every call.
     * @returns {{session:object, mission:object, player:object|null, streetId:string}}
     */
    context() {
        this._context.mission = this.session.mission;
        this._context.player = this.player;
        this._context.streetId = this.streetId;
        return this._context;
    }

    /**
     * Loads a street and enters its first section. The street's mission
     * (the config's "mission" field) becomes the current mission.
     * @param {number} index Position in the street list.
     */
    async gotoStreet(index) {
        if (index < 0 || index >= this.streetIds.length) {
            throw new RangeError(`Indeks ulicy poza zakresem: ${index}`);
        }

        const id = this.streetIds[index];
        const street = await this.content.getStreet(id);
        if (street.sections.length === 0) {
            throw new Error(`Ulica ${id} nie ma żadnych sekcji`);
        }

        await this.leaveCurrent();
        this.streetIndex = index;
        this.street = street;
        this.session.setMission(street.missionStages);
        this.sections = street.sections.map((model, i) => new Section(street, model, {
            hasPrevious: i > 0,
            hasNext: i < street.sections.length - 1,
            content: this.content,
        }));
        this.sectionIndex = -1;
        await this.gotoSection(0);
    }

    /** Moves to the section at the given position. */
    async gotoSection(index) {
        if (index < 0 || index >= this.sections.length) {
            throw new RangeError(`Indeks sekcji poza zakresem: ${index}`);
        }

        const section = this.sections[index];
        await this.leaveCurrent();

        this.sectionIndex = index;
        this.currentSection = section;
        await section.enter(this.session, this.context());
    }

    /** The section to the right. */
    next() {
        return this.gotoSection(this.sectionIndex + 1);
    }

    /** The section to the left. */
    prev() {
        return this.gotoSection(this.sectionIndex - 1);
    }

    /** The next street of the game. */
    nextStreet() {
        return this.gotoStreet(this.streetIndex + 1);
    }

    /**
     * True when the street is finished: the mission was advanced PAST its last
     * stage (a stage with no log line of its own — that is how a config ends
     * a street) and no boss of the street is still standing. A boss that is
     * not present any more (its "presentWhen" no longer holds) does not block
     * the street.
     */
    isStreetComplete() {
        if (!this.street) return false;
        if (!this.session.mission.isPastEnd) return false;
        return !this.street.sections.some(section =>
            section.bosses.some(boss => this._bossBlocks(section, boss)));
    }

    /** True when the boss is present in the world and has not been defeated yet. */
    _bossBlocks(section, boss) {
        if (boss.presentWhen && !matchesCondition(boss.presentWhen, this.context())) return false;
        const state = this.session.getHostile(this._bossIdentity(section, boss));
        return !state?.defeated;
    }

    /** The identity of a boss in the state store of the session. */
    _bossIdentity(section, boss) {
        return {
            streetId: this.street.id,
            section: section.number,
            role: 'boss',
            id: boss.id,
            slot: boss.slot,
        };
    }

    /** Leaves the active section, if any. */
    async leaveCurrent() {
        if (this.currentSection) {
            this.currentSection.leave(this.session);
            this.currentSection = null;
        }
    }
}
