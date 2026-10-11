// src/audio/audio.js
//
// audio.js
//
// Convention-based sound playback. Sounds are picked by file name, never
// referenced from code beyond these names, and every file is OPTIONAL:
// if an mp3 matching the convention does not exist, playback is skipped
// silently. All files live in assets/sounds/ and are mp3.
//
// Conventions:
//   player-attack-miss / player-attack-hit          Rudy's attack, whether it landed
//   <enemyName>-attack-miss / <enemyName>-attack-hit  e.g. lysyblokers-attack-miss
//   <street>_<section>-ambient                      looping section ambience,
//                                                     e.g. ulica-01_01-ambient
//   boss-intro                                      played on the boss fight intro/start

const SOUND_DIR = 'assets/sounds/';

function play(name, { loop = false } = {}) {
    const audio = new Audio(`${SOUND_DIR}${name}.mp3`);
    audio.loop = loop;
    audio.play().catch(() => {}); // optional by convention: a missing file means silence
    return audio;
}

/** Plays `<who>-attack-<outcome>`, where who is "player" or an enemy name. */
export function playAttackSound(who, outcome) {
    play(`${who}-attack-${outcome}`);
}

/** Plays `<who>-jump` (e.g. player-jump) when a character jumps. */
export function playJumpSound(who) {
    play(`${who}-jump`);
}

let ambient = null;

/**
 * Starts the looping `<street>_<section>-ambient` track for a section,
 * replacing any track already playing. Missing file = silence.
 */
export function startAmbient(street, section) {
    stopAmbient();
    ambient = play(`${street}_${section}-ambient`, { loop: true });
}

export function stopAmbient() {
    if (!ambient) return;
    ambient.pause();
    ambient = null;
}

/** Plays `boss-intro` when a boss fight starts (called by the boss intro sequence). */
export function playBossIntro() {
    play('boss-intro');
}
