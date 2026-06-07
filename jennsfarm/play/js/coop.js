// js/coop.js — buildable chicken coops: a little hen house that lays eggs on its
// own over time, so you don't have to chase chickens around for them. Bought at
// the shop, auto-placed near the farm. Eggs return to main each tick via the
// shared ctx (like the beehive's honey). Self-registering system (#9).

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { registerSystem } from './registry.js';
import { mergedMesh, mergedMat } from './meshmerge.js';

const FARM_CX = 24, FARM_CZ = 24;
const EGG_EVERY = 15;     // seconds per egg, per coop
const OFFLINE_CAP = 30;   // eggs per coop while away
const MAX_COOPS = 6;

export const COOP_COST = 260;

let coops = []; // { x, z, prodT, grp }

function buildCoop(x, z) {
    // Whole coop merges into ONE draw call (shared material).
    const grp = mergedMesh(g => {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.6), curvedMaterial({ color: 0xc8a06a }));
        body.position.y = 0.27; g.add(body);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.12, 0.74), curvedMaterial({ color: 0xb5532a }));
        roof.position.y = 0.55; g.add(roof);
        const gable = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), curvedMaterial({ color: 0xc9612f }));
        gable.position.y = 0.66; gable.rotation.y = Math.PI / 4; g.add(gable); // little diamond peak
        const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), curvedMaterial({ color: 0x2a1c10 }));
        hole.rotation.x = Math.PI / 2; hole.position.set(0, 0.25, 0.31); g.add(hole); // entrance
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.32), curvedMaterial({ color: 0x9c7b4a }));
        ramp.position.set(0, 0.1, 0.44); ramp.rotation.x = 0.5; g.add(ramp);
    });
    grp.position.set(x, 0.02, z);
    scene.add(grp);
    return { grp };
}

function disposeCoop(cp) {
    scene.remove(cp.grp);
    cp.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== mergedMat) o.material.dispose(); });
}

export function placeCoop(x, z) {
    if (coops.length >= MAX_COOPS) return false;
    coops.push({ x, z, prodT: EGG_EVERY, ...buildCoop(x, z) });
    return true;
}

// Buy → auto-place a coop on an open-ish spot near the farm.
export function buyCoopPlacement() {
    const x = FARM_CX + Math.round((Math.random() * 2 - 1) * 6);
    const z = FARM_CZ + Math.round((Math.random() * 2 - 1) * 6);
    return placeCoop(x, z);
}

// Per-frame: tick egg production. Returns eggs laid this tick across all coops.
export function updateCoops(dt) {
    let eggs = 0;
    for (const cp of coops) {
        cp.prodT -= dt;
        if (cp.prodT <= 0) { cp.prodT = EGG_EVERY; eggs++; }
    }
    return eggs;
}

// Eggs laid while away (capped per coop).
export function creditOfflineEggs(seconds) {
    return coops.length * Math.min(Math.floor(seconds / EGG_EVERY), OFFLINE_CAP);
}

export function getCoopCount() { return coops.length; }

// Self-register (#9): lay eggs each tick via the shared ctx.
registerSystem({
    id: 'coop',
    update(dt, ctx) {
        const eggs = updateCoops(dt);
        if (eggs) { ctx.addItem('egg', eggs); ctx.refreshUI(); }
    },
});

export function serializeCoops() { return coops.map(c => ({ x: c.x, z: c.z })); }
export function loadCoops(data) {
    for (const cp of coops) disposeCoop(cp);
    coops = [];
    if (!data) return;
    for (const d of data) placeCoop(d.x, d.z);
}
