// src/render/image-cache.js
//
// image-cache.js — the shared cache of the loaded images.
//
// The HUD icons and the section overlays are loaded once and kept: they are
// drawn every frame, so the image must not be fetched again. The cache is
// keyed by the path; an image that is still loading is handed out anyway —
// the caller checks whether it is ready to draw (see isReady).

const images = new Map();

/**
 * The image of a path — loaded once, then reused.
 * @param {string} path The path of the image, e.g. "assets/hud/hp.png".
 * @returns {HTMLImageElement} The image (it may still be loading).
 */
export function getImage(path) {
    let image = images.get(path);
    if (!image) {
        image = new Image();
        image.src = path;
        images.set(path, image);
    }
    return image;
}

/**
 * True when the image is loaded and can be drawn.
 * @param {HTMLImageElement} image The image.
 * @returns {boolean}
 */
export function isReady(image) {
    return Boolean(image?.complete) && image.naturalWidth > 0;
}
