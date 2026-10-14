// src/world/WorldManager.js

/**
 * WorldManager.js
 *
 * Loads a street definition from JSON and moves the player along its route.
 * A street is an ordered route of section ids, which may repeat
 * (e.g. ["01", "02", "01"]). Only one section is active at a time.
 */

import Section from './section.js';

export default class WorldManager {
    /**
     * @param {State} state Global persistent state shared with sections.
     */
    constructor(state) {
        this.state = state;
        this.streetName = null;
        this.route = [];
        this.sections = new Map();   // sectionId -> Section
        this.routeIndex = -1;
        this.currentSection = null;
    }

    /**
     * Loads a street JSON file and prepares its sections. Does not enter any section.
     * @param {string|URL} url
     */
    async loadStreet(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Nie można wczytać ulicy ${url}: HTTP ${response.status}`);
        }
        const data = await response.json();

        const sections = new Map();
        for (const [id, config] of Object.entries(data.sections ?? {})) {
            sections.set(id, new Section(data.street, id, config));
        }

        for (const id of data.route ?? []) {
            if (!sections.has(id)) {
                throw new Error(`Ulica ${data.street}: trasa wskazuje na nieistniejącą sekcję "${id}"`);
            }
        }

        await this.leaveCurrent();
        this.streetName = data.street;
        this.route = data.route ?? [];
        this.sections = sections;
        this.routeIndex = -1;
    }

    /** Moves to the section at the given route position. */
    async goToRouteIndex(index) {
        if (index < 0 || index >= this.route.length) {
            throw new RangeError(`Indeks trasy poza zakresem: ${index}`);
        }

        const section = this.sections.get(this.route[index]);
        await this.leaveCurrent();

        this.routeIndex = index;
        this.currentSection = section;
        await section.enter(this.state);
    }

    next() {
        return this.goToRouteIndex(this.routeIndex + 1);
    }

    prev() {
        return this.goToRouteIndex(this.routeIndex - 1);
    }

    /** Leaves the active section, if any. */
    async leaveCurrent() {
        if (this.currentSection) {
            this.currentSection.leave();
            this.currentSection = null;
        }
    }
}
