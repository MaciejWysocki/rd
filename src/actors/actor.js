// src/actors/actor.js
//
// actor.js
//
// Universal base class for all characters (player, NPCs, bosses).
// All statistics come from a character config file (data/characters/<type>.json):
// speeds, hitbox, sprite and the move set. Owns position, collision box,
// sprite-sheet and row-based animation.
//
// Sprite-sheet convention: 150x150 frames, one animation per row.
//   row 0 (ROW_WALK) - walk cycle, 8 frames
//   each move        - its own row; one attack plays 4 frames. A move with
//                      "alternate": true uses two 4-frame groups in the row and
//                      switches groups on every other attack (e.g. Rudy's punch:
//                      frames 0-3 right hand, 4-7 left hand).
//
// An attack runs from startAttack() until endAttack(). It plays to the last
// frame of the move's group and then holds there (the "full stretch" where the
// hit is resolved); the caller decides when to end it.

import SpriteSheet from '../render/sprite-sheet.js';
import { ATTACK_COOLDOWN_MS } from './combat.js';

export const FRAME_SIZE = 150;
export const ROW_WALK = 0;

const WALK_FRAMES = 8;
const ATTACK_FRAMES = 4;

// Death: the fall plays on the character's death row (4 frames) while the body
// slides a little back (opposite the facing). Sheets without a fall row fall
// back to the rotated placeholder pose.
const DEATH_FRAMES = 4;
const DEATH_FRAME_MS = 150;
const DEATH_SHIFT_PX = 40;

export default class Actor {
    /**
     * @param {object} options
     * @param {number} options.x   Frame top-left X in world px.
     * @param {number} options.y   Frame top-left Y in world px.
     * @param {object} options.def Character config (data/characters/<type>.json).
     */
    constructor({ x = 0, y = 0, def, id = null }) {
        if (!def) throw new Error('Actor wymaga definicji postaci (def)');
        this.def = def;
        this.id = id;
        this.name = def.name;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.facing = 1;
        this.walkSpeed = def.walkSpeed;
        this.walkFrameMs = def.walkFrameMs;
        this.attackFrameMs = def.attackFrameMs;
        this.hitbox = { ...def.hitbox };
        this.moves = def.moves ?? [];
        this.deathRow = def.deathRow ?? null;
        this.deathElapsed = 0;

        const rows = Math.max(0, ...this.moves.map(m => m.row), this.deathRow ?? -1) + 1;
        const rowFrames = Array.from({ length: rows }, () => ATTACK_FRAMES);
        rowFrames[ROW_WALK] = WALK_FRAMES;
        for (const move of this.moves) {
            if (move.alternate) rowFrames[move.row] = ATTACK_FRAMES * 2;
        }
        this.sheet = new SpriteSheet(`assets/sprites/${def.sprite}.png`, FRAME_SIZE, rowFrames);

        this.row = ROW_WALK;
        this.frame = 0;
        this.frameTimer = 0;
        this.drawOffsetY = 0; // vertical draw offset (e.g. jumping), does not affect the hitbox
        this.attacking = false;
        this.attackMove = null;
        this.attackStep = 0;
        this.attackFrameBase = 0;
        this.attackCount = 0;

        // Combat (PLAN.md P0.2): HP counts down to zero, then the character lies
        // defeated. attackResolved marks the blow resolved at full extension;
        // attackCooldownMs is the recovery before the next blow (recoveryMs —
        // 0 for the player: every press is a punch, no delays).
        this.hp = def.hp ?? 1;
        this.maxHp = this.hp;
        this.defeated = false;
        this.attackResolved = false;
        this.attackCooldownMs = 0;
        this.recoveryMs = def.recoveryMs ?? ATTACK_COOLDOWN_MS;
        // Whether this character's blows make the target bleed (owner 2026-10-15:
        // boss_zul does not — `bloodOnTarget: false` in his config).
        this.bloodOnTarget = def.bloodOnTarget !== false;
    }

    load() {
        return this.sheet.load();
    }

    /**
     * Starts an attack with the given move (default: the first configured move).
     * On an "alternate" move, every second attack plays the second 4-frame group.
     * @returns {boolean} false if an attack is already running.
     */
    startAttack(move = this.moves[0]) {
        if (this.attacking || !move) return false;
        this.attacking = true;
        this.attackMove = move;
        this.attackStep = 0;
        this.attackFrameBase = move.alternate && this.attackCount % 2 === 1 ? ATTACK_FRAMES : 0;
        this.attackCount += 1;
        this.row = move.row;
        this.frame = this.attackFrameBase;
        this.frameTimer = 0;
        this.attackResolved = false;
        return true;
    }

    /**
     * Ends the attack and returns to the first walk frame. Safe when no attack
     * is running. Ending a blow starts the character's recovery (recoveryMs).
     */
    endAttack() {
        if (!this.attacking) return;
        this.attacking = false;
        this.attackMove = null;
        this.row = ROW_WALK;
        this.frame = 0;
        this.frameTimer = 0;
        this.attackCooldownMs = this.recoveryMs;
    }

