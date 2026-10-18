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
//   <bossName>-attack                              attack release, independent of impact
//   <street>_<section>-ambient                      looping section ambience,
//                                                     e.g. ulica-01_01-ambient
//   ambience                                        default street ambience (looping
//                                                     street noise for regular play),
//                                                     played when a section has no
//                                                     ambient of its own
//   boss-intro                                      the boss's introduction sentence,
//                                                     played once on top of the boss
//                                                     music when the fight starts
//   <street>-congratulations                        the victory jingle, played once
//                                                     behind the win screen,
//                                                     e.g. ulica-01-congratulations
//   game-over                                       death music on defeat, played
//                                                     once behind the end screen

const SOUND_DIR = 'assets/sounds/';

function play(name, { loop = false } = {}) {
    const audio = new Audio(`${SOUND_DIR}${name}.mp3`);
    audio.loop = loop;
    audio.play().catch(() => {}); // optional by convention: a missing file means silence
    return audio;
}

/** Plays `<who>-attack` on release, or `<who>-attack-<outcome>` for a hit/miss. */
export function playAttackSound(who, outcome = null) {
    play(outcome ? `${who}-attack-${outcome}` : `${who}-attack`);
}

/** Plays `<who>-jump` (e.g. player-jump) when a character jumps. */
export function playJumpSound(who) {
    play(`${who}-jump`);
}

let ambient = null;
let bossMusic = null;
let bossIntro = null;
let gameOverMusic = null;
let congratsMusic = null;

/**
 * Starts the looping ambience for regular play, replacing any track already
 * playing. The section's own `<street>_<section>-ambient` wins when it exists;
 * otherwise the default street ambience (`ambience.mp3`) plays instead.
 */
export function startAmbient(street, section) {
    stopBossMusic();
    stopBossIntro();
    stopAmbient();
    ambient = playAmbientWithFallback(`${street}_${section}-ambient`);
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
    const audio = new Audio(`${SOUND_DIR}${name}.mp3`);
    audio.loop = true;
    audio.addEventListener('error', () => {
        if (ambient === audio) {
            ambient = new Audio(`${SOUND_DIR}ambience.mp3`);
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
 * Plays `boss-intro` — the boss's introduction sentence — once, on top of the
 * boss music when the fight starts. The handle is kept so a long sentence is
 * never dropped mid-play.
 */
export function playBossIntro() {
    stopBossIntro();
    bossIntro = play('boss-intro');
}

export function stopBossIntro() {
    if (!bossIntro) return;
    bossIntro.pause();
    bossIntro = null;
}

/**
 * Starts the looping `boss-music` track for a boss fight. It replaces the
 * ambient layer (highest active layer wins — audio layering comes in P4.3);
 * the introduction sentence rides on top of it.
 * Missing file = silence.
 */
export function startBossMusic() {
    stopAmbient();
    stopBossMusic();
    bossMusic = play('boss-music', { loop: true });
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
export function playGameOverMusic() {
    stopAllAudio();
    gameOverMusic = play('game-over');
}

export function stopGameOverMusic() {
    if (!gameOverMusic) return;
    gameOverMusic.pause();
    gameOverMusic = null;
}

/**
 * The victory jingle (`<street>-congratulations`, e.g. ulica-01-congratulations)
 * behind the win screen, played ONCE — no loop (owner 2026-10-15).
 */
export function playCongratulations(street) {
    stopAllAudio();
    congratsMusic = play(`${street}-congratulations`);
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
