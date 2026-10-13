// src/render/hud.js
//
// HUD overlay. Top-left corner: HP as hearts — one `assets/hud/hp.png` per
// 1 HP — with money below as coins, one `assets/hud/money.png` per coin (a
// coin is 5 PLN). Carried items follow below the coins: each item type gets
// its own row of `assets/hud/<itemId>.png` icons, one per unit (e.g. a bought
// beer = one `beer.png`). Top-right corner: the HP of the enemy that is
// currently in fight mode, as hearts. All counters live in the global State /
// the actors; nothing is stored here. A row with zero items draws nothing and
// collapses entirely (e.g. no coins left = the money row is gone and the rows
// below move up).
//
// Icons are drawn at their natural size and spaced by GAP; layout is
// computed from the images, so it does not depend on asset dimensions.

const HUD_DIR = 'assets/hud/';
const X = 16;
const Y = 16;
const GAP = 8;

const images = new Map();

function getImage(name) {
    let img = images.get(name);
    if (!img) {
        img = new Image();
        img.src = `${HUD_DIR}${name}.png`;
        images.set(name, img);
    }
    return img;
}

/**
 * Draws up to `count` copies of the icon in a row starting at (X, y).
 * @param {'left'|'right'} [align] `right` draws the row anchored to the canvas
 *        right edge (the enemy HP corner).
 * @returns {number} Y of the next row (the row collapses when nothing is drawn).
 */
function drawRow(ctx, name, count, y, align = 'left') {
    const img = getImage(name);
    if (count <= 0 || !img.complete || img.naturalWidth === 0) return y;
    const step = img.naturalWidth + GAP;
    for (let i = 0; i < count; i++) {
        const x = align === 'right'
            ? ctx.canvas.width - X - img.naturalWidth - i * step
            : X + i * step;
        ctx.drawImage(img, x, y);
    }
    return y + img.naturalHeight + GAP;
}

/**
 * Draws the HUD: one heart per HP, one coin per money unit below them, then
 * one row per carried item type (sorted by item id). While an enemy is in
 * fight mode its HP shows as hearts in the top-right corner.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{hp:number, money:number, items?:object, enemyHp?:{hp:number}|null}} counters
 *        Values from the global State; `items` is the inventory ({ itemId: { item, qty } }),
 *        `enemyHp` the HP of the enemy currently fighting (null = corner empty).
 */
export function drawHud(ctx, { hp, money, items = {}, enemyHp = null }) {
    if (enemyHp && enemyHp.hp > 0) {
        drawRow(ctx, 'hp', enemyHp.hp, Y, 'right');
    }
    let y = Y;
    y = drawRow(ctx, 'hp', hp, y);
    y = drawRow(ctx, 'money', money, y);
    for (const id of Object.keys(items).sort()) {
        y = drawRow(ctx, id, items[id]?.qty ?? 0, y);
    }
}
