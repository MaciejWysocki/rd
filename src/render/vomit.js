// src/render/vomit.js
//
// vomit.js
//
// The boss's ranged attack: a burst of small (5x5 px) green squares spat from
// its mouth toward the player (owner 2026-10-15). The burst flies in an arc
// and can hurt eligible targets within VOMIT_HIT_PX of the mouth; then it
// keeps flying and lands at about VOMIT_RANGE_PX, staining the ground until
// the section is left. Each burst hurts each target at most once and never
// sprays blood. A player who jumps over the spray is not hit.
//
// The physics of the squares is the shared particle field
// (render/particles.js); this module only says how the spit looks, where it
// is born and when it hurts.

import ParticleField from './particles.js';
import { FRAME_SIZE } from '../domain/content/asset-conventions.js';

const PARTICLES_PER_BURST = 40;    // enough squares to read as a visible spray (owner 2026-10-15)
export const VOMIT_HIT_PX = 300;   // the burst can hurt the player this far from the mouth
export const VOMIT_RANGE_PX = 600; // where the squares land on the ground
// The spray flies twice as slow (owner 2026-10-15): halved speeds and quartered
// gravity keep the exact same arc — the same hit and landing ranges — over a
// flight that takes twice as long.
const GRAVITY_PX_PER_MS2 = 0.00075;
const FLIGHT_MS = 680;             // ~VOMIT_RANGE_PX of horizontal travel
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
        const field = new ParticleField({ size: 5, color: COLOR, gravity: GRAVITY_PX_PER_MS2 });
        for (let i = 0; i < PARTICLES_PER_BURST; i++) {
            field.add(
                originX,
                originY,
                speedX * (0.9 + Math.random() * 0.2),
                -(0.075 + Math.random() * 0.125),
                groundY,
            );
        }
        this.bursts.push({ originX, dirX, field, victims: new Set(), expired: false });
    }

    /**
     * Gravity plus the hit test. Returns 'hit', 'miss' or null.
     * @param {number} dt Delta time in ms.
     * @param {Array<Actor>} targets Eligible targets.
     * @param {Function} onHit Applies damage to a reached target.
     * @param {Actor} source The attacker, excluded from its own spray.
     */
    update(dt, targets = [], onHit, source) {
        let landedUnhit = false;
        let hitLanded = false;
        for (const burst of this.bursts) {
            burst.field.update(dt);
            if (burst.expired) continue;
            const travelled = (this._leadX(burst) - burst.originX) * burst.dirX;
            if (travelled <= VOMIT_HIT_PX) {
                for (const target of targets) {
                    if (target === source || target.defeated || !target.canBeHit()
                        || burst.victims.has(target) || !this._reaches(burst, target)) continue;
                    burst.victims.add(target);
                    onHit(target);
                    hitLanded = true;
                }
            }
            if (burst.field.allLanded) {
                burst.expired = true;
                if (burst.victims.size === 0) landedUnhit = true;
            }
        }
        // Landed bursts stay as stains until the section is left.
        return hitLanded ? 'hit' : (landedUnhit ? 'miss' : null);
    }

    /** The particle that is furthest along the flight direction. */
    _leadX(burst) {
        let lead = burst.field.particles[0].x;
        for (const p of burst.field.particles) {
            if (burst.dirX > 0 ? p.x > lead : p.x < lead) lead = p.x;
        }
        return lead;
    }

    /** True while the burst is within the hit range and its squares touch the player. */
    _reaches(burst, target) {
        // Jumping over the spray dodges it (owner 2026-10-15): the burst only
        // hits a player standing on the ground — it flies under a hopping one.
        if (target.jumping || target.drawOffsetY > 0) return false;
        const left = target.x;
        const right = left + FRAME_SIZE;
        const top = target.y;
        const bottom = top + FRAME_SIZE;
        return burst.field.particles.some(p => p.x >= left && p.x <= right && p.y >= top && p.y <= bottom);
    }

    draw(ctx) {
        for (const burst of this.bursts) {
            burst.field.draw(ctx);
        }
    }

    /** Transient like the section it stains. */
    clear() {
        this.bursts.length = 0;
    }
}
