// src/game/shop-entry.js

/**
 * shop-entry.js
 *
 * Scripted walk into a shop through its door. While it runs, the player has no control.
 *   enter  - walks right at walking speed, rising slightly toward the door (ENTER_MS)
 *   inside - hidden; the shop sound plays once at the start (INSIDE_MS)
 *   exit   - reappears at the door, facing left, slightly above the line,
 *            walks back left at walking speed and settles onto the line (EXIT_MS)
 * Enter and exit cover the same distance, so Rudy ends where he started.
 *
 * The visit is money-driven. With at least one coin he buys a beer: the door's
 * `sound` plays while he is inside and, 100 ms before he comes out, the beer
 * lands in the inventory and 1 coin goes off — both counters change at the same
 * instant (owner 2026-10-14). Broke (no coins), the door's `soundNoMoney` plays
 * instead, he only stays inside for NO_MONEY_INSIDE_MS and nothing else happens.
 */

const ENTER_MS = 1000;
const INSIDE_MS = 3000;
const NO_MONEY_INSIDE_MS = 1000;
const EXCHANGE_LEAD_MS = 400; // the beer-for-coin exchange happens this long before the exit
const EXIT_MS = 1000;
const ENTER_LIFT_PX = 30;   // how far Rudy rises while walking in
const EXIT_OFFSET_PX = 30;  // how far above the line Rudy reappears
const SHIFT_PX = 10;        // horizontal step on the way in and back out

const PHASE_ENTER = 'enter';
const PHASE_INSIDE = 'inside';
const PHASE_EXIT = 'exit';

const clamp01 = v => Math.min(Math.max(v, 0), 1);

/** True when the centre of the player's hitbox lies within the door's horizontal span. */
export function isPlayerUnderDoor(door, player) {
    const centreX = player.x + player.hitbox.x + player.hitbox.w / 2;
    return centreX >= door.x && centreX <= door.x + door.w;
}

export default class ShopEntry {
    /** @param {State} state Global persistent state (money is spent here). */
    constructor(state) {
        this.state = state;
        this.active = false;
        this.phase = null;
        this.elapsed = 0;
        this.player = null;
        this.sound = null;
        this.buying = false;
        this.exchanged = false;
        this.insideMs = INSIDE_MS;
        this.baseY = 0;
        this.startX = 0;
        this.shift = 0;
    }

    /**
     * @param {{x:number,y:number,w:number,h:number,sound:string,soundNoMoney:string}} door
     * @param {Player} player
     */
    start(door, player) {
        this.active = true;
        this.player = player;
        // With coins Rudy buys a beer (door.sound); broke, he is turned away
        // quickly (door.soundNoMoney) and nothing else happens.
        this.buying = this.state.money > 0;
        this.exchanged = false;
        this.insideMs = this.buying ? INSIDE_MS : NO_MONEY_INSIDE_MS;
        this.sound = new Audio(this.buying ? door.sound : door.soundNoMoney);
        this.baseY = player.y;
        this.startX = player.x;
        // Short step: Rudy shifts SHIFT_PX on the way in and returns the same distance on the way out.
        this.shift = SHIFT_PX;
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
            // The money changes hands 100 ms before the exit: the beer appears
            // and the coin goes just before Rudy comes out (both at once).
            if (this.buying && !this.exchanged && this.elapsed >= this.insideMs - EXCHANGE_LEAD_MS) {
                this._exchange();
            }
            if (this.elapsed >= this.insideMs) this._beginExit();
        } else {
            const t = clamp01(this.elapsed / EXIT_MS);
            player.x = this.startX + this.shift * (1 - t);
            player.y = this.baseY - EXIT_OFFSET_PX * (1 - t);
            player.animateWalk(dt, -player.walkSpeed);
            if (this.elapsed >= EXIT_MS) this._finish();
        }
    }

    _beginInside() {
        this.phase = PHASE_INSIDE;
        this.elapsed = 0;
        this.player.hidden = true;
        this.sound.currentTime = 0;
        this.sound.play().catch(e => console.warn('shop sound failed:', e));
    }

    /** Beer for a coin — both counters change at the same instant (100 ms before the exit). */
    _exchange() {
        this.exchanged = true;
        this.state.addItem('beer', { id: 'beer', name: 'Piwo' });
        this.state.addMoney(-1);
        this.state.missionLogs[1] ??= 'Znajdź ustronne miejsce aby wypić piwo';
    }

    /** Rudy reappears at the door — the beer was already bought 100 ms before. */
    _beginExit() {
        const { player } = this;
        this.phase = PHASE_EXIT;
        this.elapsed = 0;
        player.hidden = false;
        player.facing = -1;
    }

    _finish() {
        this.active = false;
        this.phase = null;
        this.buying = false;
        this.player.y = this.baseY;
        this.player.hidden = false;
        this.player.vx = 0;
        this.player = null;
        this.sound = null;
    }
}
