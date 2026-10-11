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
// the fly. At a shop door the same key enters the shop instead (PlayState
// decides the priority). The hop is a draw offset only; the hitbox stays on the ground.
//
// Holding an attack key freezes on the last attack frame; releasing it returns
// to the walk cycle. A quick tap still plays the full strike, because release
// only ends the attack after it has reached full extension (the point where
// combat resolves the hit — PLAN.md P0.2).

import Actor from './actor.js';
import { playAttackSound, playJumpSound } from '../audio/audio.js';

export default class Player extends Actor {
    constructor({ x, y, def }) {
        super({ x, y, def });
        this.hidden = false; // set by scripted sequences, e.g. walking into a shop
        this.jumpKey = def.jumpKey ?? 'ArrowUp';
        this.jumpDurationMs = def.jumpDurationMs ?? 600;
        this.jumpHeightPx = def.jumpHeightPx ?? 120;
        this.jumping = false;
        this.jumpElapsed = 0;
    }

    /**
     * @param {number} dt        Delta time in ms.
     * @param {Keyboard} keyboard
     * @param {Array<{x:number,y:number,w:number,h:number}>} solids Section boundaries.
     */
    update(dt, keyboard, solids) {
        if (this.jumping) {
            this._updateJump(dt, keyboard, solids);
            return;
        }

        // Release only ends the attack once it has reached full extension,
        // so a quick tap still shows the whole strike.
        const attackKey = this.attackMove?.key;
        if (this.attacking && this.isAttackAtFullExtension() && attackKey && !keyboard.isDown(attackKey)) {
            this.endAttack();
        }

        // Consume move presses every frame so presses made during an attack don't fire later.
        let pressedMove = null;
        for (const move of this.moves) {
            if (move.key && keyboard.consumePress(move.key)) pressedMove = move;
        }
        if (pressedMove && !this.attacking) {
            this.startAttack(pressedMove);
            // Hit/miss resolution lands with combat (PLAN.md P0.2); today every attack misses.
            playAttackSound(this.name, 'miss');
        }

        if (this.attacking) {
            // Rudy stands still while attacking.
            this.vx = 0;
            super.update(dt);
            return;
        }

        // Held jump key keeps hopping: the jump restarts on landing. The one-shot
        // press is consumed every frame so a press made away from a door cannot
        // fire later as a shop entry.
        keyboard.consumePress(this.jumpKey);
        if (keyboard.isDown(this.jumpKey)) {
            this.jumping = true;
            this.jumpElapsed = 0;
            this.vx = 0;
            playJumpSound(this.name);
            super.update(dt);
            return;
        }

        const dir = keyboard.horizontal();
        const dx = dir * this.walkSpeed * (dt / 1000);

        if (dir !== 0) {
            this.facing = dir;
            // A blocked move still animates: Rudy walks in place against walls and world ends.
            this.tryMove(dx, 0, solids);
        }
        this.vx = dir * this.walkSpeed;

        super.update(dt);
    }

    /** Vertical hop on a parabola; the walk cycle keeps playing — Rudy walks in the air. */
    _updateJump(dt, keyboard, solids) {
        this.jumpElapsed += dt;
        const t = Math.min(this.jumpElapsed / this.jumpDurationMs, 1);
        this.drawOffsetY = 4 * this.jumpHeightPx * t * (1 - t);
        if (t >= 1) {
            this.jumping = false;
            this.drawOffsetY = 0;
        }

        const dir = keyboard.horizontal();
        const dx = dir * this.walkSpeed * (dt / 1000);
        if (dir !== 0) {
            this.facing = dir;
            this.tryMove(dx, 0, solids);
        }
        // Walk animation runs normally (scaled by |vx|) so pressing arrows keeps it cycling.
        this.vx = dir * this.walkSpeed;
        super.update(dt);
    }

    /** Walk animation without player input, for scripted sequences. */
    animateWalk(dt, vx) {
        this.vx = vx;
        super.update(dt);
    }

    draw(ctx) {
        if (this.hidden) return;
        super.draw(ctx);
    }
}
