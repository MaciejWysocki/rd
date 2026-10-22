// src/app/game.js
//
// game.js
//
// The game loop and the screen switch. It uses requestAnimationFrame to drive
// the loop with delta time (milliseconds). The current screen must expose
// `update(dt)` and `draw()`.

export default class Game {
    constructor() {
        this.currentState = null;
        this.lastTimestamp = 0;
        this.running = false;
        // The loop is bound once: a new bound function every frame would be
        // garbage the collector has to clean up 60 times a second.
        this._loop = this._loop.bind(this);
    }

    /**
     * Start the main loop.
     */
    start() {
        if (this.running) return;
        this.running = true;
        this.lastTimestamp = performance.now();
        requestAnimationFrame(this._loop);
    }

    _loop(now) {
        if (!this.running) return;
        const deltaTime = now - this.lastTimestamp;
        this.lastTimestamp = now;
        this.update(deltaTime);
        this.draw();
        requestAnimationFrame(this._loop);
    }

    update(deltaTime) {
        this.currentState?.update?.(deltaTime);
    }

    draw() {
        this.currentState?.draw?.();
    }

    changeState(newState) {
        this.currentState?.onExit?.();
        this.currentState = newState;
        this.currentState?.onEnter?.();
    }
}
