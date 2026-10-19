// src/game/play-state.js

/**
 * play-state.js
 *
 * Gameplay state: draws the current section background, its enemies and the player,
 * and feeds input and section boundaries into the actors each frame.
 * Walking into a walkable spot highlights it; Up then starts the scripted
 * sequence of the interaction (see walkable-interaction.js).
 *
 * Combat resolves in animation-finish order, with melee RPS arbitration in
 * combat.js. The boss trigger starts the fight (and its music); the boss's
 * defeat ends the street — the next street of the game follows, and the last
 * street of the game ends it. Rudy's defeat waits for his fall before the
 * game freezes.
 */

import WalkableInteraction, { selectTrigger, isPlayerAt } from './walkable-interaction.js';
import {
    startAmbient, startBossMusic, playBossIntro, stopAllAudio, playSound,
} from '../audio/audio.js';
import { drawHud } from '../render/hud.js';
import Blood from '../render/blood.js';
import { resolveStrike, isStrikeInRange } from '../actors/combat.js';

// Where Rudy appears when entering a section from the left; matches his start X in main.js.
const ENTRY_X_FROM_LEFT = 50;
// Where Rudy appears when entering a section from the right: frame flush with the 1600px canvas edge (1600 - 150).
const ENTRY_X_FROM_RIGHT = 1450;
// The line the characters stand on.
const GROUND_Y = 598;

export default class PlayState {
    /**
     * @param {object} deps
     * @param {CanvasRenderingContext2D} deps.ctx
     * @param {WorldManager} deps.world
     * @param {Player} deps.player
     * @param {Keyboard} deps.keyboard
     * @param {State} deps.state Global persistent state (HP, money, items, mission shown in the HUD).
     * @param {Function} deps.onGameEnd Called once with 'lost' (Rudy's HP hit 0)
     *                                  or 'won' (the last street finished).
     */
    constructor({ ctx, world, player, keyboard, state, onGameEnd }) {
        this.ctx = ctx;
        this.world = world;
        this.player = player;
        this.keyboard = keyboard;
        this.state = state;
        this.onGameEnd = onGameEnd;
        this.transitioning = false;
        this.interaction = new WalkableInteraction();
        this.endSent = false; // the shared end screen is requested exactly once
        this.bossDefeatHandled = false; // the boss's death is recorded exactly once
        this.streetFinished = false; // the current street is done — the next one follows
        this.blood = new Blood();
        this._countedKills = new WeakSet();
        this._overlayImages = new Map();
        this._strikes = [];
    }

    onEnter() {
        this._syncAmbient();
    }

    /**
     * (Re)starts the looping ambience for the current section:
     * `<street>-<section>-ambient`, or the default street ambience (`ambience.mp3`)
     * when the section has no track of its own.
     */
    _syncAmbient() {
        const section = this.world.currentSection;
        if (section) startAmbient(this.world.streetId, section.number);
    }

    update(dt) {
        if (this.transitioning) return;

        this.state.playTimeMs += dt;

        const section = this.world.currentSection;
        const solids = section ? section.boundaries : [];

        if (this.interaction.active) {
            // The jump press during the script cannot fire after leaving the spot.
            this.keyboard.consumePress(this.player.jumpKey);
            this.interaction.update(dt);
        } else {
            const spot = this._interactionAt(section);
            const atSpot = spot && !this.player.attacking && !this.player.jumping;
            const trigger = atSpot ? selectTrigger(spot.trigger, this.state.mission.stage) : null;
            // Up enters the interaction; elsewhere the same key jumps immediately.
            if (trigger && this.keyboard.consumePress(this.player.jumpKey)) {
                // The sound belongs to the moment Rudy is inside the spot.
                const sound = `${this.world.streetId}-${spot.id}-${trigger.index}`;
                this.interaction.start(spot, trigger, this.player, this.state, () => playSound(sound));
            } else {
                this.player.update(dt, this.keyboard, solids);

                const exit = this._exitDirection(section);
                if (exit === 'right') this._changeSection(1, ENTRY_X_FROM_LEFT);
                if (exit === 'left') this._changeSection(-1, ENTRY_X_FROM_RIGHT);
            }
        }

        for (const enemy of section?.enemies ?? []) enemy.update(dt, solids, this.player);
        section?.boss?.update(dt, solids, this.player);
        this.blood.update(dt);

        this._checkBossTrigger(section);
        this._resolveCombat(section);
        section?.boss?.updateVomit(dt, this.player);
        this._checkStreetComplete(section);

        const stats = this.state.stats[this.player.name];
        if (stats) stats.hp = this.player.hp;

        // The end screen waits for Rudy's fall: the death animation plays out
        // (row 2 of his sheet, sliding back) before the scene freezes.
        if (this.player.defeated && this.player.isDeathAnimationDone()) this._end('lost');
    }

