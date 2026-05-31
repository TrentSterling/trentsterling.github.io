// js/netsync.js — multiplayer groundwork (#8), data layer only.
//
// The key insight for syncing this game: the world is procedurally generated from
// a shared seed, so peers must NOT ship the terrain to each other (it'd be huge and
// it's identical on both ends). They sync only:
//   1. the sparse set of PLAYER-CAUSED tile changes ("deltas"), keyed by "x,z", and
//   2. a tiny player-transform packet for low-rate position/heading sync.
// Buildings/animals/etc. sync separately via their registry serialize surface.
//
// This module is pure data + (de)serialization — no THREE, no DOM, no transport.
// The eventual PeerJS layer just moves these JSON-safe payloads around. Keeping it
// pure makes the sync model unit-testable now, long before any networking exists.

export function tileKey(x, z) { return `${x},${z}`; }

// Pack only the fields needed to replicate a player-changed tile. Short keys keep
// packets small (lots of tiles in the grid). Defaults are omitted, not stored.
export function packTile(tile) {
    const t = { ty: tile.type };
    if (tile.crop) { t.c = tile.crop; t.s = tile.cropStage | 0; }
    if (tile.watered) t.w = 1;
    return t;
}

// A growing set of tile deltas to broadcast. record() on every player edit;
// encode() to a JSON-safe object to send; apply() a received object to the world.
export function createDeltaSet() {
    const deltas = new Map(); // "x,z" -> packed tile
    return {
        record(x, z, tile) { deltas.set(tileKey(x, z), packTile(tile)); },
        has(x, z) { return deltas.has(tileKey(x, z)); },
        get size() { return deltas.size; },
        encode() { const o = {}; for (const [k, v] of deltas) o[k] = v; return o; },
        apply(obj, setTile) {
            for (const k in obj) {
                const i = k.indexOf(',');
                const x = +k.slice(0, i), z = +k.slice(i + 1);
                setTile(x, z, obj[k]);
            }
        },
        clear() { deltas.clear(); },
    };
}

// Compact player-transform packet. Coords rounded to 0.01 tile to keep it tiny;
// identity (id/name) is carried alongside, not re-sent every frame in practice.
export function packPlayer(p) {
    const r2 = (n) => Math.round((n || 0) * 100) / 100;
    return { x: r2(p.x), z: r2(p.z), r: r2(p.r), n: p.name || '' };
}
