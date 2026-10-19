// src/world/world-manager.js

/**
 * world-manager.js
 *
 * The world: the streets of the game and the section the player is in.
 *
 * A street is a JSON file (data/streets/<number>-<name>.json) holding a list
 * of sections placed from left to right. The player walks between the
 * neighbouring sections; the ends of the street are walled (section.js).
 * There is no route any more: the sections of a file are simply its sections.
 *
 * The streets themselves are played one after another, in file-name order
 * (see street-registry.js): the game ends when the last street is finished.
 */

import Section from './section.js';

export default class WorldManager {
    /**
     * @param {State} state Global persistent state shared with sections.
     */
    constructor(state) {
        this.state = state;
        this.streetFiles = [];    // street config file names, in play order
        this.streetIndex = -1;
        this.streetId = null;     // e.g. "01-narutowicza" — the asset/name convention
        this.streetName = null;   // the display name from the config, e.g. "Narutowicza"
        this.sections = [];
        this.sectionIndex = -1;
        this.currentSection = null;
    }

    /** @param {string[]} files Street config file names (without .json), in play order. */
    setStreets(files) {
        this.streetFiles = [...files];
    }

    /** True when a street follows the current one. */
    get hasNextStreet() {
        return this.streetIndex + 1 < this.streetFiles.length;
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
        if (index < 0 || index >= this.streetFiles.length) {
            throw new RangeError(`Indeks ulicy poza zakresem: ${index}`);
        }

        const id = this.streetFiles[index];
        const config = await loadJson(`data/streets/${id}.json`);
        const sectionConfigs = config.sections ?? [];
        if (sectionConfigs.length === 0) {
            throw new Error(`Ulica ${id} nie ma żadnych sekcji`);
        }

        await this.leaveCurrent();
        this.streetIndex = index;
        this.streetId = id;
        this.streetName = config.name ?? id;
        this.state.setMission(config.mission ?? []);
        this.sections = sectionConfigs.map((sectionConfig, i) => new Section(id, i, sectionConfig, {
            hasPrevious: i > 0,
            hasNext: i < sectionConfigs.length - 1,
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
        await section.enter(this.state);
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
     * True when the street is finished: the player is in its last section and
     * there is nothing left to do there — the boss is down (its defeat is
     * recorded in the world flags), or the section has no boss and the
     * mission has reached its last stage.
     */
    isStreetComplete() {
        const last = this.sections[this.sections.length - 1];
        if (!last || this.sectionIndex !== this.sections.length - 1) return false;

        const bossId = last.config.boss?.id;
        if (bossId) return Boolean(this.state.getFlag(`${this.streetId}_${bossId}_defeated`));

        return this.state.mission.stage >= this.state.mission.lastStage;
    }

    /** Leaves the active section, if any. */
    async leaveCurrent() {
        if (this.currentSection) {
            this.currentSection.leave();
            this.currentSection = null;
        }
    }
}

/** Reads a JSON config file, with a Polish error when it cannot be read. */
async function loadJson(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Nie można wczytać pliku ${path}: HTTP ${response.status}`);
    }
    return response.json();
}
