// src/game/play-state.js

/**
 * play-state.js
 *
 * Gameplay state: draws the current section background, its enemies and the player,
 * and feeds input and section boundaries into the actors each frame.
 * Walking under a shop door highlights it; Up then starts a scripted entry (see shop-entry.js).
 */

import ShopEntry, { isPlayerUnderDoor } from './shop-entry.js';

// Where Rudy appears when entering a section from the left; matches his start X in main.js.
const ENTRY_X_FROM_LEFT = 50;
// Where Rudy appears when entering a section from the right: frame flush with the 1600px canvas edge (1600 - 150).
const ENTRY_X_FROM_RIGHT = 1450;

export default class PlayState {
    /**
     * @param {object} deps
     * @param {CanvasRenderingContext2D} deps.ctx
     * @param {WorldManager} deps.world
     * @param {Player} deps.player
     * @param {Keyboard} deps.keyboard
     */
    constructor({ ctx, world, player, keyboard }) {
        this.ctx = ctx;
        this.world = world;
        this.player = player;
        this.keyboard = keyboard;
        this.transitioning = false;
        this.shop = new ShopEntry();
    }

    update(dt) {
        if (this.transitioning) return;

        const section = this.world.currentSection;
        const solids = section ? section.boundaries : [];
        // Consumed every frame so an Up press made away from a door does not fire later.
        const upPressed = this.keyboard.consumePress('ArrowUp');

        if (this.shop.active) {
            this.shop.update(dt);
        } else {
            const door = this._shopDoor(section);
            if (door && upPressed && !this.player.attacking && isPlayerUnderDoor(door, this.player)) {
                this.shop.start(door, this.player);
            } else {
                this.player.update(dt, this.keyboard, solids);

                const exit = this._exitDirection(section);
                if (exit === 'right') this._changeSection(1, ENTRY_X_FROM_LEFT);
                if (exit === 'left') this._changeSection(-1, ENTRY_X_FROM_RIGHT);
            }
        }

        for (const enemy of section?.enemies ?? []) enemy.update(dt, solids);
    }

    /** Returns 'right' or 'left' when Rudy's hitbox leaves the section through an open edge, otherwise null. */
    _exitDirection(section) {
        if (!section) return null;
        const { x, hitbox } = this.player;
        const left = x + hitbox.x;
        const right = left + hitbox.w;
        const { routeIndex, route } = this.world;
        if (section.config.exitRight && routeIndex + 1 < route.length && right >= this.ctx.canvas.width) return 'right';
        if (section.config.exitLeft && routeIndex > 0 && left <= 0) return 'left';
        return null;
    }

    /** Moves along the route by step (+1 or -1) and places Rudy at entryX. */
    async _changeSection(step, entryX) {
        this.transitioning = true;
        try {
            if (step > 0) await this.world.next();
            else await this.world.prev();
            this.player.x = entryX;
        } finally {
            this.transitioning = false;
        }
    }

    _shopDoor(section) {
        return section?.interactions.find(i => i.type === 'shop') ?? null;
    }

    draw() {
        const { ctx } = this;
        const section = this.world.currentSection;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (section?.background) {
            ctx.drawImage(section.background, 0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        const door = this._shopDoor(section);
        if (door && !this.shop.active && isPlayerUnderDoor(door, this.player)) {
            this._highlight({ x: door.x + 25, y: door.y + 90, w: door.w, h: door.h });
        }

        for (const enemy of section?.enemies ?? []) enemy.draw(ctx);
        this.player.draw(ctx);
    }

    _highlight({ x, y, w, h }) {
        const { ctx } = this;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 210, 80, 0.25)';
        ctx.fillRect(x, y, w, h);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255, 230, 120, 0.95)';
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
    }
}
