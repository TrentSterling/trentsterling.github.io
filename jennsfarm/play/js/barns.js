// js/barns.js — placeable Barns (#71): build extra barns from the Build menu and
// each one adds storage capacity to your depot. Complements the barn-level upgrade.
// Each barn is ONE merged, matrix-frozen draw (static) for cheap rendering (#35).

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { mergedMesh, freezeStatic } from './meshmerge.js';

export const BARN_CAP = 100; // storage each placed barn adds

let barns = []; // { x, z, mesh }

// The barn model parts (added to a group); shared by the real mesh + the ghost preview.
function barnParts(g) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1, 2, 2, 2), curvedMaterial({ color: 0x8B3A2B }));
    body.position.y = 0.6; g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.6, 4, 1), curvedMaterial({ color: 0x6B4226 }));
    roof.position.y = 1.4; roof.rotation.y = Math.PI / 4; g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.02), curvedMaterial({ color: 0x5C2E0E }));
    door.position.set(0, 0.35, 0.56); g.add(door);
    const loft = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.04), curvedMaterial({ color: 0xe8c46a }));
    loft.position.set(0, 0.95, 0.56); g.add(loft); // hayloft window
}

// A fresh Group of the real model for the build-mode ghost preview (#36).
export function barnModel() { const g = new THREE.Group(); barnParts(g); return g; }

export function placeBarn(x, z) {
    const m = mergedMesh(barnParts);
    m.position.set(x, 0, z);
    freezeStatic(m);
    scene.add(m);
    barns.push({ x, z, mesh: m });
    return true;
}

export function getBarnCount() { return barns.length; }

export function serializeBarns() { return barns.map(b => ({ x: b.x, z: b.z })); }
export function loadBarns(data) {
    for (const b of barns) scene.remove(b.mesh);
    barns = [];
    if (data) for (const b of data) placeBarn(b.x, b.z);
}
