// src/main.js
//
// main.js — the composition root of the game.
//
// It wires the content repository (the JSON configs), the session (the state
// that survives a screen change), the world (the streets and the sections)
// and the screens together, and starts the loop. Nothing else knows how the
// game is assembled.

import Game from './app/game.js';
import World from './world/world.js';
import ContentRepository from './domain/content/content-repository.js';
import Session from './domain/quest/session.js';
import Player from './domain/actors/player.js';
import Keyboard from './input/keyboard.js';
import PlayScreen from './app/play-screen.js';
import EndScreen from './app/end-screen.js';
import SpriteSheet from './render/sprite-sheet.js';
import { playJumpSound } from './audio/audio.js';
import { FRAME_SIZE, spritePath } from './domain/content/asset-conventions.js';
import { START_X, GROUND_Y } from './world/layout.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

await document.fonts.load('16px "Press Start 2P"');
ctx.font = '16px "Press Start 2P"';

const content = new ContentRepository();
const session = new Session();
const world = new World(session, content);
world.setStreets(await content.listStreets());

const playerCharacter = await content.getCharacter('player');
if (!playerCharacter) throw new Error('Brak postaci gracza: data/characters/player.json');

// The keys the game swallows: the moves of the player and the jump.
const gameKeys = [
    ...playerCharacter.moves.map(move => move.key),
    playerCharacter.jump?.key,
].filter(Boolean);
const keyboard = new Keyboard(undefined, gameKeys);

const game = new Game();

// The parts of the composition root, exposed so the game can be inspected
// from the outside (the tests drive the real objects).
export { game, session, world };

/**
 * Builds a fresh game: a clean session (stats and money seeded from the
 * character config), the first street of the game, Rudy at the start line.
 * This is both the boot path and the restart from the end screen — there
 * are no saves.
 */
async function startFreshGame() {
    // The section the player died in hands the state of its hostiles (where
    // they stand, where they fell) over to the session — the reset below
    // wipes it, so a new game starts with the hostiles at their posts.
    await world.leaveCurrent();
    session.resetForNewGame(playerCharacter);

    const sheet = new SpriteSheet(
        spritePath(playerCharacter.sprite),
        FRAME_SIZE,
        playerCharacter.framesPerRow,
    );
    const player = new Player({ x: START_X, y: GROUND_Y + 5, character: playerCharacter, sheet });
    // The domain stays free of the audio adapter: the jump sound is hooked in here.
    player.onJump = () => playJumpSound(playerCharacter.name);
    await player.load();
    // The world builds the trigger context — it needs to know the player.
    world.setPlayer(player);

    await world.gotoStreet(0);

    const playScreen = new PlayScreen({
        ctx, world, player, keyboard, session,
        missionLogs: document.getElementById('missionLogs'),
        onGameEnd: result => game.changeState(new EndScreen({
            ctx, session, keyboard, result,
            streetId: world.streetId,
            playerName: playerCharacter.name,
            drawScene: () => playScreen.draw(),
            onRestart: startFreshGame,
        })),
    });
    game.changeState(playScreen);
}

await startFreshGame();

// Start the main loop
game.start();
