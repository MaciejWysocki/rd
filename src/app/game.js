// src/app/game.js
//
// game.js
//
// The game loop and the screen switch. It uses requestAnimationFrame to drive
// the loop with delta time (milliseconds) and holds the session — the state
// that survives a screen change. The current screen must expose `update(dt)`
// and `draw()`.

export default class Game {
    /**
     * @param {Session} session The session shared by the screens.
     */
    constructor(session) {
        this.session = session;
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
