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
 */

const ENTER_MS = 1000;
const INSIDE_MS = 3000;
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
    constructor() {
        this.active = false;
        this.phase = null;
        this.elapsed = 0;
        this.player = null;
        this.sound = null;
        this.baseY = 0;
        this.startX = 0;
        this.shift = 0;
    }

    /**
     * @param {{x:number,y:number,w:number,h:number,sound:string}} door
     * @param {Player} player
     */
    start(door, player) {
        this.active = true;
        this.player = player;
        // Create and unlock the element inside the key press (muted). Browsers can block
        // play() started later from a fresh element; _beginInside() then unmutes and plays it.
        this.sound = new Audio(door.sound);
        // this.sound.muted = true;
        // this.sound.play().catch(() => {});
        // this.sound.pause();
        // this.sound.currentTime = 0;
        // this.sound.muted = false;
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
            if (this.elapsed >= INSIDE_MS) this._beginExit();
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
        this.player.y = this.baseY;
        this.player.hidden = false;
        this.player.vx = 0;
        this.player = null;
        this.sound = null;
    }
}
