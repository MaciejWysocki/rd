// src/game/play-state.js

/**
 * play-state.js
 *
 * Gameplay state: draws the current section background, its enemies and the player,
 * and feeds input and section boundaries into the actors each frame.
 * Walking under a shop door highlights it; Up then starts a scripted entry (see shop-entry.js).
 */

import ShopEntry, { isPlayerUnderDoor } from './shop-entry.js';
import { startAmbient } from '../audio/audio.js';

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
        this._highlightImages = new Map();
    }

    onEnter() {
        this._syncAmbient();
    }

    /** (Re)starts the convention-based `<street>_<section>-ambient` loop for the current section. */
    _syncAmbient() {
        const section = this.world.currentSection;
        if (section) startAmbient(this.world.streetName, section.id);
    }

    update(dt) {
        if (this.transitioning) return;

        const section = this.world.currentSection;
        const solids = section ? section.boundaries : [];

        if (this.shop.active) {
            // Swallow Up presses during the sequence so they don't fire as a jump afterwards.
            this.keyboard.consumePress('ArrowUp');
            this.shop.update(dt);
        } else {
            const door = this._shopDoor(section);
            const underDoor = door && !this.player.attacking && !this.player.jumping && isPlayerUnderDoor(door, this.player);
            // Up enters the shop at a door; the same key jumps elsewhere (consumed in player.update).
            if (underDoor && this.keyboard.consumePress('ArrowUp')) {
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
            this._syncAmbient();
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
        // Highlight while Rudy stands at the door and through the whole shop
        // sequence (enter, inside, exit).
        if (door && (this.shop.active || isPlayerUnderDoor(door, this.player))) {
            this._drawShopHighlight(door);
        }

        for (const enemy of section?.enemies ?? []) enemy.draw(ctx);
        this.player.draw(ctx);
    }

    /** Draws the shop highlight overlay from the door's `highlight` config: image at its fixed position. */
    _drawShopHighlight(door) {
        const hl = door.highlight;
        if (!hl) return;
        let img = this._highlightImages.get(hl.image);
        if (!img) {
            img = new Image();
            img.src = hl.image;
            this._highlightImages.set(hl.image, img);
        }
        if (img.complete && img.naturalWidth > 0) {
            this.ctx.drawImage(img, hl.x, hl.y);
        }
    }
}
