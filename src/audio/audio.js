// src/audio/audio.js
//
// audio.js
//
// Convention-based sound playback. Sounds are picked by file name, never
// referenced from code beyond these names, and every file is OPTIONAL:
// if an mp3 matching the convention does not exist, playback is skipped
// silently. All files live in assets/sounds/ and are mp3.
//
// The *names* of the tracks are built by domain/content/asset-conventions.js —
// this module only plays them. The conventions are:
//
//   player-attack-miss / player-attack-hit          Rudy's attack, whether it landed
//   <enemyName>-attack-miss / <enemyName>-attack-hit  e.g. lysy-blokers-attack-miss
//   <bossName>-attack                              attack release, independent of impact
//   <street>-<section>-ambient                     looping section ambience,
//                                                     e.g. 01-narutowicza-1-ambient
//   ambience                                        default street ambience (looping
//                                                     street noise for regular play),
//                                                     played when a section has no
//                                                     ambient of its own
//   <street>-boss-music                            the fight music of a street,
//                                                     e.g. 01-narutowicza-boss-music
//   <street>-boss-intro                            the boss's introduction sentence,
//                                                     played once on top of the boss
//                                                     music when the fight starts
//   <street>-<interaction>-<trigger>               the sound of an interaction,
//                                                     e.g. 01-narutowicza-sklep-0
//   <street>-congratulations                        the victory jingle, played once
//                                                     behind the win screen,
//                                                     e.g. 01-narutowicza-congratulations
//   game-over                                       death music on defeat, played
//                                                     once behind the end screen

import {
    attackTrack, jumpTrack, soundPath, DEFAULT_AMBIENCE_TRACK,
} from '../domain/content/asset-conventions.js';

function play(name, { loop = false } = {}) {
    const audio = new Audio(soundPath(name));
    audio.loop = loop;
    audio.play().catch(() => {}); // optional by convention: a missing file means silence
    return audio;
}

/**
 * Plays a sound by its track name (without the .mp3), e.g. "01-narutowicza-sklep-0".
 * Every file is optional: a missing one means silence.
 */
export function playSound(name) {
    return play(name);
}

/** Plays `<who>-attack` on release, or `<who>-attack-<outcome>` for a hit/miss. */
export function playAttackSound(who, outcome = null) {
    play(attackTrack(who, outcome));
}

/** Plays `<who>-jump` (e.g. player-jump) when a character jumps. */
export function playJumpSound(who) {
    play(jumpTrack(who));
}

let ambient = null;
let bossMusic = null;
let bossIntro = null;
let gameOverMusic = null;
let congratsMusic = null;

/**
 * Starts the looping ambience for regular play, replacing any track already
 * playing. The section's own `<street>-<section>-ambient` wins when it exists;
 * otherwise the default street ambience (`ambience.mp3`) plays instead.
 * @param {string} track The track name of the section.
 */
export function startAmbient(track) {
    stopBossMusic();
    stopBossIntro();
    stopAmbient();
    ambient = playAmbientWithFallback(track);
    armStartupRetry();
}

// Browsers refuse audible playback before the first user gesture, so the
// street would stay silent after boot. One-shot: on the first key press or
// click the ambient is started if the browser still refuses to play it.
let startupRetryArmed = false;
function armStartupRetry() {
    if (startupRetryArmed) return;
    startupRetryArmed = true;
    const retry = () => {
        window.removeEventListener('keydown', retry);
        window.removeEventListener('pointerdown', retry);
        startupRetryArmed = false;
        // No paused check: a rejected play() leaves unreliable state behind.
        // play() on a track that is already going is a harmless no-op.
        if (ambient) {
            ambient.muted = false;
            ambient.play().catch(() => {});
        }
    };
    window.addEventListener('keydown', retry);
    window.addEventListener('pointerdown', retry);
}

/**
 * Plays a looping track, falling back to the default street ambience when its
 * file is missing. The fallback only starts while this track is still the
 * active ambient layer (it may have been replaced before the error arrives).
 */
function playAmbientWithFallback(name) {
    const audio = new Audio(soundPath(name));
    audio.loop = true;
    audio.addEventListener('error', () => {
        if (ambient === audio) {
            ambient = new Audio(soundPath(DEFAULT_AMBIENCE_TRACK));
            ambient.loop = true;
            playAudibly(ambient);
        }
    }, { once: true });
    playAudibly(audio);
    return audio;
}

/**
 * Starts a track so it is audible from the very first frame (owner 2026-10-15:
 * the ambience must not wait for the player's first move). Browsers refuse
 * audible playback before the first user gesture — a rejected start falls back
 * to muted playback (always allowed) and unmutes it the moment it is running.
 */
function playAudibly(audio) {
    return audio.play().catch(() => {
        audio.muted = true;
        return audio.play()
            .then(() => { audio.muted = false; })
            .catch(() => {}); // optional by convention: a missing file means silence
    });
}

export function stopAmbient() {
    if (!ambient) return;
    ambient.pause();
    ambient = null;
}

/**
 * Plays `<street>-boss-intro` — the boss's introduction sentence — once, on top
 * of the boss music when the fight starts. The handle is kept so a long
 * sentence is never dropped mid-play.
 */
export function playBossIntro(track) {
    stopBossIntro();
    bossIntro = play(track);
}

export function stopBossIntro() {
    if (!bossIntro) return;
    bossIntro.pause();
    bossIntro = null;
}

/**
 * Starts the looping `<street>-boss-music` track for a boss fight. It replaces
 * the ambient layer (highest active layer wins — audio layering comes in
 * P4.3); the introduction sentence rides on top of it.
 * Missing file = silence.
 */
export function startBossMusic(track) {
    stopAmbient();
    stopBossMusic();
    bossMusic = play(track, { loop: true });
}

export function stopBossMusic() {
    if (!bossMusic) return;
    bossMusic.pause();
    bossMusic = null;
}

/**
 * Death music (`game-over`) behind the end screen, played ONCE on defeat —
 * no loop: the panel stays silent after it ends (owner 2026-10-14).
 */
export function playGameOverMusic(track) {
    stopAllAudio();
    gameOverMusic = play(track);
}

export function stopGameOverMusic() {
    if (!gameOverMusic) return;
    gameOverMusic.pause();
    gameOverMusic = null;
}

/**
 * The victory jingle (`<street>-congratulations`, e.g. 01-narutowicza-congratulations)
 * behind the win screen, played ONCE — no loop (owner 2026-10-15).
 */
export function playCongratulations(track) {
    stopAllAudio();
    congratsMusic = play(track);
}

export function stopCongratulations() {
    if (!congratsMusic) return;
    congratsMusic.pause();
    congratsMusic = null;
}

/** The game is over: every layer — ambient, boss music, intro sentence, end-screen music — goes quiet. */
export function stopAllAudio() {
    stopAmbient();
    stopBossMusic();
    stopBossIntro();
    stopGameOverMusic();
    stopCongratulations();
}
