// src/actors/player.js

/**
 * player.js
 *
 * The main character, Rudy. Moves left/right with the arrow keys and is
 * blocked by section boundaries. Holding Space punches and freezes on the
 * last punch frame; releasing Space returns to the first walk frame.
 * A quick tap still plays the full strike, because release only ends the
 * punch after it has reached full extension.
 */

import Actor from './actor.js';

const PUNCH_KEY = 'Space';

export default class Player extends Actor {
    constructor({ x, y }) {
        super({
            x,
            y,
            spritePath: 'assets/sprites/rudy_dres.png',
            walkSpeed: 180,
            // Feet area: the lower part of the 150x150 frame.
            hitbox: { x: 50, y: 120, w: 50, h: 25 },
        });
        this.punchSound = new Audio('assets/sounds/rudy_dres-punch-miss.mp3');
        this.hidden = false; // set by scripted sequences, e.g. walking into a shop
    }

    /**
     * @param {number} dt        Delta time in ms.
     * @param {Keyboard} keyboard
     * @param {Array<{x:number,y:number,w:number,h:number}>} solids Section boundaries.
     */
    update(dt, keyboard, solids) {
        // Release only ends the punch once it has reached full extension,
        // so a quick tap still shows the whole strike.
        if (this.attacking && this.isAttackAtFullExtension() && !keyboard.isDown(PUNCH_KEY)) {
            this.endAttack();
        }

        // Consume the press every frame so presses made during a punch don't fire later.
        const pressed = keyboard.consumePress(PUNCH_KEY);
        if (pressed && !this.attacking) {
            this.startAttack();
            this.playPunchSound();
        }

        if (this.attacking) {
            // Rudy stands still while punching.
            this.vx = 0;
            super.update(dt);
            return;
        }

        const dir = keyboard.horizontal();
        const dx = dir * this.walkSpeed * (dt / 1000);

        if (dir !== 0) this.facing = dir;

        const moved = dir !== 0 && this.tryMove(dx, 0, solids);
        this.vx = moved ? dir * this.walkSpeed : 0;

        super.update(dt);
    }

    playPunchSound() {
        this.punchSound.currentTime = 0;
        this.punchSound.play();
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
