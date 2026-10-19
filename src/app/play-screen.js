// src/app/play-screen.js
//
// play-screen.js
//
// The gameplay screen. It draws the current section background, its
// overlays, its hostiles and the player, and it feeds the input and the
// section boundaries into the actors each frame. Walking into a walkable spot
// highlights it; Up then starts the scripted sequence of the interaction
// (see walkable-interaction.js).
//
// Combat resolves in animation-finish order, with the melee RPS arbitration
// in domain/combat/arena.js. The boss trigger starts the fight (and its
// music); the boss's defeat ends the street — the next street of the game
// follows, and the last street of the game ends it. Rudy's defeat waits for
// his fall before the game freezes.

import WalkableInteraction from './walkable-interaction.js';
import {
    startAmbient, startBossMusic, playBossIntro, stopAllAudio, playSound, playAttackSound,
} from '../audio/audio.js';
import { drawHud } from '../render/hud.js';
import Blood from '../render/blood.js';
import { arbitrate } from '../domain/combat/arena.js';
import { selectTrigger, matchesCondition } from '../domain/quest/triggers.js';
import {
    ambientTrack, bossMusicTrack, bossIntroTrack, interactionTrack, overlayPath,
} from '../domain/content/asset-conventions.js';

// Where Rudy appears when entering a section from the left; matches his start X in main.js.
const ENTRY_X_FROM_LEFT = 50;
// Where Rudy appears when entering a section from the right: frame flush with the 1600px canvas edge (1600 - 150).
const ENTRY_X_FROM_RIGHT = 1450;
// The line the characters stand on.
const GROUND_Y = 598;

export default class PlayScreen {
    /**
     * @param {object} deps
     * @param {CanvasRenderingContext2D} deps.ctx
     * @param {World} deps.world The streets and the section the player is in.
     * @param {Player} deps.player
     * @param {Keyboard} deps.keyboard
     * @param {Session} deps.session The session (HP, money, items, the mission shown in the HUD).
     * @param {Function} deps.onGameEnd Called once with 'lost' (Rudy's HP hit 0)
     *                                  or 'won' (the last street finished).
     */
    constructor({ ctx, world, player, keyboard, session, onGameEnd }) {
        this.ctx = ctx;
        this.world = world;
        this.player = player;
        this.keyboard = keyboard;
        this.session = session;
        this.onGameEnd = onGameEnd;
        this.transitioning = false;
        this.interaction = new WalkableInteraction();
        this.endSent = false;      // the shared end screen is requested exactly once
        this.streetFinished = false; // the current street is done — the next one follows
        this.blood = new Blood();
        this._countedKills = new WeakSet();
        this._overlayImages = new Map();
        this._musicOwner = null;   // the boss that owns the fight music
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
        if (section) startAmbient(ambientTrack(this.world.streetId, section.number));
    }

    update(dt) {
        if (this.transitioning) return;

        this.session.playTimeMs += dt;

        const section = this.world.currentSection;
        const solids = section ? section.boundaries : [];

        if (this.interaction.active) {
            // The jump press during the script cannot fire after leaving the spot.
            this.keyboard.consumePress(this.player.jumpKey);
            this.interaction.update(dt);
        } else {
            this._handlePlayerInput(dt, section, solids);
        }

        for (const enemy of section?.enemies ?? []) enemy.update(dt, solids, this.player);
        this.blood.update(dt);

        this._checkBossTrigger(section);
        this._resolveCombat(section);
        this._updateProjectiles(section, dt);
        this._checkStreetComplete(section);
        this._syncStats();

        // The end screen waits for Rudy's fall: the death animation plays out
        // (row 2 of his sheet, sliding back) before the scene freezes.
        if (this.player.defeated && this.player.isDeathAnimationDone()) this._end('lost');
    }

    /* ---------- The player and the world ---------- */

    /** The input of the player: the walkable spots, the movement and the section edges. */
    _handlePlayerInput(dt, section, solids) {
        const spot = this._interactionAt(section);
        const atSpot = spot && !this.player.attacking && !this.player.jumping;
        const trigger = atSpot ? selectTrigger(spot.triggers, this._context()) : null;
        // Up enters the interaction; elsewhere the same key jumps immediately.
        if (trigger && this.keyboard.consumePress(this.player.jumpKey)) {
            // The sound belongs to the moment Rudy is inside the spot.
            const track = interactionTrack(this.world.streetId, spot.id, trigger.index);
            this.interaction.start(spot, trigger, this.player, () => this._context(), () => playSound(track));
            return;
        }

        this.player.update(dt, this.keyboard, solids);

        const exit = this._exitDirection(section);
        if (exit === 'right') this._changeSection(1, ENTRY_X_FROM_LEFT);
        if (exit === 'left') this._changeSection(-1, ENTRY_X_FROM_RIGHT);
    }

    /**
     * The fight starts when the boss's trigger is met: the trigger comes from
     * the street config — 'always', 'distance' or 'hit'.
     */
    _checkBossTrigger(section) {
        for (const enemy of section?.enemies ?? []) {
            if (enemy.role !== 'boss') continue;
            if (enemy.fightStarted || enemy.defeated) continue;
            if (!enemy.shouldStartFight(this.player)) continue;

            enemy.engage();
            if (this._musicOwner !== enemy) {
                this._musicOwner = enemy;
                startBossMusic(bossMusicTrack(this.world.streetId));
                // The boss's introduction sentence plays on top of the fight music.
                playBossIntro(bossIntroTrack(this.world.streetId));
            }
        }
    }

