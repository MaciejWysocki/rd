// src/render/hue.js
//
// hue.js — the hue shift of a drawn image.
//
// Two hostiles of the same type would look exactly the same (they share one
// sprite sheet), so the player could not tell them apart. Every extra
// hostile of a type therefore gets its own hue shift (the plan lives in
// world/entity-hues.js). This module does the shift itself.
//
// The shift is baked into the pixels: a sprite sheet and a HUD icon are
// turned into their shifted copy once, when they are loaded — drawing the
// copy then costs exactly as much as drawing the original.
//
// The pixels keep their alpha and their brightness: only the hue moves
// around the color wheel (RGB -> HSL -> RGB), so a green thug becomes a
// blue one, not a darker one.

/**
 * Normalizes an angle to [0, 360).
 * @param {number} degrees The angle in degrees.
 * @returns {number}
 */
function normalizeHue(degrees) {
    if (!Number.isFinite(degrees)) return 0;
    const value = degrees % 360;
    return value < 0 ? value + 360 : value;
}

/**
 * Returns a copy of the image with its hue shifted by the given angle.
 * The source itself is returned when there is nothing to shift.
 * @param {CanvasImageSource} source The image (an <img> or a canvas).
 * @param {number} degrees The hue shift in degrees.
 * @returns {CanvasImageSource} The shifted copy.
 */
export function rotateHue(source, degrees) {
    const shift = normalizeHue(degrees);
    if (shift === 0) return source;

    const width = source.naturalWidth ?? source.width;
    const height = source.naturalHeight ?? source.height;
    if (!width || !height) return source;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0);

    const image = ctx.getImageData(0, 0, width, height);
    const pixels = image.data;
    // A sprite sheet has few colors, so every color is rotated only once.
    const rotated = new Map();
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] === 0) continue; // the transparent pixels stay transparent
        const color = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
        let shifted = rotated.get(color);
        if (shifted === undefined) {
            shifted = rotateColor(color, shift);
            rotated.set(color, shifted);
        }
        pixels[i] = (shifted >> 16) & 0xff;
        pixels[i + 1] = (shifted >> 8) & 0xff;
        pixels[i + 2] = shifted & 0xff;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
}

/* ---------- The color math ---------- */

/**
 * Moves one color around the hue circle.
 * @param {number} color The color as 0xRRGGBB.
 * @param {number} degrees The hue shift in degrees.
 * @returns {number} The shifted color as 0xRRGGBB.
 */
function rotateColor(color, degrees) {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const lightness = (max + min) / 510;

    let hue = 0;
    let saturation = 0;
    if (delta !== 0) {
        saturation = lightness > 0.5
            ? delta / (510 - max - min)
            : delta / (max + min);
        if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        else if (max === g) hue = ((b - r) / delta + 2) / 6;
        else hue = ((r - g) / delta + 4) / 6;
    }

    return hslToRgb((hue * 360 + degrees) / 360, saturation, lightness);
}

/**
 * @param {number} h The hue in [0, 1).
 * @param {number} s The saturation in [0, 1].
 * @param {number} l The lightness in [0, 1].
 * @returns {number} The color as 0xRRGGBB.
 */
function hslToRgb(h, s, l) {
    if (s === 0) {
        const value = Math.round(l * 255);
        return (value << 16) | (value << 8) | value;
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return (channel(p, q, h + 1 / 3) << 16)
        | (channel(p, q, h) << 8)
        | channel(p, q, h - 1 / 3);
}

/** One channel of the HSL -> RGB conversion. */
function channel(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    let value;
    if (t < 1 / 6) value = p + (q - p) * 6 * t;
    else if (t < 1 / 2) value = q;
    else if (t < 2 / 3) value = p + (q - p) * (2 / 3 - t) * 6;
    else value = p;
    return Math.max(0, Math.min(255, Math.round(value * 255)));
}
