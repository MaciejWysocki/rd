// src/domain/actors/actor.js
//
// actor.js
//
// Universal base class for all characters (player, enemies). Pure domain
// code: it never touches the DOM — the sprite sheet is injected by the
// application layer and only the interface { drawFrame(ctx, row, frame, x, y,
// facing) } (plus an optional load()) is required.
//
// All statistics come from the normalized Character model (the content layer
// builds it from data/characters/<type>.json): speeds, hitbox, sprite and the
// move set. Owns position, collision box and row-based animation.
//
// Sprite-sheet convention: 150x150 frames, one animation per row.
//   row 0 (ROW_WALK) - walk cycle, 8 frames
//   each move        - its own row; one attack plays the move's frames (default
//                      4: the config's moves[].frames). A move with
//                      "alternate": true uses two groups of that many frames in
//                      the row and switches groups on every other attack (e.g.
//                      Rudy's punch: frames 0-3 right hand, 4-7 left hand).
//
// An attack runs from startAttack() until endAttack(). It plays to the last
// frame of the move's group and then holds there (the "full stretch" where the
// hit is resolved); the caller decides when to end it.
//
// The frame of an actor is advanced by advance(dt) — the shared animation
// step. The subclasses add their own input handling in update(dt, env); the
// signature is the same for every actor, so any actor can be stepped the same
// way (see env in Player and Enemy).

import { ATTACK_COOLDOWN_MS, HIT_KNOCKBACK_PX } from '../combat/combat.js';
import { FRAME_SIZE, WALK_FRAMES, ATTACK_FRAMES } from '../content/asset-conventions.js';
import { shitboxRect } from './shitbox.js';

export const ROW_WALK = 0;

// Which way an actor faces: the words of the street config ("facing": "left" /
// "right") and the sign the sprite mirror and the movement use. The vocabulary
// lives here, with the field it describes — the config schema validates
// against this table (street-schema.js), never the other way round.
export const FACING = { left: -1, right: 1 };

// Death: the fall plays on the character's death row while the body slides a
// little the way the killing blow pushed it — hit from behind, the enemy falls
// forward (owner 2026-10-24). The row has `deathFrames` frames (default
// 4; Rudy's row 2 uses all 8 — owner 2026-10-15). Sheets without a fall row
// fall back to the rotated placeholder pose.
const DEATH_FRAMES = 4;
const DEATH_FRAME_MS = 150;
const DEATH_SHIFT_PX = 40;

export default class Actor {
    /**
     * @param {object} options
     * @param {number} options.x         Frame top-left X in world px.
     * @param {number} options.y         Frame top-left Y in world px.
     * @param {object} options.character Normalized Character model.
     * @param {object} options.sheet      Sprite sheet: { drawFrame(ctx, row, frame, x, y, facing) }.
     * @param {string|null} options.id    Street-entity id (the label of the entity).
     * @param {number} options.hue        The hue shift of the actor in degrees (0 = the
     *                                    original colors). The sheet bakes it into the
     *                                    pixels; the HUD tints the actor's HP row with it.
     */
    constructor({ x = 0, y = 0, character, sheet, id = null, hue = 0 }) {
        if (!character) throw new Error('Actor wymaga modelu postaci (character)');
        if (!sheet) throw new Error('Actor wymaga arkusza sprite\'ow (sheet)');
        this.character = character;
        this.sheet = sheet;
        this.id = id;
        this.hue = hue;
        this.name = character.name;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.facing = 1;
        this.walkSpeed = character.walkSpeed;
        this.walkFrameMs = character.walkFrameMs ?? 80;
        this.attackFrameMs = character.attackFrameMs;
        this.walkFrames = character.walkFrames ?? WALK_FRAMES;
        this.attackFrames = character.attackFrames ?? ATTACK_FRAMES;
        this.hitbox = { ...character.hitbox };
        this.moves = character.moves ?? [];
        this.deathRow = character.deathRow ?? null;
        this.deathFrames = character.deathFrames ?? DEATH_FRAMES;
        this.deathElapsed = 0;
        // The way the body slides while it falls: the direction of the blow
        // that killed it (set in takeDamage / spawnDefeated).
        this.deathSlideDir = -this.facing;

        this.row = ROW_WALK;
        this.frame = 0;
        this.frameTimer = 0;
        this.drawOffsetY = 0; // vertical draw offset (e.g. jumping), does not affect the hitbox
        this.attacking = false;
        this.attackMove = null;
        this.attackStep = 0;
        this.attackElapsedMs = 0;
        this.attackFrameBase = 0;
        this.attackCount = 0;

        // HP counts down to defeat. A blow resolves once at full extension;
        // recovery is per character (0 for Rudy: every press is a punch).
        this.hp = character.hp ?? 1;
        this.maxHp = character.maxHp ?? this.hp;
        this.defeated = false;
        // True when the actor was already lying on the ground when the section
        // was entered (a corpse restored from the session) — nobody killed him
        // just now, so the kill is not counted again.
        this.spawnedDefeated = false;
        this.attackResolved = false;
        this.attackCooldownMs = 0;
        this.recoveryMs = character.recoveryMs ?? ATTACK_COOLDOWN_MS;
        // Whether this character's blows make the target bleed (owner 2026-10-15:
        // zul-mietek does not — `bloodOnTarget: false` in his config).
        this.bloodOnTarget = character.bloodOnTarget !== false;
    }

    /** Resolves when the injected sheet is ready (the sheet may expose load()). */
    load() {
        if (typeof this.sheet?.load === 'function') return this.sheet.load();
        return Promise.resolve(this.sheet);
    }

