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
// A street is finished when the mission has reached its last stage and no
// boss of the street is still standing.

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
    }

    /** @param {string[]} ids Street ids, in play order. */
    setStreets(ids) {
        this.streetIds = [...ids];
    }

    /** The id of the current street, e.g. "01-narutowicza" — the asset/name convention. */
    get streetId() {
        return this.street?.id ?? null;
    }

    /** The display name of the current street, e.g. "Narutowicza". */
    get streetName() {
        return this.street?.name ?? null;
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
     * True when the street is finished: the mission has reached its last stage
     * and no boss of the street is still standing. A boss that is not present
     * any more (its "presentWhen" no longer holds) does not block the street.
     */
    isStreetComplete() {
        if (!this.street) return false;
        if (this.session.mission.stage < this.session.mission.lastStage) return false;
        return !this.street.sections.some(section =>
            section.bosses.some(boss => this._bossBlocks(section, boss)));
    }

    /** True when the boss is present in the world and has not been defeated yet. */
    _bossBlocks(section, boss) {
        if (boss.presentWhen && !matchesCondition(boss.presentWhen, this.context())) return false;
        const state = this.session.getHostile(this.street.id, section.number, 'boss', boss.id, boss.slot);
        return !state?.defeated;
    }

    /**
     * The context of the triggers: the session, the current mission, the
     * player and the current street. The conditions of the config are read
     * against it.
     */
    context(player = null) {
        return {
            session: this.session,
            mission: this.session.mission,
            player,
            streetId: this.streetId,
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
