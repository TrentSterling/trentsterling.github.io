// js/crates.js — Delivery crates. A truck periodically leaves a crate at the
// roadside; walk up and click it and it bursts open, showering you with its
// contents (seeds, supplies, or a rare gift). Trent's idea: "click a box and it
// explodes open." Crates also pile up (capped) while you're away.
//
// Imports THREE for the crate model, but all the contents/delivery logic is
// plain data so the suite can verify it (the suite inits a renderer first).

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { ITEMS } from './inventory.js';
import { registerSystem } from './registry.js';

// Crates land just south of the roadside stall (buyers.js: stall at 30,25).
const PAD_SLOTS = [ { x: 30, z: 27 }, { x: 29, z: 28 }, { x: 31, z: 28 }, { x: 29, z: 26 } ];
const MAX_CRATES = PAD_SLOTS.length;
const DELIVERY_EVERY = 95; // seconds between deliveries (slow, idle-friendly trickle)

export const CRATE_KINDS = {
    supply: { name: 'Supply Crate', color: 0xb98a4a, weight: 5 },
    seed:   { name: 'Seed Crate',   color: 0x6a9b4a, weight: 4 },
    gift:   { name: 'Gift Crate',   color: 0xc45a8a, weight: 2 }, // rare, premium ❤
};

let crates = [];   // { id, x, z, kind, contents:{items,coins}, grp, drop }
let nextId = 1;
let deliveryTimer = 30;  // first crate arrives ~30s into a fresh game
let crateClock = 0;

function rndInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function pickKind() {
    const entries = Object.entries(CRATE_KINDS);
    const total = entries.reduce((s, [, v]) => s + v.weight, 0);
    let r = Math.random() * total;
    for (const [id, v] of entries) { r -= v.weight; if (r <= 0) return id; }
    return entries[0][0];
}

// Roll a bundle of contents for a crate kind. Always references real ITEMS.
function rollContents(kind) {
    const items = {};
    let coins = 0;
    if (kind === 'supply') {
        coins = rndInt(30, 90);
        items.wood = rndInt(2, 6);
        if (Math.random() < 0.25) items.sprinkler = 1;
    } else if (kind === 'seed') {
        const seeds = Object.keys(ITEMS).filter(id => ITEMS[id].type === 'seed');
        const n = rndInt(1, 2);
        for (let i = 0; i < n; i++) { const s = pick(seeds); items[s] = (items[s] || 0) + rndInt(2, 5); }
    } else { // gift — a premium surprise
        coins = rndInt(80, 160);
        const treats = ['rose_seed', 'lavender_seed', 'grape_seed', 'love_potion', 'perfume'];
        const t = pick(treats); items[t] = (items[t] || 0) + 1;
    }
    return { items, coins };
}

function buildCrateModel(kind) {
    const g = new THREE.Group();
    const c = CRATE_KINDS[kind].color;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.58, 0.66, 2, 2, 2), curvedMaterial({ color: c }));
    box.position.y = 0.3; g.add(box);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.72, 1, 1, 1), curvedMaterial({ color: 0xf0d9a0 }));
    lid.position.y = 0.62; g.add(lid);
    if (kind === 'gift') { // a little bow so gifts read as special
        const bow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), curvedMaterial({ color: 0xff6ba5 }));
        bow.position.y = 0.74; g.add(bow);
    }
    return g;
}

function freeSlot() {
    return PAD_SLOTS.find(s => !crates.some(c => c.x === s.x && c.z === s.z)) || null;
}

function disposeCrate(c) {
    if (!c.grp) return;
    scene.remove(c.grp);
    c.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
}

export function initCrates() {
    for (const c of crates) disposeCrate(c);
    crates = [];
    nextId = 1;
    deliveryTimer = 30;
    crateClock = 0;
}

