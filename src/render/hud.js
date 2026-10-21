// src/render/hud.js
//
// HUD overlay. Top-left corner: HP as hearts — one `assets/hud/hp.png` per
// 1 HP — with money below as coins, one `assets/hud/money.png` per coin (a
// coin is 5 PLN). Carried items follow below the coins: each item type gets
// its own row of `assets/hud/<itemId>.png` icons, one per unit (e.g. a bought
// beer = one `beer.png`). Top-right: the HP of the hostiles in fight mode —
// one row of hearts each, stacked one below the other. The hearts of a
// hostile carry its hue shift, so the row belongs to the hostile of that
// color (the same shift the sprite sheet got).
//
// The **mission logs are not on the canvas** (owner 2026-10-21): they sit
// ABOVE the game area, in the `#missionLogs` element of the page (see
// index.html) — the objective that is still open, right-aligned to the
// canvas' right edge. drawMissionLogs() writes them; the text is only
// touched when it changes.
//
// All counters live in the global State /
// the actors; nothing is stored here. A row with zero items draws nothing and
// collapses entirely (e.g. no coins left = the money row is gone and the rows
// below move up).
//
// Icons are drawn at their natural size and spaced by GAP; layout is
// computed from the images, so it does not depend on asset dimensions.

import { hudIconPath } from '../domain/content/asset-conventions.js';
import { rotateHue } from './hue.js';

const X = 16;
const Y = 16;
const GAP = 8;

const icons = new Map();

/** The icon of a HUD item: the image and its hue-shifted copies. */
function getIcon(name) {
    let entry = icons.get(name);
    if (!entry) {
        const img = new Image();
        img.src = hudIconPath(name);
        entry = { img, tinted: new Map() };
        icons.set(name, entry);
    }
    return entry;
}

/**
 * The icon in the given hue: the original image or its hue-shifted copy.
 * The copy is made once and kept — the hearts are drawn every frame.
 */
function getIconSource(entry, hue) {
    if (!hue) return entry.img;
    let shifted = entry.tinted.get(hue);
    if (!shifted) {
        shifted = rotateHue(entry.img, hue);
        entry.tinted.set(hue, shifted);
    }
    return shifted;
}

/**
 * Draws up to `count` copies of the icon in a row starting at (X, y).
 * @param {'left'|'right'} [align] `right` draws the row anchored to the canvas
 *        right edge (the enemy HP corner).
 * @param {number} [hue] The hue shift of the row in degrees (0 = the original colors).
 * @returns {number} Y of the next row (the row collapses when nothing is drawn).
 */
function drawRow(ctx, name, count, y, align = 'left', hue = 0) {
    if (count <= 0) return y;
    const entry = getIcon(name);
    if (!entry.img.complete || entry.img.naturalWidth === 0) return y;
    const img = getIconSource(entry, hue);
    const width = img.naturalWidth ?? img.width;
    const height = img.naturalHeight ?? img.height;
    if (!width || !height) return y;
    const step = width + GAP;
    for (let i = 0; i < count; i++) {
        const x = align === 'right'
            ? ctx.canvas.width - X - width - i * step
            : X + i * step;
        ctx.drawImage(img, x, y);
    }
    return y + height + GAP;
}

/**
 * Draws the HUD: one heart per HP, one coin per money unit below them, then
 * one row per carried item type (sorted by item id). The hostiles in fight
 * mode show their HP in the top-right corner — one row each, stacked one
 * under the other.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{hp:number, money:number, items?:object, enemies?:Array<{hp:number,maxHp:number,hue?:number}>}} counters
 *        Values from the global State; `items` is the inventory ({ itemId: { item, qty } }),
 *        `enemies` the hostiles currently in fight mode (empty = no hearts), each with
 *        the hue shift of its sprite — the hearts of a row are shifted with it.
 */
export function drawHud(ctx, { hp, money, items = {}, enemies = [] }) {
    // One row of hearts per hostile in fight mode, one below the other, in
    // the top-right corner. The row carries the hue of its hostile, so the
    // row belongs to the hostile of that color on the street.
    let enemyY = Y;
    for (const enemy of enemies) {
        if (!enemy || enemy.hp <= 0) continue;
        enemyY = drawRow(ctx, 'hp', enemy.hp, enemyY, 'right', enemy.hue ?? 0);
    }

    let y = Y;
    y = drawRow(ctx, 'hp', hp, y);
    y = drawRow(ctx, 'money', money, y);
    for (const id of Object.keys(items).sort()) {
        y = drawRow(ctx, id, items[id]?.qty ?? 0, y);
    }
}

// The last text written to a log element (the HUD runs every frame).
const writtenLogs = new WeakMap();

/**
 * Writes the mission logs above the game area (the `#missionLogs` element of
 * the page): the objective that is still open. The text is only written when
 * it changes — the HUD runs every frame.
 * @param {HTMLElement|null} element The log element (null = the page has none).
 * @param {string[]} rows The log lines.
 */
export function drawMissionLogs(element, rows) {
    if (!element) return;
    const text = (rows ?? []).join('\n');
    if (writtenLogs.get(element) === text) return;
    writtenLogs.set(element, text);
    element.textContent = text;
}
