// js/fountain.js — a buildable wishing fountain (#47). Walk up and click it to
// toss a coin for a random blessing: a coin jackpot, free seeds, a growth surge,
// a basket of fruit, or just a sweet word from Grandpa. The blessing ROLL is a
// pure weighted pick (unit-tested); main.js applies the effect (it owns coins /
// inventory / crops). One fountain at a time.

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { registerSystem } from './registry.js';

const FARM_CX = 24, FARM_CZ = 24;
export const FOUNTAIN_COST = 500;
export const TOSS_COST = 10;

export const BLESSINGS = [
    { kind: 'coins',   weight: 3 },
    { kind: 'seeds',   weight: 3 },
    { kind: 'grow',    weight: 2 },
    { kind: 'fruit',   weight: 2 },
    { kind: 'message', weight: 2 },
];

// Pure weighted pick from a 0..1 roll → blessing kind.
export function rollBlessing(r) {
    const total = BLESSINGS.reduce((s, b) => s + b.weight, 0);
    let x = (((r % 1) + 1) % 1) * total; // tolerate any real r
    for (const b of BLESSINGS) { x -= b.weight; if (x < 0) return b.kind; }
    return BLESSINGS[BLESSINGS.length - 1].kind;
}

let fountain = null; // { x, z, grp }
let t = 0;

function buildModel(x, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.72, 0.24, 12), curvedMaterial({ color: 0x9aa0a6 }));
    base.position.y = 0.12; g.add(base);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 12), curvedMaterial({ color: 0x4aa3d8 }));
    water.position.y = 0.25; g.add(water);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8), curvedMaterial({ color: 0x9aa0a6 }));
    post.position.y = 0.45; g.add(post);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), curvedMaterial({ color: 0x6bbfe0 }));
    orb.position.y = 0.68; g.add(orb); // children[3] — bobs in updateFountain
    g.position.set(x, 0.02, z);
    scene.add(g);
    return g;
}

export function hasFountain() { return !!fountain; }
export function getFountainPos() { return fountain ? { x: fountain.x, z: fountain.z } : null; }
export function fountainAt(x, z, range = 1.0) {
    return !!fountain && (fountain.x - x) ** 2 + (fountain.z - z) ** 2 <= range * range;
}

export function buildFountain() {
    if (fountain) return false;
    const x = FARM_CX + 3, z = FARM_CZ + 5; // just south of the farm
    fountain = { x, z, grp: buildModel(x, z) };
    return true;
}

export function updateFountain(dt) {
    if (!fountain) return;
    t += dt;
    fountain.grp.children[3].position.y = 0.68 + Math.sin(t * 2) * 0.03; // orb bob
}

// Self-register (#9): the fountain just bobs each tick (tossing is click-driven).
registerSystem({ id: 'fountain', update(dt) { updateFountain(dt); } });

export function serializeFountain() { return fountain ? { x: fountain.x, z: fountain.z } : null; }
export function loadFountain(d) {
    if (fountain) {
        scene.remove(fountain.grp);
        fountain.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        fountain = null;
    }
    if (d) fountain = { x: d.x, z: d.z, grp: buildModel(d.x, d.z) };
}
