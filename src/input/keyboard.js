// src/input/keyboard.js

/**
 * keyboard.js
 *
 * Tracks held keys and one-shot presses by their physical code (e.g. "ArrowLeft").
 */

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export default class Keyboard {
    constructor(target = window) {
        this.target = target;
        this.down = new Set();
        this.pressed = new Set();

        this._onKeyDown = e => {
            if (GAME_KEYS.has(e.code)) e.preventDefault();
            if (!e.repeat) this.pressed.add(e.code);
            this.down.add(e.code);
        };
        this._onKeyUp = e => this.down.delete(e.code);
        this._onBlur = () => {
            this.down.clear();
            this.pressed.clear();
        };

        target.addEventListener('keydown', this._onKeyDown);
        target.addEventListener('keyup', this._onKeyUp);
        target.addEventListener('blur', this._onBlur);
    }

    isDown(code) {
        return this.down.has(code);
    }

    /**
     * Returns true once per physical press, then clears it.
     * Holding the key does not trigger it again.
     */
    consumePress(code) {
        return this.pressed.delete(code);
    }

    /** -1 for left, 1 for right, 0 when neither or both are held. */
    horizontal() {
        const left = this.isDown('ArrowLeft');
        const right = this.isDown('ArrowRight');
        if (left === right) return 0;
        return right ? 1 : -1;
    }

    destroy() {
        this.target.removeEventListener('keydown', this._onKeyDown);
        this.target.removeEventListener('keyup', this._onKeyUp);
        this.target.removeEventListener('blur', this._onBlur);
    }
}