    /**
     * Starts an attack with the given move (default: the first configured move).
     * On an "alternate" move, every second attack plays the second frame group.
     * @returns {boolean} false if an attack is already running.
     */
    startAttack(move = this.moves[0]) {
        if (this.attacking || !move) return false;
        this.attacking = true;
        this.attackMove = move;
        this.attackStep = 0;
        this.attackElapsedMs = 0;
        // The frame count of the running attack comes from the move
        // (moves[].frames in the config; the character's default when absent).
        this.attackFrames = move.frames ?? this.character.attackFrames ?? ATTACK_FRAMES;
        this.attackFrameBase = move.alternate && this.attackCount % 2 === 1 ? this.attackFrames : 0;
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
        return this.attacking && this.attackStep >= this.attackFrames - 1;
    }

    /** Signed time to full extension; negative means it finished earlier this frame. */
    attackFinishInMs() {
        return (this.attackFrames - 1) * this.attackFrameMs - this.attackElapsedMs;
    }

    /** True while this character can be struck (a sentry before its fight cannot). */
    canBeHit() {
        return !this.defeated;
    }

    /** Applies damage and interrupts the target's blow; melee hits supply a knockback direction. */
    takeDamage(amount = 1, direction = 0, solids = []) {
        if (this.defeated) return;
        this.hp = Math.max(0, this.hp - amount);
        this.endAttack();
        this.attackCooldownMs = this.recoveryMs;
        if (direction !== 0) this._knockBack(direction, solids);
        if (this.hp === 0) {
            this.defeated = true;
            this.vx = 0;
            this.deathElapsed = 0;
            this.row = this.deathRow ?? ROW_WALK;
            this.frame = 0;
            this.frameTimer = 0;
            // The body falls the way the blow pushed it: hit from behind, the
            // enemy falls forward (owner 2026-10-24). A blow with no direction
            // (the vomit) falls back to the old behaviour: opposite the facing.
            this.deathSlideDir = direction !== 0 ? Math.sign(direction) : -this.facing;
        }
    }

    /** Sweeps the configured knockback distance without crossing a solid or a street-end wall. */
    _knockBack(direction, solids) {
        const { left, right, top, bottom } = shitboxRect(this);
        let dx = Math.sign(direction) * HIT_KNOCKBACK_PX;
        for (const solid of solids) {
            if (bottom <= solid.y || top >= solid.y + solid.h) continue;
            if (dx > 0 && solid.x >= right) dx = Math.min(dx, solid.x - right);
            if (dx < 0 && solid.x + solid.w <= left) dx = Math.max(dx, solid.x + solid.w - left);
        }
        this.tryMove(dx, 0, solids);
    }

    /**
     * Advances the animation. Walk speed scales with |vx| / walkSpeed;
     * an attack plays to its last frame and then holds.
     * @param {number} dt Delta time in ms.
     */
    advance(dt) {
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
            this.frame = (this.frame + 1) % this.walkFrames;
        }
    }

    /**
     * Steps the actor by one frame. The base implementation only advances the
     * animation; the subclasses read their input from `env`.
     * @param {number} dt Delta time in ms.
     * @param {object} env The world around the actor: { keyboard, solids, target }.
     */
    update(dt, env = {}) {
        this.advance(dt);
    }

    _updateAttack(dt) {
        this.attackElapsedMs += dt;
        this.frameTimer += dt;
        while (this.frameTimer >= this.attackFrameMs && this.attackStep < this.attackFrames - 1) {
            this.frameTimer -= this.attackFrameMs;
            this.attackStep += 1;
        }
        this.frame = this.attackFrameBase + this.attackStep;
    }

    /** Plays the fall on the death row once, then holds the last (lying) frame. */
    _updateDeath(dt) {
        if (this.deathRow === null) return;
        this.deathElapsed = Math.min(this.deathElapsed + dt, this.deathFrames * DEATH_FRAME_MS);
        this.row = this.deathRow;
        this.frame = Math.min(Math.floor(this.deathElapsed / DEATH_FRAME_MS), this.deathFrames - 1);
    }

    /**
     * True once the fall has played out and the body lies still — the game
     * waits for it before the end screen freezes the scene (owner 2026-10-15:
     * Rudy's death is animated and slides away, like every other character).
     */
    isDeathAnimationDone() {
        return this.deathRow === null || this.deathElapsed >= this.deathFrames * DEATH_FRAME_MS;
    }

    /**
     * Spawns as an already-defeated corpse at the given spot — used when a kill
     * is persisted in the session and the section is re-entered.
     * @param {{x:number, y:number, facing:number, deathSlideDir:number}} position
     *        Where the body lies and the way it fell.
     */
    spawnDefeated({ x, y, facing, deathSlideDir }) {
        this.x = x;
        this.y = y;
        this.facing = facing;
        this.deathSlideDir = deathSlideDir ?? -this.facing;
        this.hp = 0;
        this.defeated = true;
        this.spawnedDefeated = true;
        this.deathElapsed = this.deathFrames * DEATH_FRAME_MS;
        if (this.deathRow !== null) {
            this.row = this.deathRow;
            this.frame = this.deathFrames - 1;
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
        const { left, right, top, bottom } = shitboxRect(this, x, y);
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
            // the way the killing blow pushed it, then holds the lying frame.
            const progress = this.deathElapsed / (this.deathFrames * DEATH_FRAME_MS);
            this.sheet.drawFrame(ctx, this.row, this.frame, drawX + this.deathSlideDir * DEATH_SHIFT_PX * progress, drawY, this.facing);
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
