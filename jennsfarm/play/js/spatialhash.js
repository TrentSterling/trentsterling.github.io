// js/spatialhash.js — a tiny uniform-grid spatial hash for fast "what's near
// (x,z)?" queries. The animal food chain (skunk→crow, badger→skunk, …) used to
// scan every animal for every animal each frame (O(n²)); with the world now
// packed with critters that gets expensive. Bucketing by grid cell makes each
// query cost scale with LOCAL density instead of the total population, so we can
// keep adding animals without the framerate falling over (#40).
//
// Rebuilt cheaply each frame (positions change), so it's a transient index, not
// a persistent store. Pure data — no THREE/DOM — so it's unit-testable.

export function createSpatialHash(cellSize = 6) {
    const cells = new Map();
    // NUMERIC key (no per-insert/per-query string allocation → no GC churn, #35).
    // Packs two ±32k cell coords into one integer; masking handles negatives.
    const key = (cx, cz) => (cx & 0xffff) * 65536 + (cz & 0xffff);
    const cellOf = (v) => Math.floor(v / cellSize);

    return {
        clear() { cells.clear(); },

        insert(item, x, z) {
            const k = key(cellOf(x), cellOf(z));
            let bucket = cells.get(k);
            if (!bucket) { bucket = []; cells.set(k, bucket); }
            bucket.push({ item, x, z });
        },

        // Nearest inserted item to (x,z) within `radius` tiles that passes `pred`
        // (pred receives the original item). Returns the item, or null.
        nearest(x, z, radius, pred) {
            const cx = cellOf(x), cz = cellOf(z);
            const r = Math.ceil(radius / cellSize);
            let best = null, bd = radius * radius;
            for (let dz = -r; dz <= r; dz++) {
                for (let dx = -r; dx <= r; dx++) {
                    const bucket = cells.get(key(cx + dx, cz + dz));
                    if (!bucket) continue;
                    for (const e of bucket) {
                        if (pred && !pred(e.item)) continue;
                        const d = (e.x - x) ** 2 + (e.z - z) ** 2;
                        if (d < bd) { bd = d; best = e.item; }
                    }
                }
            }
            return best;
        },

        // All inserted items within `radius` tiles of (x,z) passing `pred`.
        within(x, z, radius, pred) {
            const cx = cellOf(x), cz = cellOf(z);
            const r = Math.ceil(radius / cellSize);
            const rr = radius * radius;
            const out = [];
            for (let dz = -r; dz <= r; dz++) {
                for (let dx = -r; dx <= r; dx++) {
                    const bucket = cells.get(key(cx + dx, cz + dz));
                    if (!bucket) continue;
                    for (const e of bucket) {
                        if (pred && !pred(e.item)) continue;
                        if ((e.x - x) ** 2 + (e.z - z) ** 2 <= rr) out.push(e.item);
                    }
                }
            }
            return out;
        },
    };
}
