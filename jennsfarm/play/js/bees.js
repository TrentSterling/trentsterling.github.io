// js/bees.js — buildable beehives: a stacked skep with a few bees orbiting it,
// producing honey (a premium good) over time (#44). Bought at the shop and
// auto-placed near the farm. Honey production returns to main each tick (like
// factories) so this module stays decoupled from the inventory. Pollination
// (a nearby-crop grow bonus) is a planned follow-up slice.

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { registerSystem } from './registry.js';
import { mergedMesh, mergedMat } from './meshmerge.js';

const FARM_CX = 24, FARM_CZ = 24;
const HONEY_EVERY = 26;   // seconds per honey jar
const OFFLINE_CAP = 20;   // honey per hive while away
const MAX_HIVES = 6;

let hives = []; // { x, z, prodT, grp, beeMesh, bees:[{a,r,hh,sp}] }

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);

function buildHive(x, z) {
    // The skep (3 stacked tiers) merges into ONE draw; the bees stay a separate swarm.
    const grp = mergedMesh(g => {
        const tiers = [[0.22, 0.26, 0.16, 0.08, 0xe0b24a], [0.18, 0.22, 0.14, 0.22, 0xd6a23a], [0.12, 0.18, 0.12, 0.34, 0xcc9430]];
        for (const [rt, rb, h, y, c] of tiers) {
            const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 10), curvedMaterial({ color: c }));
            m.position.y = y; g.add(m);
        }
    });
    grp.position.set(x, 0.02, z);
    scene.add(grp);

    const beeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 4, 3), curvedMaterial({ color: 0x2a2a18 }), 5);
    beeMesh.frustumCulled = false;
    scene.add(beeMesh);
    const bees = [];
    for (let i = 0; i < 5; i++) bees.push({ a: Math.random() * 6.28, r: 0.3 + Math.random() * 0.3, hh: 0.3 + Math.random() * 0.45, sp: 1 + Math.random() * 2 });

    return { grp, beeMesh, bees };
}

function disposeHive(hv) {
    scene.remove(hv.grp); scene.remove(hv.beeMesh);
    hv.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== mergedMat) o.material.dispose(); });
    hv.beeMesh.geometry.dispose(); hv.beeMesh.material.dispose();
}

export function placeHive(x, z) {
    if (hives.length >= MAX_HIVES) return false;
    hives.push({ x, z, prodT: HONEY_EVERY, ...buildHive(x, z) });
    return true;
}

// Buy → auto-place a hive on an open-ish spot near the farm.
export function buyHivePlacement() {
    const x = FARM_CX + Math.round((Math.random() * 2 - 1) * 5);
    const z = FARM_CZ + Math.round((Math.random() * 2 - 1) * 5);
    return placeHive(x, z);
}

// Per-frame: animate the bees + tick honey. Returns honey jars produced this tick.
export function updateBees(dt, t) {
    let honey = 0;
    for (const hv of hives) {
        for (let i = 0; i < hv.bees.length; i++) {
            const b = hv.bees[i];
            b.a += b.sp * dt;
            _p.set(hv.x + Math.cos(b.a) * b.r, b.hh + Math.sin(t * 3 + i) * 0.06, hv.z + Math.sin(b.a) * b.r);
            hv.beeMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
        }
        hv.beeMesh.instanceMatrix.needsUpdate = true;
        hv.prodT -= dt;
        if (hv.prodT <= 0) { hv.prodT = HONEY_EVERY; honey++; }
    }
    return honey;
}

// Honey made while away (capped per hive).
export function creditOfflineHoney(seconds) {
    return hives.length * Math.min(Math.floor(seconds / HONEY_EVERY), OFFLINE_CAP);
}

export function getHiveCount() { return hives.length; }
export const HIVE_COST = 350;

// Self-register (#9): produce honey each tick via the shared ctx.
registerSystem({
    id: 'bees',
    update(dt, ctx) {
        const honey = updateBees(dt, ctx.gameTime);
        if (honey) { ctx.addItem('honey', honey); ctx.refreshUI(); }
    },
});

export function serializeHives() { return hives.map(h => ({ x: h.x, z: h.z })); }
export function loadHives(data) {
    for (const hv of hives) disposeHive(hv);
    hives = [];
    if (!data) return;
    for (const d of data) placeHive(d.x, d.z);
}
