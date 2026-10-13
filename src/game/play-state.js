// src/game/play-state.js

/**
 * play-state.js
 *
 * Gameplay state: draws the current section background, its enemies and the player,
 * and feeds input and section boundaries into the actors each frame.
 * Walking under a shop door highlights it; Up then starts a scripted entry (see shop-entry.js).
 *
 * Combat (PLAN.md P0.2): every blow whose animation reached full extension is
 * resolved here via combat.js — the player's strike first, then the enemies'
 * and the boss's. The boss fight starts when its trigger conditions are met
 * (P0.4), its defeat hands the game to the shared end screen with the victory
 * result (P0.5) and Rudy's HP 0 with the defeat result (P0.6) — see end-state.js.
 */

import ShopEntry, { isPlayerUnderDoor } from './shop-entry.js';
import { startAmbient, startBossMusic, playBossIntro } from '../audio/audio.js';
import { drawHud } from '../render/hud.js';
import { resolveStrike, isStrikeInRange } from '../actors/combat.js';

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
     * @param {State} deps.state Global persistent state (HP, money, items shown in the HUD).
     * @param {Function} deps.onGameEnd Called once with 'lost' (Rudy's HP hit 0)
     *                                  or 'won' (the boss defeated).
     */
    constructor({ ctx, world, player, keyboard, state, onGameEnd }) {
        this.ctx = ctx;
        this.world = world;
        this.player = player;
        this.keyboard = keyboard;
        this.state = state;
        this.onGameEnd = onGameEnd;
        this.transitioning = false;
        this.shop = new ShopEntry(state);
        this.endSent = false; // the shared end screen is requested exactly once
        this._countedKills = new WeakSet();
        this._overlayImages = new Map();
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

        this.state.playTimeMs += dt;

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

        for (const enemy of section?.enemies ?? []) enemy.update(dt, solids, this.player);
        section?.boss?.update(dt, solids, this.player);

        this._checkBossTrigger(section);
        this._resolveCombat(section);

        const stats = this.state.stats[this.player.name];
        if (stats) stats.hp = this.player.hp;

        if (this.player.defeated) this._end('lost');
    }

    /**
     * The fight starts when the boss's trigger conditions are met (P0.4):
     * e.g. carrying `beer` wakes the bum — intro audio, boss music, fight.
     */
    _checkBossTrigger(section) {
        const boss = section?.boss;
        if (!boss || boss.fightStarted || boss.defeated) return;
        if (!this.state.matchesConditions(boss.trigger)) return;
        boss.engage();
        playBossIntro();
        startBossMusic();
    }

    /**
     * Resolves every blow whose attack animation has reached full extension
     * (combat.js). The player's strike is resolved first — proper tie-break
     * for simultaneous finishes comes with P1.1.
     */
    _resolveCombat(section) {
        if (!section) return;

        if (this.player.attacking && this.player.isAttackAtFullExtension() && !this.player.attackResolved) {
            resolveStrike(this.player, this._pickStrikeTarget(section));
        }

        for (const enemy of section.enemies) this._resolveStrikeOf(enemy);
        if (section.boss) this._resolveStrikeOf(section.boss);
        for (const enemy of section.enemies) this._countKill(enemy);
        if (section.boss) this._countKill(section.boss);

        // The bum's defeat: the world flag that keeps him down on later visits
        // and the shared end screen with the victory result (P0.5).
        const boss = section.boss;
        if (boss?.defeated && !this.endSent) {
            this.state.setFlag(`${boss.id}_defeated`, true);
            this._syncAmbient(); // boss music off, section ambience back
            this._end('won');
        }
    }

    _resolveStrikeOf(enemy) {
        if (enemy.defeated) return;
        if (enemy.attacking && enemy.isAttackAtFullExtension() && !enemy.attackResolved) {
            resolveStrike(enemy, this.player);
        }
    }

    _countKill(enemy) {
        if (!enemy.defeated || this._countedKills.has(enemy)) return;
        this._countedKills.add(enemy);
        const stats = this.state.stats[this.player.name];
        if (stats) stats.kills = (stats.kills ?? 0) + 1;
        // The corpse persists in the game state: still lying here on later visits.
        this.state.markEnemyDefeated(enemy.id, enemy);
    }

    /** The hostile currently in fight mode (HUD shows its HP), or null. */
    _fightingFoe(section) {
        if (!section) return null;
        for (const enemy of section.enemies) {
            if (!enemy.defeated && enemy.isFighting(this.player)) return enemy;
        }
        const boss = section.boss;
        if (boss && boss.isFighting()) return boss;
        return null;
    }

    /** Nearest opponent the player's blow can reach right now, or null (whiff). */
    _pickStrikeTarget(section) {
        let best = null;
        let bestDistance = Infinity;
        const check = opponent => {
            if (!opponent.canBeHit() || !isStrikeInRange(this.player, opponent)) return;
            const distance = Math.abs(opponent.x - this.player.x);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = opponent;
            }
        };
        for (const enemy of section.enemies) check(enemy);
        if (section.boss) check(section.boss);
        return best;
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

        const boss = section?.boss ?? null;
        // A boss still waiting for its trigger shows its configured static pose
        // ("idleOverlay") in the background instead of the sprite's first frame;
        // the sprite takes over the moment the fight starts.
        const bossIdlePose = boss && !boss.fightStarted && !boss.defeated ? boss.idleOverlay : null;
        if (bossIdlePose) this._drawOverlay(bossIdlePose);

        const door = this._shopDoor(section);
        // Highlight while Rudy stands at the door and through the whole shop
        // sequence (enter, inside, exit).
        if (door && (this.shop.active || isPlayerUnderDoor(door, this.player))) {
            this._drawOverlay(door.highlight);
        }

        for (const enemy of section?.enemies ?? []) enemy.draw(ctx);
        if (boss && !bossIdlePose) boss.draw(ctx);
        this.player.draw(ctx);

        // HUD stays on top: hearts (1 per HP), coins (1 per money unit) and
        // carried items (1 icon per unit, e.g. the bought beer). While an enemy
        // is in fight mode its HP shows as hearts in the top-right corner.
        const foe = this._fightingFoe(section);
        drawHud(ctx, {
            hp: this.state.stats[this.player.name]?.hp ?? 0,
            money: this.state.money,
            items: this.state.inventory,
            enemyHp: foe ? { hp: foe.hp, maxHp: foe.maxHp } : null,
        });
    }

    /** Hands the game to the shared end screen (end-state.js) exactly once. */
    _end(result) {
        if (this.endSent) return;
        this.endSent = true;
        this.onGameEnd(result);
    }

    /** Draws a static overlay from a `{ image, x, y }` config (shop highlight, idle boss pose) at its fixed position. */
    _drawOverlay(overlay) {
        if (!overlay) return;
        let img = this._overlayImages.get(overlay.image);
        if (!img) {
            img = new Image();
            img.src = overlay.image;
            this._overlayImages.set(overlay.image, img);
        }
        if (img.complete && img.naturalWidth > 0) {
            this.ctx.drawImage(img, overlay.x, overlay.y);
        }
    }
}
