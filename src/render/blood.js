// src/render/blood.js
//
// blood.js
//
// Procedural blood on hits (PLAN.md P1.4): every blow that lands sprays a
// burst of small (3x3 px) red squares out of the struck character. The spray
// flies away from the blow, arcs down under gravity and lands on the ground
// line (the struck character's feet), where the stains stay until the section
// is left. Purely visual — combat and HP never look here.

import { FRAME_SIZE } from '../actors/actor.js';

const PARTICLE_SIZE_PX = 3;
const PARTICLES_PER_HIT = 12;
const GRAVITY_PX_PER_MS2 = 0.003;   // squares arc down and land
const SPRAY_RISE_PX_PER_MS = 0.5;   // initial upward burst
const SPRAY_DRIFT_PX_PER_MS = 0.4;  // pushed away from the blow
const COLOR = '#b30000';

export default class Blood {
    constructor() {
        this.particles = [];
    }

    /**
     * Sprays blood from the struck character.
     * @param {Actor} target The struck character; its feet define the ground line.
     * @param {number} dirX  Direction the spray flies (away from the attacker): -1 or 1.
     */
    spawn(target, dirX) {
        const groundY = target.y + target.hitbox.y + target.hitbox.h;
        const x = target.x + FRAME_SIZE / 2;
        const y = target.y + FRAME_SIZE / 2;
        for (let i = 0; i < PARTICLES_PER_HIT; i++) {
            this.particles.push({
                x,
                y,
                vx: dirX * Math.random() * SPRAY_DRIFT_PX_PER_MS,
                vy: -Math.random() * SPRAY_RISE_PX_PER_MS,
                groundY,
                landed: false,
            });
        }
    }

    /** Gravity: the spray falls and stops on the ground line. */
    update(dt) {
        for (const p of this.particles) {
            if (p.landed) continue;
            p.vy += GRAVITY_PX_PER_MS2 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.y >= p.groundY) {
                p.y = p.groundY;
                p.landed = true;
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = COLOR;
        for (const p of this.particles) {
            ctx.fillRect(p.x, p.y, PARTICLE_SIZE_PX, PARTICLE_SIZE_PX);
        }
    }

    /** Blood is transient: it is wiped together with the section on leaving it. */
    clear() {
        this.particles.length = 0;
    }
}
