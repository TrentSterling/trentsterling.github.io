// js/sprinklers.js - Placeable sprinklers that auto-water the tiles around them
// every tick. The backbone of idle/AFK play: keep crops watered (and thus
// growing at full speed) without the player lifting a finger.

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { getTile } from './world.js';
import { waterTile } from './farm.js';
import { sparkle } from './juice.js';
import { mergeGroupGeo, mergedMat } from './meshmerge.js';

const RANGE = 1;          // waters a (2*RANGE+1) square around itself -> 3x3
const TICK = 0.6;         // seconds between watering passes
const DROPLET_EVERY = 1.6; // seconds between visual droplet puffs

const sprinklers = []; // { x, z, dropT }
let tickT = 0;

// All sprinklers are identical, so the whole farm's worth renders as ONE
// InstancedMesh (#35) — was ~6 meshes each. Rebuilt only when one is placed.
let _sprGeo = null, _sprIM = null, _sprDirty = false;
const _sM4 = new THREE.Matrix4();

function sprinklerGeo() {
    if (_sprGeo) return _sprGeo;
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 6), curvedMaterial({ color: 0x6b7886 }));
    post.position.y = 0.25; g.add(post);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), curvedMaterial({ color: 0x3f8fd0 }));
    head.position.y = 0.52; g.add(head);
    for (const a of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.02), curvedMaterial({ color: 0x9fb0bf }));
        arm.position.set(Math.cos(a) * 0.1, 0.52, Math.sin(a) * 0.1); arm.rotation.y = a; g.add(arm);
    }
    _sprGeo = mergeGroupGeo(g);
    return _sprGeo;
}

function rebuildSprinklerIM() {
    if (_sprIM) { scene.remove(_sprIM); _sprIM.dispose(); _sprIM = null; }
    _sprDirty = false;
    if (!sprinklers.length) return;
    const im = new THREE.InstancedMesh(sprinklerGeo(), mergedMat, sprinklers.length);
    sprinklers.forEach((s, i) => { _sM4.makeTranslation(s.x, 0.02, s.z); im.setMatrixAt(i, _sM4); });
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    scene.add(im);
    _sprIM = im;
}

export function addSprinkler(x, z) {
    sprinklers.push({ x, z, dropT: Math.random() * DROPLET_EVERY });
    _sprDirty = true;
    waterArea(x, z); // water immediately so it feels responsive
}

function waterArea(x, z) {
    for (let dz = -RANGE; dz <= RANGE; dz++) {
        for (let dx = -RANGE; dx <= RANGE; dx++) {
            waterTile(getTile(x + dx, z + dz));
        }
    }
}

export function updateSprinklers(dt) {
    if (_sprDirty) rebuildSprinklerIM();
    tickT += dt;
    const doWater = tickT >= TICK;
    if (doWater) tickT = 0;

    for (const s of sprinklers) {
        if (doWater) waterArea(s.x, s.z);
        s.dropT -= dt;
        if (s.dropT <= 0) {
            s.dropT = DROPLET_EVERY;
            sparkle(s.x, 0.55, s.z, [0x66bbff, 0xaad8ff]); // droplet puff
        }
    }
}

export function getSprinklerCount() { return sprinklers.length; }

/** Is tile (x,z) within range of any sprinkler? Used for offline growth. */
export function isWatering(x, z) {
    for (const s of sprinklers) {
        if (Math.abs(s.x - x) <= RANGE && Math.abs(s.z - z) <= RANGE) return true;
    }
    return false;
}

export function serializeSprinklers() {
    return sprinklers.map(s => ({ x: s.x, z: s.z }));
}

export function loadSprinklers(data) {
    if (!data) return;
    for (const d of data) addSprinkler(d.x, d.z);
}
