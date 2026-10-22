// src/domain/quest/hostile-states.js
//
// hostile-states.js — where the hostiles of the game stand and where they
// fell. The store is a part of the session (session-only, like everything
// else): it survives a section change, so a living hostile is still where
// the player left it and a dead one still lies where it fell.
//
// The identity of a hostile is the street, the section, the list it comes
// from ("enemies" / "bosses"), its label and its place in that list. Two
// hostiles with the same label in one section keep their own place — and so
// do the same labels in two sections.

/**
 * The identity of a hostile.
 * @param {string} streetId The street the hostile belongs to.
 * @param {number} section The section number (1-based).
 * @param {string} role 'enemy' or 'boss' — the list the hostile comes from.
 * @param {string} id The hostile's label.
 * @param {number} slot The hostile's place in that list.
 * @returns {object} The identity of the hostile.
 */
export function hostileIdentity(streetId, section, role, id, slot) {
    return { streetId, section, role, id, slot };
}

export default class HostileStates {
    constructor() {
        this._states = new Map();
    }

    /**
     * The key of a hostile's state.
     * @param {object} identity The hostile's identity.
     * @returns {string} The key.
     */
    key({ streetId, section, role, id, slot }) {
        return `${streetId}/${section}/${role}/${id}#${slot}`;
    }

    /**
     * Remembers where a hostile stands, so it is still there on the next
     * visit to the section — it does not jump back to its post.
     * @param {object} identity The hostile's identity.
     * @param {{x:number,y:number,facing:number,direction:number}} state Where it stands.
     */
    save(identity, { x, y, facing, direction }) {
        if (identity.id == null) return;
        const previous = this._states.get(this.key(identity));
        this._states.set(this.key(identity), {
            ...identity,
            x, y, facing, direction,
            // A hostile that fell stays fallen — a living state never revives it.
            defeated: previous?.defeated ?? false,
        });
    }

    /**
     * The state of a hostile: where it stands and whether it lies dead.
     * @param {object} identity The hostile's identity.
     * @returns {{x:number,y:number,facing:number,direction:number,defeated:boolean}|null}
     *          The state, or null when the hostile was never seen.
     */
    get(identity) {
        if (identity.id == null) return null;
        return this._states.get(this.key(identity)) ?? null;
    }

    /**
     * Records a kill so the corpse is still lying there on later visits.
     * @param {object} identity The hostile's identity.
     * @param {{x:number,y:number,facing:number}} position Where the body lies.
     */
    markDefeated(identity, { x, y, facing }) {
        if (identity.id == null) return;
        const previous = this._states.get(this.key(identity));
        this._states.set(this.key(identity), {
            ...identity,
            x, y, facing,
            direction: previous?.direction ?? 0,
            defeated: true,
        });
    }

    /**
     * @param {string} streetId The entity belongs to.
     * @param {string} id The entity's label.
     * @param {number|null} slot The entity's place in the list (null = any slot).
     * @returns {boolean} true when the entity lies dead in the street.
     */
    isDefeated(streetId, id, slot) {
        if (id == null) return false;
        for (const state of this._states.values()) {
            if (!state.defeated) continue;
            if (state.streetId !== streetId || state.id !== id) continue;
            if (slot != null && state.slot !== slot) continue;
            return true;
        }
        return false;
    }

    /** The number of hostiles the store knows about. */
    get size() {
        return this._states.size;
    }

    /** Wipes the store — a new game starts with the hostiles at their posts. */
    clear() {
        this._states.clear();
    }
}
