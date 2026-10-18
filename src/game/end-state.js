// src/game/end-state.js
//
// end-state.js
//
// The shared game end screen (PLAN.md P0.5/P0.6): defeat and victory work the
// same and look the same. The game freezes and a two-thirds-of-the-screen
// panel takes over the frozen scene: a big result message ("PRZEGRAŁEŚ!" /
// "GRATULACJE! WYGRAŁEŚ GRĘ!"), the session statistics from the global State
// (game time, defeated enemies, HP and money left) and a restart button that
// starts a fresh game — a click on the button or Enter; Space does NOT restart
// (owner 2026-10-15: hitting Space while reading the win screen must not wipe
// it). On defeat the death music (`game-over.mp3`) plays ONCE behind the panel;
// on victory the victory jingle (`<street>-congratulations`) plays ONCE — no
// loops: after either ends the panel stays silent (owner 2026-10-14/15). There
// are no saves anywhere: the restart rebuilds the whole game from the character
// config, exactly like booting it.

import { playGameOverMusic, playCongratulations, stopAllAudio } from '../audio/audio.js';

// The result panel: a rectangle of 2/3 of the screen, centered.
const PANEL_SCALE = 2 / 3;

// Play-again button size; its position is laid out relative to the panel.
const BUTTON_W = 400;
const BUTTON_H = 80;

export default class EndState {
    /**
     * @param {object} deps
     * @param {CanvasRenderingContext2D} deps.ctx
     * @param {State} deps.state   Global state — the statistics come from here.
     * @param {Keyboard} deps.keyboard
     * @param {'lost'|'won'} deps.result Which message the panel shows.
     * @param {string} deps.streetName Street id — the victory jingle is `<street>-congratulations`.
     * @param {Function} deps.onRestart Starts a fresh game.
     * @param {Function|null} deps.drawScene Renders the frozen gameplay scene behind the panel.
     */
    constructor({ ctx, state, keyboard, result, streetName, onRestart, drawScene = null }) {
        this.ctx = ctx;
        this.state = state;
        this.keyboard = keyboard;
        this.result = result;
        this.streetName = streetName;
        this.onRestart = onRestart;
        this.drawScene = drawScene;
        this.restarting = false;
        this._onClick = e => this._handleClick(e);
    }

    onEnter() {
        // End-screen music, played ONCE (no loop): the death music on defeat,
        // the victory jingle when the game is won.
        if (this.result === 'lost') playGameOverMusic();
        else playCongratulations(this.streetName);
        this.ctx.canvas.addEventListener('click', this._onClick);
    }

    onExit() {
        stopAllAudio(); // the fresh game starts its own ambience (play-state.js)
        this.ctx.canvas.removeEventListener('click', this._onClick);
    }

    /** The game is stopped: only the play-again button (click or Enter) does anything. */
    update() {
        if (this.restarting) return;
        if (this.keyboard.consumePress('Enter')) this._restart();
    }

    draw() {
        const { ctx } = this;
        const { width, height } = ctx.canvas;

        // The game is stopped, not hidden: the frozen scene stays behind the panel.
        if (this.drawScene) {
            this.drawScene();
        } else {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
        }

        const pw = width * PANEL_SCALE;
        const ph = height * PANEL_SCALE;
        const px = (width - pw) / 2;
        const py = (height - ph) / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
        ctx.fillRect(px, py, pw, ph);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const won = this.result === 'won';
        ctx.fillStyle = won ? '#2e7d32' : '#d32f2f';
        ctx.font = '36px "Press Start 2P"';
        ctx.fillText(won ? 'GRATULACJE! WYGRAŁEŚ GRĘ!' : 'PRZEGRAŁEŚ!', width / 2, py + 70);

        ctx.fillStyle = '#fff';
        ctx.font = '24px "Press Start 2P"';
        ctx.fillText(won ? 'Pokonałeś żula!' : 'Rudy poległ na ulicy.', width / 2, py + 135);

        ctx.fillStyle = '#bbb';
        ctx.font = '20px "Press Start 2P"';
        const seconds = Math.floor(this.state.playTimeMs / 1000);
        const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        const stats = this.state.stats.player ?? {};
        const lines = [
            `Czas gry: ${time}`,
            `Pokonani wrogowie: ${stats.kills ?? 0}`,
            `Pozostałe HP: ${stats.hp ?? 0}`,
            `Monety: ${this.state.money}`,
        ];
        lines.forEach((line, i) => ctx.fillText(line, width / 2, py + 195 + i * 42));

        const button = this._buttonRect(px, py, pw, ph);
        ctx.fillStyle = '#1b5e20';
        ctx.fillRect(button.x, button.y, button.w, button.h);
        ctx.fillStyle = '#fff';
        ctx.font = '24px "Press Start 2P"';
        ctx.fillText('ZAGRAJ PONOWNIE', button.x + button.w / 2, button.y + button.h / 2);

        ctx.fillStyle = '#777';
        ctx.font = '16px "Press Start 2P"';
        ctx.fillText('kliknij przycisk lub naciśnij Enter', width / 2, button.y + button.h + 36);
    }

    /** The play-again button: centered horizontally near the bottom of the panel. */
    _buttonRect(px, py, pw, ph) {
        return { x: px + (pw - BUTTON_W) / 2, y: py + ph - 165, w: BUTTON_W, h: BUTTON_H };
    }

    _handleClick(e) {
        const canvas = this.ctx.canvas;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        const pw = canvas.width * PANEL_SCALE;
        const ph = canvas.height * PANEL_SCALE;
        const button = this._buttonRect((canvas.width - pw) / 2, (canvas.height - ph) / 2, pw, ph);
        if (x < button.x || x > button.x + button.w || y < button.y || y > button.y + button.h) return;
        this._restart();
    }

    _restart() {
        if (this.restarting) return;
        this.restarting = true;
        this.onRestart();
    }
}