    /**
     * The fight starts when the boss's trigger is met (P0.4): the trigger comes
     * from the street config — 'always', 'distance' or 'hit'.
     */
    _checkBossTrigger(section) {
        const boss = section?.boss;
        if (!boss || boss.fightStarted || boss.defeated) return;
        if (!boss.shouldStartFight(this.player)) return;
        boss.engage();
        startBossMusic(this.world.streetId);
        // The boss's introduction sentence plays on top of the fight music.
        playBossIntro(this.world.streetId);
    }

    /** Resolves ready attacks chronologically, not in player/enemy update order. */
    _resolveCombat(section) {
        if (!section) return;

        const strikes = this._strikes;
        strikes.length = 0;
        this._queueStrike(this.player);
        for (const enemy of section.enemies) this._queueStrike(enemy);
        if (section.boss) this._queueStrike(section.boss);
        strikes.sort((a, b) => a.attackFinishInMs() - b.attackFinishInMs());
        for (const attacker of strikes) {
            // An earlier blow may have interrupted or defeated this attacker.
            if (attacker.defeated || !attacker.attacking || attacker.attackResolved) continue;
            const target = attacker === this.player ? this._pickStrikeTarget(section) : this.player;
            this._landStrike(attacker, target, section.boundaries);
        }
        for (const enemy of section.enemies) this._countKill(enemy);
        if (section.boss) this._countKill(section.boss);

        // The bum's defeat: the world flag that keeps him down on later visits.
        const boss = section.boss;
        if (boss?.defeated && !this.bossDefeatHandled) {
            this.bossDefeatHandled = true;
            this.state.setFlag(`${this.world.streetId}_${boss.id}_defeated`, true);
        }
    }

    /**
     * The street is over when its last section is cleared: the boss is down
     * (and his fall has played out) or the mission is finished without a boss.
     * The next street of the game follows; after the last one the game ends.
     */
    _checkStreetComplete(section) {
        if (this.streetFinished) return;
        if (!this.world.isStreetComplete()) return;

        const boss = section?.boss;
        if (boss?.defeated && !boss.isDeathAnimationDone()) return; // wait for the fall

        this.streetFinished = true;
        if (this.world.hasNextStreet) {
            this._advanceStreet();
        } else {
            this._end('won');
        }
    }

    /** Loads the next street of the game and puts Rudy at its beginning. */
    async _advanceStreet() {
        this.transitioning = true;
        try {
            await this.world.nextStreet();
            this.player.x = ENTRY_X_FROM_LEFT;
            this.player.y = GROUND_Y;
            this.blood.clear(); // transient, like the enemies: wiped with the section
            this.bossDefeatHandled = false;
            this.streetFinished = false;
            this._syncAmbient();
        } finally {
            this.transitioning = false;
        }
    }

    _queueStrike(actor) {
        if (!actor.defeated && actor.isAttackAtFullExtension() && !actor.attackResolved) {
            this._strikes.push(actor);
        }
    }

    /** Releases ranged attacks without RPS, or resolves a melee blow and its blood. */
    _landStrike(attacker, target, solids) {
        if (attacker.attackMove.type === 'vomit') {
            attacker.releaseVomit();
            return;
        }
        const outcome = resolveStrike(attacker, target, solids);
        // Only bloody attackers make the target bleed (bloodOnTarget, default true).
        if (outcome === 'hit' && attacker.bloodOnTarget) {
            this.blood.spawn(target, target.x >= attacker.x ? 1 : -1);
        }
    }

