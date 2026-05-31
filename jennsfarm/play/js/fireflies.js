// js/fireflies.js — ambient critters on the day/night clock: glowing fireflies
// twinkle and drift around the farm at night, colourful butterflies flutter low
// by day (#46). One InstancedMesh that follows the player; particles wrap within
// a box around you. Pure day→critter choice is unit-tested; render is defensive.

import * as THREE from 'three';
import { scene } from './renderer.js';
import { registerSystem } from './registry.js';

const SPREAD = 24;

// Pure: which ambient critter for time of day.
export function ambientCritters(isNight) {
    return isNight
        ? { kind: 'firefly', count: 42, size: 0.05, lo: 0.4, hi: 3.0 }
        : { kind: 'butterfly', count: 28, size: 0.09, lo: 0.3, hi: 1.4 };
}

let mesh = null, currentKind = null, parts = [], cfg = null;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _yax = new THREE.Vector3(0, 1, 0);

function newPart(c, cx, cz) {
    return {
        x: cx + (Math.random() - 0.5) * SPREAD, z: cz + (Math.random() - 0.5) * SPREAD,
        y: c.lo + Math.random() * (c.hi - c.lo),
        ph: Math.random() * Math.PI * 2, sp: 0.5 + Math.random() * 1.5,
        dx: (Math.random() - 0.5) * 0.5, dz: (Math.random() - 0.5) * 0.5,
    };
}

export function clearFireflies() {
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
    mesh = null; currentKind = null; parts = []; cfg = null;
}

function rebuild(c, cx = 0, cz = 0) {
    clearFireflies();
    cfg = c; currentKind = c.kind;
    const geo = c.kind === 'firefly'
        ? new THREE.SphereGeometry(c.size, 5, 4)
        : new THREE.PlaneGeometry(c.size * 2, c.size * 1.4);
    const mat = new THREE.MeshBasicMaterial({
        transparent: true, opacity: c.kind === 'firefly' ? 0.95 : 0.9,
        side: THREE.DoubleSide, depthWrite: false,
        blending: c.kind === 'firefly' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    mesh = new THREE.InstancedMesh(geo, mat, c.count);
    mesh.frustumCulled = false;
    const col = new THREE.Color();
    const flutter = [0xffd1e8, 0xfff0a0, 0xb0e0ff, 0xffffff, 0xffb0b0];
    parts = [];
    for (let i = 0; i < c.count; i++) {
        parts.push(newPart(c, cx, cz));
        if (c.kind === 'firefly') col.setRGB(1.0, 0.92, 0.42);
        else col.set(flutter[i % flutter.length]);
        mesh.setColorAt(i, col);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
}

// Tick the ambient critters. `t` is a steadily increasing time (game seconds).
export function updateFireflies(dt, isNight, playerPos, t) {
    const c = ambientCritters(isNight);
    const px = playerPos ? playerPos.x : 0, pz = playerPos ? playerPos.z : 0;
    if (c.kind !== currentKind) rebuild(c, px, pz);
    mesh.visible = true;
    const firefly = cfg.kind === 'firefly';
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.x += p.dx * dt; p.z += p.dz * dt;
        // world-anchored: recycle near the player only when it drifts out of the box
        if (Math.abs(p.x - px) > SPREAD / 2 || Math.abs(p.z - pz) > SPREAD / 2) {
            p.x = px + (Math.random() - 0.5) * SPREAD;
            p.z = pz + (Math.random() - 0.5) * SPREAD;
        }
        const bob = Math.sin(t * p.sp + p.ph) * (firefly ? 0.35 : 0.22);
        _p.set(p.x, p.y + bob, p.z);
        const sc = firefly ? (0.55 + 0.6 * Math.abs(Math.sin(t * 3 * p.sp + p.ph))) : 1; // fireflies twinkle
        _s.set(sc, sc, sc);
        _q.setFromAxisAngle(_yax, firefly ? 0 : Math.sin(t * 2 * p.sp + p.ph) * 0.8 + p.ph); // butterflies flutter
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    mesh.instanceMatrix.needsUpdate = true;
}

// Self-register with the orchestrator (#9): critters tick off the shared ctx.
registerSystem({
    id: 'fireflies',
    update(dt, ctx) { updateFireflies(dt, ctx.isNight, ctx.playerPos, ctx.gameTime); },
});
