// src/domain/actors/hitbox.js
//
// hitbox.js — the collision box of an actor in world coordinates.
//
// The box of a character is defined per character config ({ x, y, w, h },
// relative to the 150x150 frame). These helpers turn it into the world
// rectangle the combat, the knockback and the AI work with. One place for
// the arithmetic: it must not drift between the strike check, the
// knockback sweep and the distance checks.

/**
 * The collision box of an actor in world coordinates.
 * @param {Actor} actor The actor (its hitbox and its position).
 * @param {number} [x] The frame's left edge (defaults to the actor's x).
 * @param {number} [y] The frame's top edge (defaults to the actor's y).
 * @returns {{left:number,right:number,top:number,bottom:number}} The box.
 */
export function hitboxRect(actor, x = actor.x, y = actor.y) {
    const left = x + actor.hitbox.x;
    const top = y + actor.hitbox.y;
    return { left, right: left + actor.hitbox.w, top, bottom: top + actor.hitbox.h };
}

/** The horizontal centre of the actor's hitbox. */
export function centerX(actor) {
    return actor.x + actor.hitbox.x + actor.hitbox.w / 2;
}

/** The vertical centre of the actor's hitbox. */
export function centerY(actor) {
    return actor.y + actor.hitbox.y + actor.hitbox.h / 2;
}
