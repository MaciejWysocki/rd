// src/app/combat-feedback.js
//
// combat-feedback.js — what the combat events look and sound like.
//
// The combat itself is pure domain code: the arbitration returns the events
// (hit / miss / draw / ranged) and plays nothing. This adapter turns those
// events into the sounds and the blood of the game — the one place that
// knows how a landed blow looks.

import Blood from '../render/blood.js';
import { playAttackSound } from '../audio/audio.js';

export default class CombatFeedback {
    constructor() {
        this.blood = new Blood();
    }

    /**
     * Reacts to the events of one arbitration.
     * @param {Array<object>} events The events of the arbitration.
     */
    applyEvents(events) {
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
    }

    /** The sound of a ranged burst that hit the player. */
    playImpact(attacker) {
        playAttackSound(attacker.name, 'hit');
    }

    /** @param {number} dt Delta time in ms. */
    update(dt) {
        this.blood.update(dt);
    }

    draw(ctx) {
        this.blood.draw(ctx);
    }

    /** Blood is transient: it is wiped together with the section on leaving it. */
    clear() {
        this.blood.clear();
    }
}
