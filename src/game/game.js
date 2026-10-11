// src/game/Game.js

// Import the persistent State class
import State from '../save/state.js';

/**
 * Game class manages the main game loop and state transitions.
 * It uses requestAnimationFrame to drive the loop with delta time.
 * It holds a persistent State instance and a current state
 * which must expose `update(deltaTime)` and `draw()` methods.
 */

export default class Game {
    constructor() {
        this.state = new State();
        this.currentState = null;
        this.lastTimestamp = 0;
        this.running = false;
    }

    /**
     * Start the main loop.
     */
    start() {
        if (this.running) return;
        this.running = true;
        this.lastTimestamp = performance.now();
        requestAnimationFrame(this._loop.bind(this));
    }

    _loop(now) {
        if (!this.running) return;
        const deltaTime = now - this.lastTimestamp;
        this.lastTimestamp = now;
        this.update(deltaTime);
        this.draw();
        requestAnimationFrame(this._loop.bind(this));
    }

    update(deltaTime) {
        if (this.currentState && typeof this.currentState.update === 'function') {
            this.currentState.update(deltaTime);
        }
    }

    draw() {
        if (this.currentState && typeof this.currentState.draw === 'function') {
            this.currentState.draw();
        }
    }

    changeState(newState) {
        if (this.currentState && typeof this.currentState.onExit === 'function') {
            this.currentState.onExit();
        }
        this.currentState = newState;
        if (this.currentState && typeof this.currentState.onEnter === 'function') {
            this.currentState.onEnter();
        }
    }
}
