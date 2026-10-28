import Enemy from './enemy.js';

/** A pedestrian who fights only in response to an actual attacker. */
export default class Neutral extends Enemy {
    constructor(options) {
        super({ ...options, role: 'neutral', trigger: { type: 'hit' } });
        this.combatTarget = null;
    }

    takeDamage(amount = 1, direction = 0, solids = [], attacker = null) {
        const previousHp = this.hp;
        super.takeDamage(amount, direction, solids, attacker);
        if (!this.defeated && this.hp < previousHp && attacker && attacker !== this
            && !attacker.defeated && typeof attacker.canBeHit === 'function') {
            this.combatTarget = attacker;
        }
    }

    canBeHit() {
        return !this.defeated;
    }

    engagedWith(target) {
        return !this.defeated && target === this.combatTarget && Boolean(target) && target.canBeHit();
    }

    isFighting(target) {
        return this.engagedWith(target);
    }

    selectTarget() {
        return this.combatTarget;
    }

    update(dt, env = {}) {
        if (this.combatTarget?.defeated) {
            this.combatTarget = null;
            // A landed blow may still have recovery frames to play.
            if (!this.attackResolved || this.attackHitFrame === this.attackFrames - 1) this.endAttack();
        }
        super.update(dt, env);
    }
}
