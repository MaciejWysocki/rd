// src/game/game-over-state.js
//
// game-over-state.js
//
// The game over screen (PLAN.md P0.6): Rudy's HP hit 0. Shows the session
// statistics from the global State, plays the death music (`game-over.mp3`,
// optional by convention) and offers a restart button that starts a fresh
// game (Enter/Space work too — the game is played on a keyboard). There are
// no saves anywhere: the restart rebuilds the whole game from the character
// config, exactly like booting it.

import { playGameOverMusic, stopGameOverMusic } from '../audio/audio.js';

// Button rectangle in canvas coordinates.
const BUTTON = { x: 600, y: 560, w: 400, h: 80 };

export default class GameOverState {
    /**
     * @param {object} deps
     * @param {CanvasRenderingContext2D} deps.ctx
     * @param {State} deps.state   Global state — the statistics come from here.
     * @param {Keyboard} deps.keyboard
     * @param {Function} deps.onRestart Starts a fresh game.
     */
    constructor({ ctx, state, keyboard, onRestart }) {
        this.ctx = ctx;
        this.state = state;
        this.keyboard = keyboard;
        this.onRestart = onRestart;
        this.restarting = false;
        this._onClick = e => this._handleClick(e);
    }

    onEnter() {
        playGameOverMusic();
        this.ctx.canvas.addEventListener('click', this._onClick);
    }

    onExit() {
        stopGameOverMusic();
        this.ctx.canvas.removeEventListener('click', this._onClick);
    }

    update() {
        if (this.restarting) return;
        if (this.keyboard.consumePress('Enter') || this.keyboard.consumePress('Space')) this._restart();
    }

    draw() {
        const { ctx } = this;
        const { width, height } = ctx.canvas;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#d32f2f';
        ctx.font = 'bold 96px sans-serif';
        ctx.fillText('KONIEC GRY', width / 2, 210);

        ctx.fillStyle = '#fff';
        ctx.font = '36px sans-serif';
        ctx.fillText('Rudy poległ na ulicy.', width / 2, 300);

        ctx.fillStyle = '#bbb';
        ctx.font = '28px sans-serif';
        const seconds = Math.floor(this.state.playTimeMs / 1000);
        const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        const kills = this.state.stats.player?.kills ?? 0;
        const lines = [
            `Czas gry: ${time}`,
            `Pokonani wrogowie: ${kills}`,
            `Monety: ${this.state.money}`,
        ];
        lines.forEach((line, i) => ctx.fillText(line, width / 2, 380 + i * 44));

        // Restart button.
        ctx.fillStyle = '#1b5e20';
        ctx.fillRect(BUTTON.x, BUTTON.y, BUTTON.w, BUTTON.h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText('ZAGRAJ PONOWNIE', BUTTON.x + BUTTON.w / 2, BUTTON.y + BUTTON.h / 2);

        ctx.fillStyle = '#777';
        ctx.font = '20px sans-serif';
        ctx.fillText('kliknij przycisk lub naciśnij Enter', width / 2, BUTTON.y + BUTTON.h + 36);
    }

    _handleClick(e) {
        const canvas = this.ctx.canvas;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        if (x < BUTTON.x || x > BUTTON.x + BUTTON.w || y < BUTTON.y || y > BUTTON.y + BUTTON.h) return;
        this._restart();
    }

    _restart() {
        if (this.restarting) return;
        this.restarting = true;
        this.onRestart();
    }
}
