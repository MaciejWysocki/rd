// src/domain/actors/player.js
//
// player.js
//
// The main character, Rudy — the only playable character. Pure domain code:
// the jump config comes from the normalized Character model and the sound is
// left to the application layer (the optional `onJump` hook).
//
// All statistics and moves come from the player character; each move is
// mapped to a key there and draws from its own sprite row (an "alternate"
// move switches between its two 4-frame groups on every other attack). Moves
// left/right with the arrow keys and is blocked by section boundaries — when
// blocked he keeps walking in place.
//
// Jump (character.jump = { key, durationMs, heightPx }; null = no jump): a
// short vertical hop with the regular walk animation playing through it —
// Rudy "walks in the air" — and the `<who>-jump` sound played by the app
// layer through the `onJump` hook. Side arrows stay live during the hop, so
// Rudy can drift left/right on the fly. At a walkable spot the same key
// enters the interaction instead. The hop is a draw offset, but combat treats
// an airborne character as out of strike reach. Killed mid-air, the body
// finishes the hop before the game freezes. The jump interrupts a windup
// immediately, never queues for later, and cannot undo a hit that already
// landed.
//
// There is no backward step any more (owner 2026-10-19): the retreat and its
// ↓ key are gone — the jump is the only evasion.
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

// Debug/testing aid: holding Shift (either one) moves Rudy
// DEBUG_SPEED_MULTIPLIER times faster; the walk cycle scales with |vx|.
const DEBUG_SPEED_MULTIPLIER = 4;

const DEFAULT_JUMP_KEY = 'ArrowUp';
const DEFAULT_JUMP_DURATION_MS = 600;
const DEFAULT_JUMP_HEIGHT_PX = 120;

function debugSpeedMultiplier(keyboard) {
    return keyboard.isDown('ShiftLeft') || keyboard.isDown('ShiftRight') ? DEBUG_SPEED_MULTIPLIER : 1;
}

export default class Player extends Actor {
    /**
     * @param {object} options
     * @param {number} options.x         Frame top-left X in world px.
     * @param {number} options.y         Frame top-left Y in world px.
     * @param {object} options.character Normalized Character model (player).
     * @param {object} options.sheet      Sprite sheet: { drawFrame(ctx, row, frame, x, y, facing) }.
     */
    constructor({ x, y, character, sheet, id = null }) {
        super({ x, y, character, sheet, id });
        this.hidden = false; // set by scripted sequences, e.g. walking into a shop
        const jump = character.jump ?? null;
        this.canJump = Boolean(jump);
        this.jumpKey = jump ? (jump.key ?? DEFAULT_JUMP_KEY) : null;
        this.jumpDurationMs = jump ? (jump.durationMs ?? DEFAULT_JUMP_DURATION_MS) : 0;
        this.jumpHeightPx = jump ? (jump.heightPx ?? DEFAULT_JUMP_HEIGHT_PX) : 0;
        this.jumping = false;
        this.jumpElapsed = 0;
        this.moveQueue = []; // presses waiting for the current blow to end
        // The app layer hooks the jump sound here (the domain stays pure).
        this.onJump = null;
    }

    /**
     * @param {number} dt        Delta time in ms.
     * @param {Keyboard} keyboard
     * @param {Array<{x:number,y:number,w:number,h:number}>} solids Section boundaries.
     */
    update(dt, keyboard, solids) {
        // Consume the jump press even while a hop is running: no buffer.
        if (this.jumpKey) keyboard.consumePress(this.jumpKey);
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

        if (this.canJump && !this.jumping && keyboard.isDown(this.jumpKey)) {
            this.endAttack();
            this.jumping = true;
            this.jumpElapsed = 0;
            if (typeof this.onJump === 'function') this.onJump(this);
        }
        if (this.jumping) {
            this._updateJump(dt, keyboard, solids);
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
