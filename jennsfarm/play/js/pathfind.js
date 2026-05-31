// js/pathfind.js — 8-connected (weighted) A* over the open tile grid so Jenn
// routes AROUND buildings, water, the cottage and blocking trees instead of
// sliding into a corner and getting stuck (the "she gets stuck near the Market"
// bug). Walkable = not solid and not a blocking tree. Diagonals can't cut between
// two solid corners. Bounded by a node budget so it stays cheap in the now-
// infinite world; if the goal can't be fully reached it returns the path to the
// closest tile reached (always makes progress toward where you clicked).

import { isSolidTile } from './world.js';
import { isBlockingTreeAt } from './trees.js';

const MAX_NODES = 8000;     // expansion budget (bounds cost in the open world)
const H_WEIGHT = 1.3;       // weighted A*: greedier toward the goal = far fewer nodes
const SQRT2 = 1.41421356;

const DIRS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function defaultWalkable(x, z) { return !isSolidTile(x, z) && !isBlockingTreeAt(x, z); }

// Octile distance — admissible heuristic for 8-connected movement.
function heur(x, z, gx, gz) {
    const dx = Math.abs(x - gx), dz = Math.abs(z - gz);
    return (dx + dz) + (SQRT2 - 2) * Math.min(dx, dz);
}

// Tiny binary min-heap keyed by node.f
class MinHeap {
    constructor() { this.a = []; }
    size() { return this.a.length; }
    push(n) {
        const a = this.a; a.push(n); let i = a.length - 1;
        while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
    }
    pop() {
        const a = this.a, top = a[0], last = a.pop();
        if (a.length) {
            a[0] = last; let i = 0; const n = a.length;
            for (;;) {
                let l = 2 * i + 1, r = l + 1, s = i;
                if (l < n && a[l].f < a[s].f) s = l;
                if (r < n && a[r].f < a[s].f) s = r;
                if (s === i) break;
                [a[s], a[i]] = [a[i], a[s]]; i = s;
            }
        }
        return top;
    }
}

function nearestWalkableNeighbor(gx, gz, walkable, sx, sz) {
    let best = null, bd = Infinity;
    for (const [dx, dz] of DIRS) {
        const nx = gx + dx, nz = gz + dz;
        if (!walkable(nx, nz)) continue;
        const d = (nx - sx) ** 2 + (nz - sz) ** 2;
        if (d < bd) { bd = d; best = { x: nx, z: nz }; }
    }
    return best;
}

function reconstruct(came, endK) {
    const out = [];
    let k = endK;
    while (k !== undefined) {
        const c = k.indexOf(',');
        out.push({ x: parseInt(k.slice(0, c), 10), z: parseInt(k.slice(c + 1), 10) });
        k = came.get(k);
    }
    out.reverse();
    out.shift(); // drop the start tile — caller is already standing on it
    return out;
}

/**
 * Find a route from (sx,sz) to (gx,gz). Returns an array of {x,z} waypoints
 * (excluding the start), [] if already there, or null if nothing reachable.
 */
export function findPath(sx, sz, gx, gz, walkable = defaultWalkable) {
    sx = Math.round(sx); sz = Math.round(sz); gx = Math.round(gx); gz = Math.round(gz);
    if (sx === gx && sz === gz) return [];

    // If the clicked tile itself is blocked (a building), aim for the nearest
    // walkable tile beside it so we still arrive right next to it.
    if (!walkable(gx, gz)) {
        const nb = nearestWalkableNeighbor(gx, gz, walkable, sx, sz);
        if (!nb) return null;
        gx = nb.x; gz = nb.z;
        if (sx === gx && sz === gz) return [];
    }

    const key = (x, z) => x + ',' + z;
    const open = new MinHeap();
    const gScore = new Map();
    const came = new Map();
    const startK = key(sx, sz);
    gScore.set(startK, 0);
    open.push({ x: sx, z: sz, f: heur(sx, sz, gx, gz) * H_WEIGHT });

    let expanded = 0;
    let best = { k: startK, h: heur(sx, sz, gx, gz) }; // closest reached (fallback)

    while (open.size() && expanded < MAX_NODES) {
        const cur = open.pop();
        const ck = key(cur.x, cur.z);
        if (cur.x === gx && cur.z === gz) return reconstruct(came, ck);
        expanded++;
        const cg = gScore.get(ck);
        for (const [dx, dz] of DIRS) {
            const nx = cur.x + dx, nz = cur.z + dz;
            if (!walkable(nx, nz)) continue;
            if (dx !== 0 && dz !== 0 && (!walkable(cur.x + dx, cur.z) || !walkable(cur.x, cur.z + dz))) continue; // no corner cut
            const nk = key(nx, nz);
            const ng = cg + ((dx !== 0 && dz !== 0) ? SQRT2 : 1);
            if (ng < (gScore.has(nk) ? gScore.get(nk) : Infinity)) {
                gScore.set(nk, ng);
                came.set(nk, ck);
                const h = heur(nx, nz, gx, gz);
                open.push({ x: nx, z: nz, f: ng + h * H_WEIGHT });
                if (h < best.h) best = { k: nk, h };
            }
        }
    }

    // Couldn't fully reach it within budget — head to the closest tile we found.
    return best.k !== startK ? reconstruct(came, best.k) : null;
}