// Place a crate on the next free pad slot. contents optional (rolled if absent).
export function spawnCrate(kind, contents) {
    if (crates.length >= MAX_CRATES) return null;
    const slot = freeSlot();
    if (!slot) return null;
    const grp = buildCrateModel(kind);
    grp.position.set(slot.x, 0, slot.z);
    scene.add(grp);
    const crate = { id: nextId++, x: slot.x, z: slot.z, kind, contents: contents || rollContents(kind), grp, drop: 1 };
    crates.push(crate);
    return crate;
}

export function deliverCrate() {
    return spawnCrate(pickKind());
}

// Per-frame: run the delivery timer + idle bob/drop animation.
// Returns the freshly delivered crate (so the caller can announce it) or null.
export function updateCrates(dt) {
    let delivered = null;
    deliveryTimer -= dt;
    if (deliveryTimer <= 0) {
        deliveryTimer = DELIVERY_EVERY + Math.random() * 30;
        if (crates.length < MAX_CRATES) delivered = deliverCrate();
    }
    crateClock += dt;
    for (const c of crates) {
        if (c.drop > 0) c.drop = Math.max(0, c.drop - dt / 0.5);
        const bob = Math.sin((crateClock + c.id) * 1.6) * 0.04;
        c.grp.position.y = bob + c.drop * c.drop * 2.4; // ease-in fall on delivery
        c.grp.rotation.y += dt * 0.4;
    }
    return delivered;
}

export function crateAt(x, z, range = 0.7) {
    let best = null, bd = range * range;
    for (const c of crates) {
        const d = (c.x - x) ** 2 + (c.z - z) ** 2;
        if (d <= bd) { bd = d; best = c; }
    }
    return best;
}

// Open (and remove) the nearest crate within range of (x,z). Returns
// { kind, contents:{items,coins}, x, z } or null if none is close enough.
export function openCrateAt(x, z, range = 1.5) {
    let idx = -1, bd = range * range;
    for (let i = 0; i < crates.length; i++) {
        const d = (crates[i].x - x) ** 2 + (crates[i].z - z) ** 2;
        if (d <= bd) { bd = d; idx = i; }
    }
    if (idx < 0) return null;
    const c = crates[idx];
    disposeCrate(c);
    crates.splice(idx, 1);
    return { kind: c.kind, contents: c.contents, x: c.x, z: c.z };
}

// On return from an absence, leave a few crates waiting (capped). Returns count.
export function creditOfflineCrates(seconds) {
    const target = Math.min(MAX_CRATES, crates.length + Math.floor(seconds / DELIVERY_EVERY));
    let n = 0;
    while (crates.length < target && deliverCrate()) n++;
    return n;
}

// Self-register (#9): tick deliveries; announce a new crate via the shared ctx.
registerSystem({
    id: 'crates',
    update(dt, ctx) {
        const d = updateCrates(dt);
        if (d) {
            ctx.notify(`📦 A truck dropped off a ${CRATE_KINDS[d.kind].name} by the road!`);
            ctx.sparkle(d.x, 0.8, d.z, [0xffe0a0, 0xffffff]);
            ctx.playStore();
        }
    },
});

export function getCrateCount() { return crates.length; }
export function getCrates() { return crates.map(c => ({ id: c.id, x: c.x, z: c.z, kind: c.kind })); }

export function serializeCrates() {
    return crates.map(c => ({ id: c.id, x: c.x, z: c.z, kind: c.kind, contents: c.contents }));
}

export function loadCrates(data) {
    for (const c of crates) disposeCrate(c);
    crates = [];
    if (!data) return;
    for (const d of data) {
        if (!CRATE_KINDS[d.kind]) continue;
        const grp = buildCrateModel(d.kind);
        grp.position.set(d.x, 0, d.z);
        scene.add(grp);
        crates.push({ id: d.id || nextId++, x: d.x, z: d.z, kind: d.kind, contents: d.contents || rollContents(d.kind), grp, drop: 0 });
        if (d.id && d.id >= nextId) nextId = d.id + 1;
    }
}