    _countKill(enemy) {
        if (!enemy.defeated || this._countedKills.has(enemy)) return;
        this._countedKills.add(enemy);
        const stats = this.state.stats[this.player.name];
        if (stats) stats.kills = (stats.kills ?? 0) + 1;
        // The corpse persists in the game state: still lying here on later visits.
        this.state.markEnemyDefeated(this.world.streetId, enemy.id, enemy.slot, enemy);
    }

    /** The hostiles currently in fight mode (the HUD shows their HP), in order. */
    _fightingFoes(section) {
        if (!section) return [];
        const foes = [];
        for (const enemy of section.enemies) {
            if (!enemy.defeated && enemy.isFighting(this.player)) foes.push(enemy);
        }
        const boss = section.boss;
        if (boss && boss.isFighting()) foes.push(boss);
        return foes;
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

    /** Returns 'right' or 'left' when Rudy's hitbox leaves the section, otherwise null. */
    _exitDirection(section) {
        if (!section) return null;
        const { x, hitbox } = this.player;
        const left = x + hitbox.x;
        const right = left + hitbox.w;
        if (this.world.hasNextSection && right >= this.ctx.canvas.width) return 'right';
        if (this.world.hasPreviousSection && left <= 0) return 'left';
        return null;
    }

    /** Moves to the neighbouring section (step +1 or -1) and places Rudy at entryX. */
    async _changeSection(step, entryX) {
        this.transitioning = true;
        try {
            if (step > 0) await this.world.next();
            else await this.world.prev();
            this.player.x = entryX;
            this.blood.clear(); // transient, like the enemies: wiped with the section
            this._syncAmbient();
        } finally {
            this.transitioning = false;
        }
    }

    /** The walkable spot the player stands in, or null. */
    _interactionAt(section) {
        if (!section) return null;
        for (const spot of section.interactions) {
            if (isPlayerAt(spot, this.player)) return spot;
        }
        return null;
    }

    draw() {
        const { ctx } = this;
        const section = this.world.currentSection;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (section?.background) {
            ctx.drawImage(section.background, 0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        this._drawHighlights(section);

        for (const enemy of section?.enemies ?? []) enemy.draw(ctx);
        section?.boss?.draw(ctx);
        this.player.draw(ctx);
        this.blood.draw(ctx); // spray and stains, over the characters

        // HUD stays on top: hearts, coins and carried items at the left;
        // two mission-log rows above the fighting enemies' hearts at the right
        // (one row per foe).
        const foes = this._fightingFoes(section);
        drawHud(ctx, {
            hp: this.state.stats[this.player.name]?.hp ?? 0,
            money: this.state.money,
            items: this.state.inventory,
            enemies: foes.map(foe => ({ hp: foe.hp, maxHp: foe.maxHp })),
            missionLogs: this.state.missionLogs,
        });
    }

    /** Draws the background overlays of the section (shop signs, waiting poses). */
    _drawHighlights(section) {
        for (const highlight of section?.highlights ?? []) {
            if (this._highlightVisible(highlight)) this._drawOverlay(highlight);
        }
    }

    /**
     * An overlay is shown when the player stands in its "position" range
     * and/or the mission is on one of its "mission" stages.
     */
    _highlightVisible(highlight) {
        if (highlight.mission && !highlight.mission.includes(this.state.mission.stage)) return false;
        if (highlight.position) {
            const [x1, x2] = highlight.position;
            if (this.player.x < x1 || this.player.x > x2) return false;
        }
        return true;
    }

    /**
     * Hands the game to the shared end screen (end-state.js) exactly once.
     * The game is over: the street goes silent — the death music (`game-over`,
     * defeat only) plays once on the end screen itself (end-state.js).
     */
    _end(result) {
        if (this.endSent) return;
        this.endSent = true;
        stopAllAudio();
        this.onGameEnd(result);
    }

    /** Draws a static overlay from a `{ image, x, y }` config at its fixed position. */
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
