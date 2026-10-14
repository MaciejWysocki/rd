// src/render/vomit.js
//
// vomit.js
//
// The boss's ranged attack: a burst of small (3x3 px) green squares spat from
// its mouth toward the player (owner 2026-10-15). The burst flies in an arc
// and can hurt the player within VOMIT_HIT_PX of the mouth ("in about 150 px
// it should hit and hurt the player"); then it keeps flying and the squares
// land on the ground at about VOMIT_RANGE_PX ("fly and fall down in 300 px"),
// staining it until the section is left. One burst hurts at most once and
// never sprays blood — the green squares are the whole effect.

import { FRAME_SIZE } from '../actors/actor.js';

const PARTICLE_SIZE_PX = 3;
const PARTICLES_PER_BURST = 14;
export const VOMIT_HIT_PX = 150;   // the burst can hurt the player this far from the mouth
export const VOMIT_RANGE_PX = 300; // where the squares land on the ground
const GRAVITY_PX_PER_MS2 = 0.003;
const FLIGHT_MS = 340;             // ~VOMIT_RANGE_PX of horizontal travel
const MOUTH_OFFSET_PX = 40;        // the mouth is ahead of the frame centre
const MOUTH_HEIGHT_PX = 60;        // ...and this far below the frame top
const COLOR = '#2e8b2e';

export default class Vomit {
    constructor() {
        this.bursts = [];
    }

    /**
     * Spits one burst from the boss's mouth toward the player.
     * @param {Actor} boss    The spitting boss (its mouth is the origin).
     * @param {number} dirX   Direction of the spit: -1 or 1.
     */
    spawn(boss, dirX) {
        const originX = boss.x + FRAME_SIZE / 2 + dirX * MOUTH_OFFSET_PX;
        const originY = boss.y + MOUTH_HEIGHT_PX;
        const groundY = boss.y + boss.hitbox.y + boss.hitbox.h;
        const speedX = dirX * VOMIT_RANGE_PX / FLIGHT_MS;
        const particles = [];
        for (let i = 0; i < PARTICLES_PER_BURST; i++) {
            particles.push({
                x: originX,
                y: originY,
                vx: speedX * (0.9 + Math.random() * 0.2),
                vy: -(0.15 + Math.random() * 0.25),
                landed: false,
            });
        }
        this.bursts.push({ originX, dirX, groundY, particles, hit: false });
    }

    /**
     * Gravity plus the hit test. Returns true once per burst, the moment its
     * squares reach the player within the hit range — the caller applies the
     * damage (1, like every blow). A burst that lands without hitting is over.
     * @param {number} dt Delta time in ms.
     * @param {Actor|null} target The player, when present and hittable.
     */
    update(dt, target = null) {
        let landedUnhit = false;
        let hitLanded = false;
        for (const burst of this.bursts) {
            let allLanded = true;
            for (const p of burst.particles) {
                if (p.landed) continue;
                p.vy += GRAVITY_PX_PER_MS2 * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                if (p.y >= burst.groundY) {
                    p.y = burst.groundY;
                    p.landed = true;
                } else {
                    allLanded = false;
                }
            }
            if (!burst.hit && target && this._reaches(burst, target)) {
                burst.hit = true;
                hitLanded = true;
            }
            if (allLanded && !burst.hit) {
                burst.hit = true; // over: it can no longer hurt anyone
                landedUnhit = true;
            }
        }
        // Landed bursts stay: the green squares are stains until the section is
        // left (they are wiped with the boss on section exit).
        return hitLanded ? 'hit' : (landedUnhit ? 'miss' : null);
    }

    /** The particle that is furthest along the flight direction. */
    _leadX(burst) {
        let lead = burst.particles[0].x;
        for (const p of burst.particles) {
            if (burst.dirX > 0 ? p.x > lead : p.x < lead) lead = p.x;
        }
        return lead;
    }

    /** True while the burst is within the hit range and its squares touch the player. */
    _reaches(burst, target) {
        const travelled = (this._leadX(burst) - burst.originX) * burst.dirX;
        if (travelled > VOMIT_HIT_PX) return false;
        const left = target.x;
        const right = left + FRAME_SIZE;
        const top = target.y;
        const bottom = top + FRAME_SIZE;
        return burst.particles.some(p => p.x >= left && p.x <= right && p.y >= top && p.y <= bottom);
    }

    draw(ctx) {
        ctx.fillStyle = COLOR;
        for (const burst of this.bursts) {
            for (const p of burst.particles) {
                ctx.fillRect(p.x, p.y, PARTICLE_SIZE_PX, PARTICLE_SIZE_PX);
            }
        }
    }

    /** Transient like the section it stains. */
    clear() {
        this.bursts.length = 0;
    }
}
