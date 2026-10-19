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
// stays in the config and nowhere else.

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
     * The mission-log rows for the HUD: the street's opening objective on the
     * first row, the current objective on the second one (once the mission
     * has moved past the first stage).
     * @returns {string[]} The rows (empty when the mission has no log lines).
     */
    get logRows() {
        const rows = [];
        if (this.stages[0]) rows.push(this.stages[0]);
        if (this.stage > 0 && this.stages[this.stage]) rows.push(this.stages[this.stage]);
        return rows;
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
