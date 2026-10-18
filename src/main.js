import Game from './game/game.js';
import WorldManager from './world/world-manager.js';
import Player from './actors/player.js';
import { loadCharacterDef } from './actors/character-defs.js';
import Keyboard from './input/keyboard.js';
import PlayState from './game/play-state.js';
import EndState from './game/end-state.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const game = new Game();

const world = new WorldManager(game.state);
await world.loadStreet('data/streets/ulica-01.json');

const playerDef = await loadCharacterDef('player');

const gameKeys = [
    ...playerDef.moves.map(m => m.key).filter(Boolean),
    playerDef.jumpKey,
    playerDef.retreatKey,
].filter(Boolean);
const keyboard = new Keyboard(undefined, gameKeys);

/**
 * Builds a fresh game: clean State (stats and money seeded from the character
 * config), first route section, Rudy at the start line. This is both the boot
 * path and the restart from the game over screen — there are no saves.
 */
async function startFreshGame() {
    game.state.resetForNewGame(playerDef);
    await world.goToRouteIndex(0);

    const player = new Player({ x: 50, y: 598, def: playerDef });
    await player.load();

    const playState = new PlayState({
        ctx, world, player, keyboard, state: game.state,
        onGameEnd: result => game.changeState(new EndState({
            ctx, state: game.state, keyboard, result,
            streetName: world.streetName,
            drawScene: () => playState.draw(),
            onRestart: startFreshGame,
        })),
    });
    game.changeState(playState);
}

await startFreshGame();

// Start the main loop
game.start();
