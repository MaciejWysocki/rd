// src/render/overlays.js
//
// overlays.js — the background overlays of a section.
//
// An overlay is a static picture placed on the background: the shop sign, the
// waiting pose of the boss, the street light. The "back" ones belong to the
// scenery and are drawn with the background; the "front" ones stand in the
// foreground and are drawn over the characters (a street light covering
// whoever is behind it).
//
// The overlays are drawn from the section model; the condition of each one
// ("when") decides whether it is there at all.

import { getImage, isReady } from './image-cache.js';
import { overlayPath } from '../domain/content/asset-conventions.js';

/**
 * Draws the overlays of a section in one layer.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} options
 * @param {object} options.section The section being drawn.
 * @param {string} options.streetId The id of the current street.
 * @param {'back'|'front'} options.layer The layer to draw.
 * @param {Function} options.isVisible Tells whether an overlay is visible
 *        (its "when" condition holds).
 */
export function drawOverlays(ctx, { section, streetId, layer, isVisible }) {
    const overlays = section?.model.overlays ?? [];
    overlays.forEach((overlay, index) => {
        if ((overlay.position ?? 'back') !== layer) return;
        if (!isVisible(overlay)) return;
        const path = overlayPath(streetId, section.number, index + 1);
        const image = getImage(path);
        if (!isReady(image)) return;
        ctx.drawImage(image, overlay.x, overlay.y);
    });
}
