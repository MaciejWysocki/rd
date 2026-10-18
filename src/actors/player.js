// src/actors/player.js
//
// player.js
//
// The main character, Rudy — the only playable character. All statistics and
// moves come from data/characters/player.json; each move is mapped to a key
// there and draws from its own sprite row (an "alternate" move switches between
// its two 4-frame groups on every other attack). Moves left/right with the
// arrow keys and is blocked by section boundaries — when blocked he keeps
// walking in place.
//
// Jump (jumpKey, default ArrowUp): a short vertical hop with the regular walk
// animation playing through it — Rudy "walks in the air" — and the `<who>-jump`
// sound. Side arrows stay live during the hop, so Rudy can drift left/right on
// the fly. At a shop door the same key enters the shop instead. The hop is a
// draw offset, but combat treats an airborne character as out of strike reach.
// Killed mid-air, the body finishes the hop before the game freezes.
// Retreat (retreatKey, default ArrowDown) takes a quick step backwards without
// turning. Both evasions interrupt a windup immediately, never queue for later,
// and cannot undo a hit that already landed. Retreat avoids hits by distance,
// not invulnerability; walls can block it.
//
// Debug run: holding Shift (either one) moves Rudy 4x faster while walking.
//
// Holding an attack key freezes on the last attack frame; releasing it returns
// to the walk cycle. A quick tap still plays the full strike, because release
// only ends the attack after it has reached full extension — the point where
// combat.js resolves the hit. **Every press is a punch** (owner 2026-10-12):
// the player has no recovery between blows (`recoveryMs: 0` in the config) and
// presses made during a blow queue up and fire right after it — nothing is
// dropped, there are no delays.

import Actor from './actor.js';
import { playJumpSound } from '../audio/audio.js';

// Debug/testing aid: holding Shift (either one) moves Rudy
// DEBUG_SPEED_MULTIPLIER times faster; the walk cycle scales with |vx|.
const DEBUG_SPEED_MULTIPLIER = 4;

function debugSpeedMultiplier(keyboard) {
    return keyboard.isDown('ShiftLeft') || keyboard.isDown('ShiftRight') ? DEBUG_SPEED_MULTIPLIER : 1;
}

export default class Player extends Actor {
    constructor({ x, y, def }) {
        super({ x, y, def });
        this.hidden = false; // set by scripted sequences, e.g. walking into a shop
        this.jumpKey = def.jumpKey ?? 'ArrowUp';
        this.jumpDurationMs = def.jumpDurationMs ?? 600;
        this.jumpHeightPx = def.jumpHeightPx ?? 120;
        this.jumping = false;
        this.jumpElapsed = 0;
        this.retreatKey = def.retreatKey ?? 'ArrowDown';
        this.retreatDurationMs = def.retreatDurationMs ?? 180;
        this.retreatDistancePx = def.retreatDistancePx ?? 90;
        this.retreating = false;
        this.retreatElapsed = 0;
        this.moveQueue = []; // presses waiting for the current blow to end
    }

    /**
     * @param {number} dt        Delta time in ms.
     * @param {Keyboard} keyboard
     * @param {Array<{x:number,y:number,w:number,h:number}>} solids Section boundaries.
     */
    update(dt, keyboard, solids) {
        // Consume evasion presses even while another dodge is running: no buffer.
        const retreatPressed = keyboard.consumePress(this.retreatKey);
        keyboard.consumePress(this.jumpKey);
        if (this.defeated) {
            this.vx = 0;
            if (this.jumping) this._advanceJump(dt);
            super.update(dt);
            return;
        }
        this.attackCooldownMs = Math.max(0, this.attackCooldownMs - dt);

        for (const move of this.moves) {
            if (move.key && keyboard.consumePress(move.key)) this.moveQueue.push(move);
        }

        if (!this.jumping && !this.retreating) {
            if (retreatPressed) {
                this.endAttack();
                this.retreating = true;
                this.retreatElapsed = 0;
            } else if (keyboard.isDown(this.jumpKey)) {
                this.endAttack();
                this.jumping = true;
                this.jumpElapsed = 0;
                playJumpSound(this.name);
            }
        }
        if (this.jumping) {
            this._updateJump(dt, keyboard, solids);
            return;
        }
        if (this.retreating) {
            this._updateRetreat(dt, solids);
            return;
        }

        // A quick tap still finishes its strike before returning to walking.
        const attackKey = this.attackMove?.key;
        if (this.attacking && this.attackResolved && attackKey && !keyboard.isDown(attackKey)) {
            this.endAttack();
        }
        if (!this.attacking && this.attackCooldownMs <= 0 && this.moveQueue.length > 0) {
            this.startAttack(this.moveQueue.shift());
        }

        if (this.attacking) {
            this.vx = 0;
            super.update(dt);
            return;
        }

        const dir = keyboard.horizontal();
        const speed = this.walkSpeed * debugSpeedMultiplier(keyboard);
        const dx = dir * speed * (dt / 1000);

        if (dir !== 0) {
            this.facing = dir;
            // A blocked move still animates: Rudy walks in place against walls and world ends.
            this.tryMove(dx, 0, solids);
        }
        this.vx = dir * speed;
        super.update(dt);
    }

    /** Vertical hop on a parabola; the walk cycle keeps playing — Rudy walks in the air. */
    _updateJump(dt, keyboard, solids) {
        this._advanceJump(dt);

        const dir = keyboard.horizontal();
        const speed = this.walkSpeed * debugSpeedMultiplier(keyboard);
        const dx = dir * speed * (dt / 1000);
        if (dir !== 0) {
            this.facing = dir;
            this.tryMove(dx, 0, solids);
        }
        // Walk animation runs normally (scaled by |vx|) so pressing arrows keeps it cycling.
        this.vx = dir * speed;
        super.update(dt);
    }

    /** Fixed backward step; holding the key does not repeat or extend it. */
    _updateRetreat(dt, solids) {
        const elapsed = Math.min(dt, this.retreatDurationMs - this.retreatElapsed);
        const speed = -this.facing * this.retreatDistancePx / this.retreatDurationMs;
        this.tryMove(speed * elapsed, 0, solids);
        this.vx = speed * 1000;
        this.retreatElapsed += elapsed;
        if (this.retreatElapsed >= this.retreatDurationMs) this.retreating = false;
        super.update(dt);
    }

    /** The hop's parabola alone — also finishes the arc of a body killed mid-air. */
    _advanceJump(dt) {
        this.jumpElapsed += dt;
        const t = Math.min(this.jumpElapsed / this.jumpDurationMs, 1);
        this.drawOffsetY = 4 * this.jumpHeightPx * t * (1 - t);
        if (t >= 1) {
            this.jumping = false;
            this.drawOffsetY = 0;
        }
    }

    /** Walk animation without player input, for scripted sequences. */
    animateWalk(dt, vx) {
        this.vx = vx;
        super.update(dt);
    }

    /** Not hittable while hidden inside a shop. */
    canBeHit() {
        return !this.hidden && super.canBeHit();
    }

    draw(ctx) {
        if (this.hidden) return;
        super.draw(ctx);
    }
}
