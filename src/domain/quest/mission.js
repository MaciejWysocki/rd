// src/domain/quest/mission.js
//
// mission.js
//
// The mission of the current street. Everything comes from the street config's
// "mission" field — an array of log lines, where the index IS the mission
// stage:
//
//   "mission": ["Kup piwo", "Znajdź ustronne miejsce aby wypić piwo", "Pokonaj żula"]
//
// Stage 0 is where the street starts (entered automatically with the street).
// The stage is moved by the triggers of the sections and interactions: a
// "mission" effect sets the stage directly (advanceTo), so the mission logic
// stays in the config and nowhere else. A defeated boss moves the mission on
// as well (the app layer, play-screen.js): its objective is done.
//
// A stage BEYOND the last one (a stage with no log line of its own) means
// "the street is over" — that is how a config ends a street (e.g. the
// mission of four lines is advanced to 4).

export default class Mission {
    /** @param {string[]} stages One log line per mission stage. */
    constructor(stages = []) {
        this.stages = [...stages];
        this.stage = 0;
    }

    /** The log line of the current stage (null when the stage has no line). */
    get current() {
        return this.stages[this.stage] ?? null;
    }

    /** The index of the last stage — the mission's end. */
    get lastStage() {
        return Math.max(0, this.stages.length - 1);
    }

    /**
     * True when the mission was advanced PAST its last stage: the stage has
     * no log line of its own. That is how a config ends a street — the mission
     * is moved beyond its end (e.g. {"mission": 4} of a four-line mission).
     * @returns {boolean}
     */
    get isPastEnd() {
        return this.stages[this.stage] === undefined;
    }

    /**
     * The mission-log rows for the HUD: the objective that is still open — the
     * line of the current stage. A finished objective disappears: the next
     * stage takes its place (owner 2026-10-21 — the log sits above the game
     * area and shows the open objective only).
     * @returns {string[]} The rows (empty when the mission has no line left).
     */
    get logRows() {
        const line = this.stages[this.stage];
        return line ? [line] : [];
    }

    /**
     * Sets the mission stage (absolute — not a transition map).
     * @param {number} stage The stage to move to.
     * @returns {boolean} true when the stage changed.
     */
    advanceTo(stage) {
        const next = Number(stage);
        if (!Number.isFinite(next)) {
            throw new Error(`Nieprawidłowy etap misji: "${stage}".`);
        }
        if (next === this.stage) return false;
        this.stage = next;
        return true;
    }

    /**
     * @param {number} stage The stage to test.
     * @returns {boolean} true when the mission is on that stage.
     */
    isAt(stage) {
        return this.stage === stage;
    }
}
