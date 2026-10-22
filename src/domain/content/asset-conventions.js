// src/domain/content/asset-conventions.js
//
// The one and only place where an asset path or a sound track name is built.
// Every image and every sound of the game is named by a convention (see the
// comment blocks below); no other module may assemble a path by hand.
//
// The functions return plain strings: the domain layer stays free of the DOM
// and the audio adapter turns a track name into a path with soundPath().

export const FRAME_SIZE = 150; // sprite-sheet frames are 150x150 px
export const WALK_FRAMES = 8;   // row 0 of a sheet: the walk cycle
export const ATTACK_FRAMES = 4; // one attack = 4 frames of its row

export const ASSET_DIRS = {
    backgrounds: 'assets/bg/',
    sprites: 'assets/sprites/',
    sounds: 'assets/sounds/',
    hud: 'assets/hud/',
};

/* ---------- Image paths ---------- */

/**
 * The background of a section: assets/bg/<street>-<n>.png
 * @param {string} streetId Street id, e.g. "01-narutowicza".
 * @param {number} sectionNumber 1-based section number.
 * @returns {string}
 */
export function backgroundPath(streetId, sectionNumber) {
    return `${ASSET_DIRS.backgrounds}${streetId}-${sectionNumber}.png`;
}

/**
 * A background overlay of a section: assets/bg/<street>-<n>-<i>.png
 * @param {string} streetId Street id, e.g. "01-narutowicza".
 * @param {number} sectionNumber 1-based section number.
 * @param {number} index 1-based index of the overlay in the section.
 * @returns {string}
 */
export function overlayPath(streetId, sectionNumber, index) {
    return `${ASSET_DIRS.backgrounds}${streetId}-${sectionNumber}-${index}.png`;
}

/**
 * A sprite-sheet of a character: assets/sprites/<name>.png
 * @param {string} spriteName Sprite base name, e.g. "rudy_dres".
 * @returns {string}
 */
export function spritePath(spriteName) {
    return `${ASSET_DIRS.sprites}${spriteName}.png`;
}

/**
 * A sound file: assets/sounds/<track>.mp3
 * @param {string} trackName Track name, e.g. "player-attack-hit".
 * @returns {string}
 */
export function soundPath(trackName) {
    return `${ASSET_DIRS.sounds}${trackName}.mp3`;
}

/**
 * A HUD icon: assets/hud/<name>.png (the HP heart, the coin, an item icon).
 * @param {string} iconName Icon base name, e.g. "hp" or "beer".
 * @returns {string}
 */
export function hudIconPath(iconName) {
    return `${ASSET_DIRS.hud}${iconName}.png`;
}

/* ---------- Sound track names ---------- */

/**
 * The ambience of a section: <street>-<n>-ambient
 * @param {string} streetId Street id, e.g. "01-narutowicza".
 * @param {number} sectionNumber 1-based section number.
 * @returns {string}
 */
export function ambientTrack(streetId, sectionNumber) {
    return `${streetId}-${sectionNumber}-ambient`;
}

/**
 * The fight music of a street: <street>-boss-music
 * @param {string} streetId Street id, e.g. "01-narutowicza".
 * @returns {string}
 */
export function bossMusicTrack(streetId) {
    return `${streetId}-boss-music`;
}

/**
 * The boss's introduction sentence: <street>-boss-intro
 * @param {string} streetId Street id, e.g. "01-narutowicza".
 * @returns {string}
 */
export function bossIntroTrack(streetId) {
    return `${streetId}-boss-intro`;
}

/**
 * The sound of an interaction: <street>-<interaction>-<index>
 * @param {string} streetId Street id, e.g. "01-narutowicza".
 * @param {string} interactionId Interaction id, e.g. "sklep".
 * @param {number} triggerIndex 0-based index of the trigger in the interaction.
 * @returns {string}
 */
export function interactionTrack(streetId, interactionId, triggerIndex) {
    return `${streetId}-${interactionId}-${triggerIndex}`;
}

/**
 * The victory jingle of a street: <street>-congratulations
 * @param {string} streetId Street id, e.g. "01-narutowicza".
 * @returns {string}
 */
export function congratulationsTrack(streetId) {
    return `${streetId}-congratulations`;
}

/**
 * The attack sound of a character: <who>-attack, <who>-attack-hit or <who>-attack-miss.
 * @param {string} who Character name, e.g. "player".
 * @param {'hit'|'miss'|null} [outcome] The result of the blow; null = the release only.
 * @returns {string}
 */
export function attackTrack(who, outcome = null) {
    return outcome ? `${who}-attack-${outcome}` : `${who}-attack`;
}

/**
 * The jump sound of a character: <who>-jump
 * @param {string} who Character name, e.g. "player".
 * @returns {string}
 */
export function jumpTrack(who) {
    return `${who}-jump`;
}

export const DEFAULT_AMBIENCE_TRACK = 'ambience';
export const GAME_OVER_TRACK = 'game-over';
export const ENDFRAME_IMAGE = 'assets/hud/endgame-frame.png';
