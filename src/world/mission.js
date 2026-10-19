// src/world/mission.js
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
// The stage moves on through the transition maps of the config — { "0": 1 }
// means "while the mission is on stage 0, move it to stage 1". Those maps live
// in the section and interaction triggers, so the mission logic stays in the
// config and nowhere else.

export default class Mission {
    /** @param {string[]} logs One log line per mission stage. */
    constructor(logs = []) {
        this.logs = [...logs];
        this.stage = 0;
    }

    /** The log line of the current stage (null when the stage has no line). */
    get current() {
        return this.logs[this.stage] ?? null;
    }

    /** The index of the last stage — the mission's end. */
    get lastStage() {
        return Math.max(0, this.logs.length - 1);
    }

    /**
     * Applies a transition map from the config ({ "0": 1 }): the stage moves
     * to the mapped stage when the mission is on the mapped "from" stage.
     * @param {object|null|undefined} map
     * @returns {boolean} true when the stage changed.
     */
    apply(map) {
        if (!map) return false;
        for (const [from, to] of Object.entries(map)) {
            if (Number(from) === this.stage) {
                this.stage = Number(to);
                return true;
            }
        }
        return false;
    }

    /**
     * The mission-log rows for the HUD: the street's opening objective on the
     * first row, the current objective on the second one (once the mission
     * has moved past the first stage).
     */
    get displayLogs() {
        const rows = [];
        if (this.logs[0]) rows.push(this.logs[0]);
        if (this.stage > 0 && this.logs[this.stage]) rows.push(this.logs[this.stage]);
        return rows;
    }
}
