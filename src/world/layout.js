// src/world/layout.js
//
// layout.js — the geometry of the game world.
//
// The canvas is fixed (index.html): 1600x800 world pixels. The characters
// stand on one line (GROUND_Y) and the sections are entered from the left or
// the right edge of the street. These numbers are shared by the world (the
// walls of the street ends), by the play screen (where Rudy appears) and by
// the boot (where he starts), so they live in one place.

/** The width of the canvas in world pixels. */
export const CANVAS_W = 1600;

/** The height of the canvas in world pixels. */
export const CANVAS_H = 800;

/** The line the characters stand on (the top edge of their frames). */
export const GROUND_Y = 598;

/** The width of the wall that closes the ends of the street. */
export const WALL_W = 40;

/** Where Rudy starts the game — the left edge of the first section. */
export const START_X = 50;

/** Where Rudy appears when he walks into a section from the left. */
export const ENTRY_X_FROM_LEFT = START_X;

/**
 * Where Rudy appears when he walks into a section from the right: his frame
 * flush with the right edge of the canvas (1600 - 150).
 */
export const ENTRY_X_FROM_RIGHT = CANVAS_W - 150;
