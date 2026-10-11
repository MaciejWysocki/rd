import Game from './game/game.js';
import WorldManager from './world/world-manager.js';
import Player from './actors/player.js';
import Keyboard from './input/keyboard.js';
import PlayState from './game/play-state.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const game = new Game();

const world = new WorldManager(game.state);
await world.loadStreet('src/data/streets/ulica-01.json');
await world.goToRouteIndex(0);

const player = new Player({ x: 50, y: 598 });
await player.load();

const keyboard = new Keyboard();

game.changeState(new PlayState({ ctx, world, player, keyboard }));

// Start the main loop
game.start();
