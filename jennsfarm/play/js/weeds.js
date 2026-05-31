// js/weeds.js - Overgrown weeds the farm starts with. You clear them (hand or
// hoe) before a tile can be tilled - the first chore Grandpa sets you. Cleared
// state persists; positions are saved so they don't respawn.

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { getTile, TILE, isInFarm, WORLD_SIZE } from './world.js';

const FARM_CX = 24, FARM_CZ = 24;
const weeds = new Map(); // "x,z" -> { x, z, grp }

function key(x, z) { return `${x},${z}`; }

function buildWeed(x, z) {
    const g = new THREE.Group();
    const greens = [0x4a7c3a, 0x5a9c3f, 0x3f7a30];
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
        const blade = new THREE.Mesh(
            new THREE.ConeGeometry(0.05, 0.22 + Math.random() * 0.12, 4),
            curvedMaterial({ color: greens[i % greens.length] })
        );
        blade.position.set((Math.random() - 0.5) * 0.5, 0.11, (Math.random() - 0.5) * 0.5);
        blade.rotation.z = (Math.random() - 0.5) * 0.5;
        g.add(blade);
    }
    // a little dandelion dot for character
    if (Math.random() < 0.5) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), curvedMaterial({ color: 0xf2d33a }));
        flower.position.set((Math.random() - 0.5) * 0.3, 0.26, (Math.random() - 0.5) * 0.3);
        g.add(flower);
    }
    g.position.set(x, 0.02, z);
    return g;
}

function place(x, z) {
    if (weeds.has(key(x, z))) return;
    const grp = buildWeed(x, z);
    scene.add(grp);
    weeds.set(key(x, z), { x, z, grp });
}

// Scatter weeds on grass tiles across the starting farm (fresh game only).
export function spawnInitialWeeds(count = 14) {
    const hs = 4; // starting farm half-size
    let placed = 0, guard = 0;
    while (placed < count && guard++ < 400) {
        const x = FARM_CX - hs + Math.floor(Math.random() * hs * 2);
        const z = FARM_CZ - hs + Math.floor(Math.random() * hs * 2);
        const t = getTile(x, z);
        if (!t || t.type !== TILE.GRASS || weeds.has(key(x, z))) continue;
        place(x, z);
        placed++;
    }
}

export function hasWeedAt(x, z) { return weeds.has(key(x, z)); }

/** Clear a weed at the tile if present. Returns true if one was removed. */
export function clearWeedAt(x, z) {
    const w = weeds.get(key(x, z));
    if (!w) return false;
    scene.remove(w.grp);
    w.grp.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    weeds.delete(key(x, z));
    return true;
}

export function getWeedCount() { return weeds.size; }

export function serializeWeeds() {
    return [...weeds.values()].map(w => ({ x: w.x, z: w.z }));
}

export function loadWeeds(data) {
    // explicit list (incl. empty) means "use saved state, don't regenerate"
    for (const d of data) place(d.x, d.z);
}