    /** Resolves ready attacks chronologically, not in player/enemy update order. */
    _resolveCombat(section) {
        if (!section) return;

        const events = arbitrate([this.player, ...section.enemies], {
            player: this.player,
            solids: section.boundaries,
        });
        for (const event of events) {
            if (event.type === 'hit') {
                playAttackSound(event.attacker.name, 'hit');
                // Only bloody attackers make the target bleed (bloodOnTarget, default true).
                if (event.attacker.bloodOnTarget) this.blood.spawn(event.target, event.direction);
            } else if (event.type === 'miss') {
                playAttackSound(event.attacker.name, 'miss');
            } else if (event.type === 'draw') {
                playAttackSound(event.attacker.name, 'miss');
                playAttackSound(event.target.name, 'miss');
            } else if (event.type === 'ranged') {
                playAttackSound(event.attacker.name);
            }
        }
        for (const enemy of section.enemies) this._countKill(enemy);
    }

    /** The ranged bursts in flight: they hurt the player and stain the ground. */
    _updateProjectiles(section, dt) {
        for (const enemy of section?.enemies ?? []) {
            // A burst in flight finishes after the boss's defeat, but it can no
            // longer hurt anyone.
            const outcome = enemy.updateProjectile(dt, this.player);
            if (outcome === 'hit') playAttackSound(enemy.name, 'hit');
        }
    }

    /**
     * The street is over when the mission is finished and no boss is standing:
     * the next street of the game follows; after the last one the game ends.
     */
    _checkStreetComplete(section) {
        if (this.streetFinished) return;
        if (!this.world.isStreetComplete()) return;

        const boss = section?.enemies.find(enemy => enemy.role === 'boss' && enemy.defeated);
        if (boss && !boss.isDeathAnimationDone()) return; // wait for the fall

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
            this._musicOwner = null;
            this.streetFinished = false;
            this._syncAmbient();
        } finally {
            this.transitioning = false;
        }
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

    _countKill(enemy) {
        if (!enemy.defeated || this._countedKills.has(enemy)) return;
        this._countedKills.add(enemy);
        this.session.recordKill(this.player.name);
        // The corpse persists in the session: still lying here on later visits.
        this.session.markDefeated(this.world.streetId, enemy.id, enemy.slot, enemy);
    }

    /** The hostiles currently in fight mode (the HUD shows their HP), in order. */
    _fightingFoes(section) {
        return (section?.enemies ?? []).filter(enemy => enemy.isFighting(this.player));
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

    /** The walkable spot the player stands in, or null. */
    _interactionAt(section) {
        if (!section) return null;
        for (const spot of section.interactions) {
            if (this.player.x >= spot.x1 && this.player.x <= spot.x2) return spot;
        }
        return null;
    }

    /** The context of the triggers and the conditions: the session, the mission, the player. */
    _context() {
        return {
            session: this.session,
            mission: this.session.mission,
            player: this.player,
            streetId: this.world.streetId,
        };
    }

    /** Keeps the HP of the session in step with the player. */
    _syncStats() {
        const stats = this.session.stats[this.player.name];
        if (stats) stats.hp = this.player.hp;
    }

    /**
     * Hands the game to the shared end screen (end-screen.js) exactly once.
     * The game is over: the street goes silent — the death music (`game-over`,
     * defeat only) plays once on the end screen itself (end-screen.js).
     */
    _end(result) {
        if (this.endSent) return;
        this.endSent = true;
        stopAllAudio();
        this.onGameEnd(result);
    }

    /* ---------- Drawing ---------- */

    draw() {
        const { ctx } = this;
        const section = this.world.currentSection;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (section?.background) {
            ctx.drawImage(section.background, 0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        this._drawOverlays(section);

        for (const enemy of section?.enemies ?? []) enemy.draw(ctx);
        this.player.draw(ctx);
        this.blood.draw(ctx); // spray and stains, over the characters

        // HUD stays on top: hearts, coins and carried items at the left;
        // two mission-log rows above the fighting enemies' hearts at the right
        // (one row per foe).
        const foes = this._fightingFoes(section);
        drawHud(ctx, {
            hp: this.session.stats[this.player.name]?.hp ?? 0,
            money: this.session.money,
            items: this.session.inventory,
            enemies: foes.map(foe => ({ hp: foe.hp, maxHp: foe.maxHp })),
            missionLogs: this.session.logRows,
        });
    }

    /** Draws the background overlays of the section (shop signs, waiting poses). */
    _drawOverlays(section) {
        const overlays = section?.model.overlays ?? [];
        overlays.forEach((overlay, index) => {
            if (!matchesCondition(overlay.when, this._context())) return;
            this._drawOverlay(overlayPath(this.world.streetId, section.number, index + 1), overlay);
        });
    }

    /** Draws a static overlay from a `{ x, y }` config at its fixed position. */
    _drawOverlay(path, overlay) {
        let img = this._overlayImages.get(path);
        if (!img) {
            img = new Image();
            img.src = path;
            this._overlayImages.set(path, img);
        }
        if (img.complete && img.naturalWidth > 0) {
            this.ctx.drawImage(img, overlay.x, overlay.y);
        }
    }
}
