import Game from './game/game.js';
import WorldManager from './world/world-manager.js';
import Player from './actors/player.js';
import { loadCharacterDef } from './actors/character-defs.js';
import Keyboard from './input/keyboard.js';
import PlayState from './game/play-state.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const game = new Game();

const world = new WorldManager(game.state);
await world.loadStreet('data/streets/ulica-01.json');
await world.goToRouteIndex(0);

const playerDef = await loadCharacterDef('player');
const player = new Player({ x: 50, y: 598, def: playerDef });
await player.load();
game.state.stats[player.name] = { hp: playerDef.hp, maxHp: playerDef.hp };

const gameKeys = [
    ...playerDef.moves.map(m => m.key).filter(Boolean),
    playerDef.jumpKey,
].filter(Boolean);
const keyboard = new Keyboard(undefined, gameKeys);

game.changeState(new PlayState({ ctx, world, player, keyboard }));

// Start the main loop
game.start();
