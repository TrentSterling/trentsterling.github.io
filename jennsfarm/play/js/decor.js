// js/decor.js — purchasable cosmetic garden props (benches, lamps, gnomes…) for
// the Sims-style build catalog. PERF (#35): every prop of a given TYPE renders as
// ONE InstancedMesh sharing a baked, vertex-coloured geometry — so a hundred hay
// bales is still a single draw call. Rebuilt only when a prop is placed/removed
// (rebuild-on-dirty), so there's zero per-frame cost.

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { mergeGroupGeo, mergedMat } from './meshmerge.js';
import { terrainHeight } from './terrain.js';

// The hand-built core (0..48) is flat ground; everything beyond is procedural
// heightmap. Props sit on whichever applies so they never float or sink (#36).
const inCore = (x, z) => x >= 0 && x < 48 && z >= 0 && z < 48;
const groundY = (x, z) => inCore(x, z) ? 0.02 : terrainHeight(x, z) + 0.02;

// --- tiny geometry helpers ---
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, s = 8) => new THREE.SphereGeometry(r, s, Math.max(4, s - 2));
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);

// add a coloured part to a group at a position (+ optional rotations)
function part(g, geo, color, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, curvedMaterial({ color }));
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry; if (rz) m.rotation.z = rz;
    g.add(m);
    return m;
}

const FLOWER_COLS = [0xf9e04b, 0xe8688f, 0xf08a3a, 0x8fb8ff, 0xf2f2e8];

