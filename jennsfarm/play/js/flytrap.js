// js/flytrap.js — a buildable carnivorous plant (Venus flytrap) that periodically
// snaps up a nearby pest (crows) and composts it for a couple coins, with a
// satisfying chomp (#58). It eats via animals.eatNearestPest, which ONLY ever
// targets crows — skunks are sacred and can never be eaten. Self-registering.

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { registerSystem } from './registry.js';
import { eatNearestPest } from './animals.js';

const FARM_CX = 24, FARM_CZ = 24;
export const FLYTRAP_COST = 180;
const SNAP_EVERY = 16;   // seconds between snap attempts
const RANGE = 3.5;       // how close a pest must be
const MAX_FLYTRAPS = 6;

let traps = [];

function buildModel(x, z) {
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.18, 8), curvedMaterial({ color: 0x8a5a3a }));
    pot.position.y = 0.09; g.add(pot);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 5), curvedMaterial({ color: 0x4a7c3a }));
    stem.position.y = 0.32; g.add(stem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 7, 5), curvedMaterial({ color: 0xc0392b }));
    head.position.y = 0.52; g.add(head); // children[2] — pops on chomp
    for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 4), curvedMaterial({ color: 0xffffff }));
        tooth.position.set(Math.cos(a) * 0.11, 0.58, Math.sin(a) * 0.11);
        g.add(tooth);
    }
    g.position.set(x, 0.02, z);
    scene.add(g);
    return g;
}

function disposeTrap(t) {
    scene.remove(t.grp);
    t.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
}

export function placeFlytrap(x, z) {
    if (traps.length >= MAX_FLYTRAPS) return false;
    traps.push({ grp: buildModel(x, z), x, z, snap: SNAP_EVERY * Math.random(), chomp: 0 });
    return true;
}

export function buyFlytrapPlacement() {
    const x = FARM_CX + Math.round((Math.random() * 2 - 1) * 6);
    const z = FARM_CZ + Math.round((Math.random() * 2 - 1) * 6);
    return placeFlytrap(x, z);
}

export function updateFlytraps(dt, ctx) {
    for (const t of traps) {
        t.snap -= dt;
        if (t.chomp > 0) { t.chomp -= dt; const s = 1 + Math.sin(Math.max(0, t.chomp) / 0.3 * Math.PI) * 0.6; t.grp.children[2].scale.setScalar(s); }
        if (t.snap <= 0) {
            t.snap = SNAP_EVERY + Math.random() * 8;
            const eaten = eatNearestPest(t.x, t.z, RANGE); // crows only — NEVER skunks
            if (eaten) {
                t.chomp = 0.3;
                if (ctx && ctx.gainCoins) ctx.gainCoins(4);          // composted into a couple coins
                if (ctx && ctx.sparkle) ctx.sparkle(t.x, 0.5, t.z, [0x6ab04a, 0xffffff]);
            }
        }
    }
}

export function getFlytrapCount() { return traps.length; }
export function serializeFlytraps() { return traps.map(t => ({ x: t.x, z: t.z })); }
export function loadFlytraps(data) {
    for (const t of traps) disposeTrap(t);
    traps = [];
    if (!data) return;
    for (const d of data) placeFlytrap(d.x, d.z);
}

// Self-register (#58): snaps at pests each tick.
registerSystem({ id: 'flytrap', update(dt, ctx) { updateFlytraps(dt, ctx); } });
