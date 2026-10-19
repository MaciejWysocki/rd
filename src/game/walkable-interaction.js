// src/game/walkable-interaction.js

/**
 * walkable-interaction.js
 *
 * A walkable interaction: a spot of the section (from x1 to x2) the player
 * enters by pressing Up. Rudy then walks into the spot, disappears in it for
 * the "stay" time of the trigger and walks back out. While the sequence runs
 * the player has no control.
 *   enter  - walks into the spot, rising slightly (ENTER_MS)
 *   inside - hidden; the trigger's stay time passes (STAY)
 *   exit   - reappears in the spot, facing left, walks back and settles
 *            onto the line (EXIT_MS)
 *
 * The trigger of an interaction is a list of behaviours, one per mission
 * stage: the first entry whose "mission" map starts at the current stage wins,
 * an entry without a "mission" map is the fallback for every other stage.
 * The behaviour may move the mission on ({ "0": 1 }) and may hand out an item
 * for a price ("give" / "cost") — that exchange happens MISSION_LEAD_MS before
 * Rudy leaves the spot, so the player sees the new objective (and the new
 * inventory) while he is still inside.
 *
 * The sound of the interaction is played by the caller when Rudy disappears in
 * the spot, by convention:
 * assets/sounds/<street>-<interaction>-<trigger number>.mp3
 */

const ENTER_MS = 1000;
const EXIT_MS = 1000;
const DEFAULT_STAY_MS = 1000;
const MISSION_LEAD_MS = 300; // the exchange happens this long before the exit
const ENTER_LIFT_PX = 30;   // how far Rudy rises while walking in
const EXIT_OFFSET_PX = 30;  // how far above the line Rudy reappears

const PHASE_ENTER = 'enter';
const PHASE_INSIDE = 'inside';
const PHASE_EXIT = 'exit';

const clamp01 = v => Math.min(Math.max(v, 0), 1);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * Picks the behaviour that applies to the current mission stage.
 * @param {Array} triggerList The "trigger" list of the interaction config.
 * @param {number} stage The current mission stage.
 * @returns {object|null} The behaviour (with its "index" — the number used in
 *          the sound file name) or null when the interaction has no trigger.
 */
export function selectTrigger(triggerList, stage) {
    const entries = (triggerList ?? [])
        .map((behaviour, index) => ({ ...behaviour, index }))
        .filter(behaviour => behaviour.on === 'enter');

    for (const entry of entries) {
        // A behaviour without a "mission" map is the fallback for every stage.
        if (!entry.mission) return entry;
        const from = Object.keys(entry.mission).map(Number);
        if (from.includes(stage)) return entry;
    }
    return entries[entries.length - 1] ?? null;
}

/** True when the player stands in the spot of the interaction. */
export function isPlayerAt(spot, player) {
    return player.x >= spot.x1 && player.x <= spot.x2;
}

export default class WalkableInteraction {
    constructor() {
        this.active = false;
        this.phase = null;
        this.elapsed = 0;
        this.player = null;
        this.state = null;
        this.trigger = null;
        this.onInside = null;
        this.exchanged = false;
        this.baseY = 0;
        this.startX = 0;
        this.shift = 0;
    }

    /**
     * @param {object} spot The interaction config: { id, x1, x2 }.
     * @param {object} trigger The selected behaviour: { stay, mission, give, cost }.
     * @param {Player} player
     * @param {State} state Global state — the mission moves on here.
     * @param {Function} [onInside] Called when Rudy disappears in the spot (the sound).
     */
    start(spot, trigger, player, state, onInside = null) {
        this.active = true;
        this.player = player;
        this.state = state;
        this.trigger = trigger;
        this.onInside = onInside;
        this.exchanged = false;
        this.baseY = player.y;
        this.startX = player.x;
        // Rudy steps towards the middle of the spot, but never leaves it.
        const middle = (spot.x1 + spot.x2) / 2;
        this.shift = clamp(middle - this.startX, spot.x1 - this.startX, spot.x2 - this.startX);
        this.phase = PHASE_ENTER;
        this.elapsed = 0;
        player.facing = 1;
    }

    /** @param {number} dt Delta time in ms. */
    update(dt) {
        if (!this.active) return;

        const { player } = this;
        this.elapsed += dt;

        if (this.phase === PHASE_ENTER) {
            const t = clamp01(this.elapsed / ENTER_MS);
            player.x = this.startX + this.shift * t;
            player.y = this.baseY - ENTER_LIFT_PX * t;
            player.animateWalk(dt, player.walkSpeed);
            if (this.elapsed >= ENTER_MS) this._beginInside();
        } else if (this.phase === PHASE_INSIDE) {
            // The exchange happens a moment before the exit, so the player sees
            // the new objective and the new inventory while he is still inside.
            if (!this.exchanged && this.elapsed >= this._exchangeAtMs()) this._exchange();
            if (this.elapsed >= this._stayMs()) this._beginExit();
        } else {
            const t = clamp01(this.elapsed / EXIT_MS);
            player.x = this.startX + this.shift * (1 - t);
            player.y = this.baseY - EXIT_OFFSET_PX * (1 - t);
            player.animateWalk(dt, -player.walkSpeed);
            if (this.elapsed >= EXIT_MS) this._finish();
        }
    }

    _stayMs() {
        return this.trigger?.stay ?? DEFAULT_STAY_MS;
    }

    /** When the mission moves on and the goods change hands. */
    _exchangeAtMs() {
        return Math.max(0, this._stayMs() - MISSION_LEAD_MS);
    }

    _beginInside() {
        this.phase = PHASE_INSIDE;
        this.elapsed = 0;
        this.player.hidden = true;
        // The sound belongs to the moment Rudy is inside the spot.
        if (this.onInside) this.onInside();
    }

    /**
     * The mission moves on and the item is handed out for its price — both in
     * the same instant, so the HUD swaps the money icon for the item icon.
     */
    _exchange() {
        this.exchanged = true;
        this.state.mission.apply(this.trigger?.mission);
        if (this.trigger?.give) this.state.addItem(this.trigger.give);
        if (this.trigger?.cost) this.state.spendMoney(this.trigger.cost);
    }

    /** Rudy reappears in the spot and walks back out. */
    _beginExit() {
        this.phase = PHASE_EXIT;
        this.elapsed = 0;
        this.player.hidden = false;
        this.player.facing = -1;
    }

    _finish() {
        this.active = false;
        this.phase = null;
        this.player.y = this.baseY;
        this.player.hidden = false;
        this.player.vx = 0;
        this.player = null;
        this.state = null;
        this.trigger = null;
        this.onInside = null;
    }
}