    /** True once the attack has reached its last frame (full stretch; this is where the hit is resolved). */
    isAttackAtFullExtension() {
        return this.attacking && this.attackStep >= ATTACK_FRAMES - 1;
    }

    /** True while this character can be struck (a boss before its fight cannot). */
    canBeHit() {
        return !this.defeated;
    }

    /**
     * Applies one blow. The hit interrupts the struck character's own attack
     * and stuns it for its recovery (recoveryMs — the player has none);
     * HP 0 means defeat.
     * @param {number} amount Damage, 1 per blow in the PoC.
     */
    takeDamage(amount = 1) {
        if (this.defeated) return;
        this.hp = Math.max(0, this.hp - amount);
        this.endAttack();
        this.attackCooldownMs = this.recoveryMs;
        if (this.hp === 0) {
            this.defeated = true;
            this.vx = 0;
            this.deathElapsed = 0;
            this.row = this.deathRow ?? ROW_WALK;
            this.frame = 0;
            this.frameTimer = 0;
        }
    }

    /**
     * Advances the animation. Walk speed scales with |vx| / walkSpeed;
     * an attack plays to its last frame and then holds.
     * @param {number} dt Delta time in ms.
     */
    update(dt) {
        if (this.defeated) {
            this._updateDeath(dt);
            return;
        }
        if (this.attacking) {
            this._updateAttack(dt);
            return;
        }
        const speedFactor = Math.abs(this.vx) / (this.walkSpeed || 1);
        this.frameTimer += dt * speedFactor;
        while (this.frameTimer >= this.walkFrameMs) {
            this.frameTimer -= this.walkFrameMs;
            this.frame = (this.frame + 1) % WALK_FRAMES;
        }
    }

    _updateAttack(dt) {
        this.frameTimer += dt;
        while (this.frameTimer >= this.attackFrameMs && this.attackStep < ATTACK_FRAMES - 1) {
            this.frameTimer -= this.attackFrameMs;
            this.attackStep += 1;
        }
        this.frame = this.attackFrameBase + this.attackStep;
    }

    /** Plays the fall on the death row once, then holds the last (lying) frame. */
    _updateDeath(dt) {
        if (this.deathRow === null) return;
        this.deathElapsed = Math.min(this.deathElapsed + dt, DEATH_FRAMES * DEATH_FRAME_MS);
        this.row = this.deathRow;
        this.frame = Math.min(Math.floor(this.deathElapsed / DEATH_FRAME_MS), DEATH_FRAMES - 1);
    }

    /**
     * Spawns as an already-defeated corpse at the given spot — used when a kill
     * is persisted in the global State and the section is re-entered.
     * @param {{x:number, y:number, facing:number}} position Where the body lies.
     */
    spawnDefeated({ x, y, facing }) {
        this.x = x;
        this.y = y;
        this.facing = facing;
        this.hp = 0;
        this.defeated = true;
        this.deathElapsed = DEATH_FRAMES * DEATH_FRAME_MS;
        if (this.deathRow !== null) {
            this.row = this.deathRow;
            this.frame = DEATH_FRAMES - 1;
        }
    }

    /**
     * Moves by (dx, dy) unless the hitbox would overlap any solid rectangle.
     * @param {Array<{x:number,y:number,w:number,h:number}>} solids
     * @returns {boolean} true if the move was applied.
     */
    tryMove(dx, dy, solids) {
        const nx = this.x + dx;
        const ny = this.y + dy;
        if (this._collides(nx, ny, solids)) return false;
        this.x = nx;
        this.y = ny;
        return true;
    }

    _collides(x, y, solids) {
        const left = x + this.hitbox.x;
        const top = y + this.hitbox.y;
        const right = left + this.hitbox.w;
        const bottom = top + this.hitbox.h;
        return solids.some(s =>
            left < s.x + s.w && right > s.x && top < s.y + s.h && bottom > s.y
        );
    }

    draw(ctx) {
        const drawX = this.x;
        const drawY = this.y - this.drawOffsetY;
        if (!this.defeated) {
            this.sheet.drawFrame(ctx, this.row, this.frame, drawX, drawY, this.facing);
            return;
        }
        if (this.deathRow !== null) {
            // The fall plays on the death row while the body slides a little
            // back (opposite the facing), then holds the lying frame.
            const progress = this.deathElapsed / (DEATH_FRAMES * DEATH_FRAME_MS);
            this.sheet.drawFrame(ctx, this.row, this.frame, drawX - this.facing * DEATH_SHIFT_PX * progress, drawY, this.facing);
            return;
        }
        // Placeholder for sheets without a fall row: the frame lies rotated on
        // the ground (e.g. Rudy until his sheet gets death frames).
        const LIE_DROP_PX = 40;
        ctx.save();
        ctx.translate(drawX + FRAME_SIZE / 2, drawY + FRAME_SIZE / 2 + LIE_DROP_PX);
        ctx.rotate((Math.PI / 2) * this.facing);
        this.sheet.drawFrame(ctx, this.row, this.frame, -FRAME_SIZE / 2, -FRAME_SIZE / 2, this.facing);
        ctx.restore();
    }
}