// --- prop builders (each returns a Group of coloured parts, merged later) ---
const BUILD = {
    haybale(g) {
        part(g, cyl(0.26, 0.26, 0.5, 10), 0xdcc24a, 0, 0.26, 0, 0, 0, Math.PI / 2);
        part(g, cyl(0.265, 0.265, 0.06, 10), 0xc4a838, 0, 0.26, 0.16, 0, 0, Math.PI / 2);
        part(g, cyl(0.265, 0.265, 0.06, 10), 0xc4a838, 0, 0.26, -0.16, 0, 0, Math.PI / 2);
    },
    flowerbed(g) {
        part(g, box(0.7, 0.12, 0.7), 0x5a3a22, 0, 0.06, 0);
        part(g, box(0.74, 0.05, 0.74), 0x8a6a4a, 0, 0.13, 0);
        const spots = [[-0.18, -0.18], [0.18, -0.16], [0, 0.02], [-0.16, 0.18], [0.18, 0.18]];
        spots.forEach((s, i) => {
            part(g, cyl(0.015, 0.015, 0.18, 4), 0x3f7a34, s[0], 0.22, s[1]);
            part(g, sph(0.06, 6), FLOWER_COLS[i % FLOWER_COLS.length], s[0], 0.32, s[1]);
        });
    },
    bench(g) {
        part(g, box(0.72, 0.06, 0.26), 0xa9763f, 0, 0.24, 0);
        part(g, box(0.72, 0.22, 0.05), 0xa9763f, 0, 0.36, -0.11);
        for (const sx of [-0.3, 0.3]) for (const sz of [-0.09, 0.09]) part(g, box(0.05, 0.24, 0.05), 0x6e4a26, sx, 0.12, sz);
    },
    signpost(g) {
        part(g, cyl(0.04, 0.04, 0.7, 6), 0x6e4a26, 0, 0.35, 0);
        part(g, box(0.34, 0.2, 0.04), 0xb8924a, 0, 0.56, 0);
        part(g, box(0.34, 0.2, 0.01), 0x6e4a26, 0, 0.56, 0.025); // dark face trim
    },
    gnome(g) {
        part(g, cone(0.13, 0.28, 8), 0x3b6fb0, 0, 0.14, 0);   // body/coat
        part(g, sph(0.085, 8), 0xf0c49a, 0, 0.32, 0);          // head
        part(g, cone(0.1, 0.18, 8), 0xd23b3b, 0, 0.44, 0);     // pointy hat
        part(g, sph(0.06, 6), 0xf2f2f2, 0, 0.27, 0.06);        // beard
    },
    lamp(g) {
        part(g, cyl(0.1, 0.12, 0.08, 8), 0x3a3f47, 0, 0.04, 0);
        part(g, cyl(0.03, 0.03, 0.85, 6), 0x33383f, 0, 0.46, 0);
        part(g, box(0.15, 0.17, 0.15), 0x2a2e34, 0, 0.95, 0);
        part(g, sph(0.07, 8), 0xffe79a, 0, 0.95, 0);           // warm glow bulb
        part(g, cone(0.11, 0.09, 4), 0x33383f, 0, 1.08, 0, 0, Math.PI / 4);
    },
    topiary(g) {
        part(g, cyl(0.12, 0.16, 0.18, 8), 0xb5642f, 0, 0.09, 0); // pot
        part(g, sph(0.22, 10), 0x2f7d3a, 0, 0.4, 0);
        part(g, sph(0.15, 8), 0x35893f, 0, 0.62, 0);
    },
    birdbath(g) {
        part(g, cyl(0.07, 0.1, 0.45, 8), 0x9a9aa2, 0, 0.22, 0);
        part(g, cyl(0.22, 0.16, 0.08, 12), 0xb0b0b8, 0, 0.46, 0);
        part(g, cyl(0.18, 0.18, 0.02, 12), 0x66bbff, 0, 0.5, 0); // water
    },
    picnic(g) {
        part(g, box(0.9, 0.05, 0.5), 0xc09a5a, 0, 0.42, 0);     // table top
        for (const sz of [-0.34, 0.34]) part(g, box(0.9, 0.04, 0.15), 0xa9763f, 0, 0.24, sz);
        for (const sx of [-0.38, 0.38]) for (const sz of [-0.22, 0.22]) part(g, box(0.05, 0.42, 0.05), 0x6e4a26, sx, 0.2, sz);
    },
    well(g) {
        part(g, cyl(0.3, 0.32, 0.42, 12), 0x8a8a90, 0, 0.21, 0); // stone drum
        part(g, cyl(0.24, 0.24, 0.04, 12), 0x222428, 0, 0.41, 0); // dark water
        for (const sx of [-0.26, 0.26]) part(g, box(0.05, 0.55, 0.05), 0x6e4a26, sx, 0.68, 0);
        part(g, cyl(0.025, 0.025, 0.55, 6), 0x5a3a22, 0, 0.9, 0, 0, 0, Math.PI / 2); // crank bar
        part(g, cone(0.42, 0.26, 4), 0x8b3a2b, 0, 1.07, 0, 0, Math.PI / 4); // roof
    },
    statue(g) {
        part(g, box(0.36, 0.28, 0.36), 0xa6a6ad, 0, 0.14, 0);  // pedestal
        part(g, box(0.3, 0.05, 0.3), 0x9a9aa0, 0, 0.3, 0);
        part(g, cyl(0.1, 0.14, 0.42, 8), 0xc6c6cc, 0, 0.53, 0); // figure
        part(g, sph(0.1, 8), 0xc6c6cc, 0, 0.79, 0);             // head
    },
    windmill(g) {
        part(g, cyl(0.18, 0.3, 1.2, 8), 0xd8cbb0, 0, 0.6, 0);  // tower
        part(g, cone(0.32, 0.32, 8), 0x7a3b2b, 0, 1.36, 0);    // cap
        part(g, sph(0.08, 6), 0x4a4a4a, 0, 1.08, 0.32);        // hub
        for (let i = 0; i < 4; i++) {                           // 4 sails on the front face
            const a = i * Math.PI / 2;
            part(g, box(0.5, 0.1, 0.02), 0xeee6d0, Math.cos(a) * 0.28, 1.08 + Math.sin(a) * 0.28, 0.34, 0, 0, a);
        }
    },
};

