// src/render/sprite-sheet.js

/**
 * sprite-sheet.js
 *
 * Loads a sprite-sheet with fixed square frames arranged in rows.
 * Each row is one animation; rowFrames[row] is the number of frames in that row.
 */

export default class SpriteSheet {
    /**
     * @param {string} src        Path to the PNG, e.g. "assets/sprites/rudy_dres.png".
     * @param {number} frameSize  Width and height of one frame in px.
     * @param {number[]} rowFrames Frame count per row, e.g. [8, 4].
     */
    constructor(src, frameSize, rowFrames) {
        this.src = src;
        this.frameSize = frameSize;
        this.rowFrames = rowFrames;
        this.image = null;
    }

    load() {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const needWidth = Math.max(...this.rowFrames) * this.frameSize;
                const needHeight = this.rowFrames.length * this.frameSize;
                if (img.width < needWidth || img.height < needHeight) {
                    reject(new Error(
                        `Sprite-sheet ${this.src} ma ${img.width}x${img.height}px, wymagane co najmniej ${needWidth}x${needHeight}px`
                    ));
                    return;
                }
                this.image = img;
                resolve(this);
            };
            img.onerror = () => reject(new Error(`Nie można wczytać sprite-sheetu: ${this.src}`));
            img.src = this.src;
        });
    }

    framesIn(row) {
        return this.rowFrames[row];
    }

    /**
     * Draws one frame with its top-left corner at (x, y).
     * @param {number} facing 1 = normal, -1 = mirrored horizontally.
     */
    drawFrame(ctx, row, frame, x, y, facing = 1) {
        const size = this.frameSize;
        const sx = frame * size;
        const sy = row * size;

        ctx.save();
        if (facing < 0) {
            ctx.translate(x + size, y);
            ctx.scale(-1, 1);
            ctx.drawImage(this.image, sx, sy, size, size, 0, 0, size, size);
        } else {
            ctx.drawImage(this.image, sx, sy, size, size, x, y, size, size);
        }
        ctx.restore();
    }
}
