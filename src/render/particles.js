// src/render/particles.js
//
// particles.js — the shared particle field of the transient effects.
//
// The blood of a hit and the green squares of the boss's spit are the same
// thing: little squares that fly out, arc down under gravity and land on a
// ground line, where they stain it until the section is left. This module
// holds that shared physics; the effects add their own look (the size, the
// color, the way the particles are born) on top of it.
//
// Purely visual — combat and HP never look here.

export default class ParticleField {
    /**
     * @param {object} options
     * @param {number} options.size The edge of one square in px.
     * @param {string} options.color The CSS color of the squares.
     * @param {number} options.gravity The pull down, in px per ms².
     */
    constructor({ size, color, gravity }) {
        this.size = size;
        this.color = color;
        this.gravity = gravity;
        this.particles = [];
    }

    /**
     * Adds one particle.
     * @param {number} x
     * @param {number} y
     * @param {number} vx The horizontal speed (px per ms).
     * @param {number} vy The vertical speed (px per ms).
     * @param {number} groundY The line the particle lands on.
     */
    add(x, y, vx, vy, groundY) {
        this.particles.push({ x, y, vx, vy, groundY, landed: false });
    }

    /**
     * Gravity: the particles fall and stop on their ground line.
     * @param {number} dt Delta time in ms.
     */
    update(dt) {
        for (const p of this.particles) {
            if (p.landed) continue;
            p.vy += this.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.y >= p.groundY) {
                p.y = p.groundY;
                p.landed = true;
            }
        }
    }

    /** True when every particle of the field has landed. */
    get allLanded() {
        return this.particles.every(p => p.landed);
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        for (const p of this.particles) {
            ctx.fillRect(p.x, p.y, this.size, this.size);
        }
    }

    /** The particles are transient: they are wiped together with the section. */
    clear() {
        this.particles.length = 0;
    }
}
