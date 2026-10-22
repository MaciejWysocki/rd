// src/render/blood.js
//
// blood.js
//
// Procedural blood on hits (PLAN.md P1.4): every blow that lands sprays a
// burst of small (3x3 px) red squares out of the struck character. The spray
// flies away from the blow, arcs down under gravity and lands on the ground
// line (the struck character's feet), where the stains stay until the
// section is left. Purely visual — combat and HP never look here.
//
// The physics of the squares is the shared particle field
// (render/particles.js); this module only says how the blood looks and
// where it is born.

import ParticleField from './particles.js';
import { FRAME_SIZE } from '../domain/content/asset-conventions.js';

const PARTICLES_PER_HIT = 12;
const SPRAY_RISE_PX_PER_MS = 0.5;   // initial upward burst
const SPRAY_DRIFT_PX_PER_MS = 0.4;  // pushed away from the blow
const GRAVITY_PX_PER_MS2 = 0.003;   // squares arc down and land
const COLOR = '#b30000';

export default class Blood {
    constructor() {
        this.field = new ParticleField({ size: 3, color: COLOR, gravity: GRAVITY_PX_PER_MS2 });
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
            this.field.add(
                x,
                y,
                dirX * Math.random() * SPRAY_DRIFT_PX_PER_MS,
                -Math.random() * SPRAY_RISE_PX_PER_MS,
                groundY,
            );
        }
    }

    /** Gravity: the spray falls and stops on the ground line. */
    update(dt) {
        this.field.update(dt);
    }

    draw(ctx) {
        this.field.draw(ctx);
    }

    /** Blood is transient: it is wiped together with the section on leaving it. */
    clear() {
        this.field.clear();
    }
}