// Catalog metadata (id → display + price). Order = catalog order (cheap → fancy).
export const DECOR_TYPES = {
    haybale:   { name: 'Hay Bale',     emoji: '🌾', cost: 30,  footprint: 0.6, note: 'rustic charm' },
    flowerbed: { name: 'Flower Bed',   emoji: '🌷', cost: 45,  footprint: 0.8, note: 'a splash of colour' },
    signpost:  { name: 'Signpost',     emoji: '🪧', cost: 50,  footprint: 0.5, note: 'mark the way' },
    bench:     { name: 'Garden Bench', emoji: '🪑', cost: 65,  footprint: 0.9, note: 'a place to rest' },
    gnome:     { name: 'Garden Gnome', emoji: '🧙', cost: 75,  footprint: 0.4, note: 'keeps you company' },
    lamp:      { name: 'Lamp Post',    emoji: '🏮', cost: 95,  footprint: 0.5, note: 'warm glow' },
    topiary:   { name: 'Topiary',      emoji: '🌳', cost: 110, footprint: 0.6, note: 'tidy hedge' },
    birdbath:  { name: 'Bird Bath',    emoji: '🐦', cost: 125, footprint: 0.6, note: 'invites birds' },
    picnic:    { name: 'Picnic Table', emoji: '🧺', cost: 140, footprint: 1.0, note: 'family gathering' },
    well:      { name: 'Stone Well',   emoji: '🪣', cost: 185, footprint: 0.9, note: 'old-world cosy' },
    statue:    { name: 'Statue',       emoji: '🗿', cost: 220, footprint: 0.7, note: 'grand centrepiece' },
    windmill:  { name: 'Windmill',     emoji: '🌬️', cost: 420, footprint: 1.0, note: 'landmark for the estate' },
};

// Catalog array for the build menu UI.
export const DECOR_CATALOG = Object.entries(DECOR_TYPES).map(([id, t]) => ({ id, ...t }));

// --- placed instances + per-type InstancedMesh rendering ---
let placed = [];            // { id, x, z, rot }
const _geo = {};            // id -> merged geometry (cached, built once per type)
const _ims = {};            // id -> InstancedMesh
let _dirty = false;
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _YUP = new THREE.Vector3(0, 1, 0);

function geoFor(id) {
    if (!_geo[id]) {
        const g = new THREE.Group();
        BUILD[id](g);
        _geo[id] = mergeGroupGeo(g);
    }
    return _geo[id];
}

function rebuildDecorIMs() {
    _dirty = false;
    const byId = {};
    for (const d of placed) (byId[d.id] = byId[d.id] || []).push(d);
    // drop IMs whose type is no longer placed
    for (const id in _ims) {
        if (!byId[id]) { scene.remove(_ims[id]); _ims[id].dispose(); delete _ims[id]; }
    }
    // (re)build one InstancedMesh per present type
    for (const id in byId) {
        const list = byId[id];
        if (_ims[id]) { scene.remove(_ims[id]); _ims[id].dispose(); }
        const im = new THREE.InstancedMesh(geoFor(id), mergedMat, list.length);
        list.forEach((d, i) => {
            _p.set(d.x, groundY(d.x, d.z), d.z); _q.setFromAxisAngle(_YUP, d.rot || 0);
            im.setMatrixAt(i, _m4.compose(_p, _q, _s));
        });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        scene.add(im);
        _ims[id] = im;
    }
}

export function placeDecor(id, x, z, rot = 0) {
    if (!BUILD[id]) return false;
    placed.push({ id, x, z, rot });
    _dirty = true;
    return true;
}

// Remove the nearest placed prop within range (for a future "sell/remove" tool).
export function removeDecorNear(x, z, range = 0.6) {
    let bi = -1, bd = range * range;
    for (let i = 0; i < placed.length; i++) {
        const dd = (placed[i].x - x) ** 2 + (placed[i].z - z) ** 2;
        if (dd <= bd) { bd = dd; bi = i; }
    }
    if (bi < 0) return null;
    const id = placed[bi].id;
    placed.splice(bi, 1);
    _dirty = true;
    return id;
}

// Rebuild the batches if anything changed (call once per frame from the game loop).
export function updateDecor() { if (_dirty) rebuildDecorIMs(); }

export function getDecorCount() { return placed.length; }
export function countByType() {
    const c = {};
    for (const d of placed) c[d.id] = (c[d.id] || 0) + 1;
    return c;
}

export function serializeDecor() { return placed.map(d => ({ id: d.id, x: d.x, z: d.z, rot: d.rot })); }
export function loadDecor(data) {
    placed = [];
    for (const id in _ims) { scene.remove(_ims[id]); _ims[id].dispose(); delete _ims[id]; }
    if (data) for (const d of data) if (BUILD[d.id]) placed.push({ id: d.id, x: d.x, z: d.z, rot: d.rot || 0 });
    _dirty = true;
}
