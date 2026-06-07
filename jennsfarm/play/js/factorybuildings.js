// js/factorybuildings.js — the physical buildings for the abstract factories (#64).
// Wifey wanted to SEE the winery, not just an upgrade line. When you own a factory
// type, its building appears in the little "industry row" west of the farm. Each
// building is ONE merged draw call (#35); positions are deterministic so they
// restore for free from the owned-factory save — nothing extra to serialize.

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { mergedMesh, freezeStatic } from './meshmerge.js';
import { getFactories } from './factories.js';

const FARM_CX = 24, FARM_CZ = 24;
// A tidy industry row just west of the farm.
const SPOTS = {
    winery:    { x: FARM_CX - 13, z: FARM_CZ - 3 },
    creamery:  { x: FARM_CX - 13, z: FARM_CZ },
    juicery:   { x: FARM_CX - 13, z: FARM_CZ + 3 },
    perfumery: { x: FARM_CX - 13, z: FARM_CZ + 6 },
};

function shed(g, wall, roof) { // shared body: walls + pitched roof
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 1.1, 2, 2, 2), curvedMaterial({ color: wall }));
    w.position.y = 0.5; g.add(w);
    const r = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.55, 4, 1), curvedMaterial({ color: roof }));
    r.position.y = 1.2; r.rotation.y = Math.PI / 4; g.add(r);
}

const BUILD = {
    winery(g) {
        shed(g, 0x7a3b54, 0x4a2233);                                   // wine-red shed
        for (const x of [-0.3, 0.3]) {                                  // two oak barrels out front
            const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 10), curvedMaterial({ color: 0x6e4423 }));
            b.position.set(x, 0.16, 0.66); b.rotation.x = Math.PI / 2; g.add(b);
        }
        const grapes = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), curvedMaterial({ color: 0x6a3d8a }));
        grapes.position.set(0, 0.95, 0.5); g.add(grapes);              // grape emblem
    },
    creamery(g) {
        shed(g, 0xf0e2b0, 0xb8924a);                                   // creamy dairy shed
        const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 10), curvedMaterial({ color: 0xd8d2c0 }));
        silo.position.set(0.55, 0.35, -0.2); g.add(silo);              // grain silo
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), curvedMaterial({ color: 0x9aa0a6 }));
        cap.position.set(0.55, 0.7, -0.2); g.add(cap);
        const cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 10), curvedMaterial({ color: 0xf2c64a }));
        cheese.position.set(0, 0.95, 0.5); g.add(cheese);             // cheese-wheel emblem
    },
    juicery(g) {
        shed(g, 0x4aa3b0, 0x2c6f78);
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.34, 10), curvedMaterial({ color: 0xffd23a }));
        cup.position.set(0, 1.0, 0.5); g.add(cup);
        const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5), curvedMaterial({ color: 0xff5577 }));
        straw.position.set(0.06, 1.2, 0.5); straw.rotation.z = 0.4; g.add(straw);
    },
    perfumery(g) {
        shed(g, 0xd9a7d6, 0x7a3b6e);                                   // dainty lilac shop
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.26, 8), curvedMaterial({ color: 0xf2c0e0 }));
        bottle.position.set(0, 0.95, 0.5); g.add(bottle);
        const stopper = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), curvedMaterial({ color: 0xb86fae }));
        stopper.position.set(0, 1.14, 0.5); g.add(stopper);
    },
};

let placed = {}; // type -> mesh

// Make sure every owned factory has its building (and no extras). Cheap; only
// builds a mesh the first time a type is newly owned.
export function syncFactoryBuildings() {
    const owned = getFactories() || {};
    for (const type in BUILD) {
        if (owned[type] && !placed[type] && SPOTS[type]) {
            const m = mergedMesh(BUILD[type]);
            m.position.set(SPOTS[type].x, 0, SPOTS[type].z);
            freezeStatic(m); // a building never moves — stop per-frame matrix work (#35)
            scene.add(m);
            placed[type] = m;
        }
    }
}

export function clearFactoryBuildings() {
    for (const t in placed) scene.remove(placed[t]);
    placed = {};
}
