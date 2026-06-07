// js/weather.js — ambient seasonal weather that follows the player: snow in
// Winter, drifting leaves in Autumn, clear skies in Spring/Summer (#42, beefed #65).
// One InstancedMesh of falling particles around the player; particles recycle to
// the top when they land. Winter also lays a soft snow blanket on the ground that
// eases in/out. The season→weather choice is pure + unit-tested.

import * as THREE from 'three';
import { scene } from './renderer.js';
import { registerSystem } from './registry.js';

const SPREAD = 30; // particle box width around the player
const TOP = 11;    // spawn / recycle height

// Pure: which weather a season has (null = clear). Counts beefed up for wifey (#65).
export function seasonWeather(seasonName) {
    if (seasonName === 'Winter') return { kind: 'snow', count: 240, fall: 1.4, size: 0.07 };
    if (seasonName === 'Autumn') return { kind: 'leaves', count: 120, fall: 0.9, size: 0.09 };
    return null;
}

let mesh = null, currentKind = null, parts = [], cfg = null;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _zAxis = new THREE.Vector3(0, 0, 1);

function newParticle(cx, cz) {
    return {
        x: cx + (Math.random() - 0.5) * SPREAD, y: Math.random() * TOP, z: cz + (Math.random() - 0.5) * SPREAD,
        dx: (Math.random() - 0.5) * 0.5, dz: (Math.random() - 0.5) * 0.5,
        spin: Math.random() * Math.PI, vspin: (Math.random() - 0.5) * 2.2,
        sc: 0.55 + Math.random() * 1.1,        // flake-size variety → a sense of depth
        sway: Math.random() * Math.PI * 2,     // per-flake wind phase
    };
}

export function clearWeather() {
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
    mesh = null; currentKind = null; parts = []; cfg = null;
}

function rebuild(w, cx = 0, cz = 0) {
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); mesh = null; }
    cfg = w; currentKind = w.kind;
    const geo = w.kind === 'snow'
        ? new THREE.SphereGeometry(w.size, 5, 4)
        : new THREE.PlaneGeometry(w.size * 2.2, w.size * 1.6);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    mesh = new THREE.InstancedMesh(geo, mat, w.count);
    mesh.frustumCulled = false;
    const col = new THREE.Color();
    const leafCols = [0xd98a3a, 0xc8602a, 0xe0b24a, 0xb5532a];
    parts = [];
    for (let i = 0; i < w.count; i++) {
        parts.push(newParticle(cx, cz));
        if (w.kind === 'leaves') col.set(leafCols[i % leafCols.length]);
        else col.setRGB(0.96, 0.98, 1.0); // soft snow white
        mesh.setColorAt(i, col);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
}

// Tick the weather for the current season, keeping particles around (playerPos).
export function updateWeather(dt, seasonName, playerPos) {
    const w = seasonWeather(seasonName);
    const px = playerPos ? playerPos.x : 0, pz = playerPos ? playerPos.z : 0;

    if (!w) { if (mesh) mesh.visible = false; return; }
    if (w.kind !== currentKind) rebuild(w, px, pz);
    mesh.visible = true;
    const leaves = cfg.kind === 'leaves';
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.y -= cfg.fall * dt;
        p.sway += dt * 1.5;
        p.x += (p.dx + Math.sin(p.sway) * 0.35) * dt; // gentle wind drift
        p.z += p.dz * dt;
        // World-anchored: flakes fall in place (don't track the camera) and recycle
        // near the player only once they land or drift out of the box around them.
        if (p.y < 0 || Math.abs(p.x - px) > SPREAD / 2 || Math.abs(p.z - pz) > SPREAD / 2) {
            p.x = px + (Math.random() - 0.5) * SPREAD;
            p.z = pz + (Math.random() - 0.5) * SPREAD;
            p.y = TOP;
        }
        if (leaves) p.spin += p.vspin * dt;
        _p.set(p.x, p.y, p.z);
        _q.setFromAxisAngle(_zAxis, leaves ? p.spin : 0);
        _s.set(p.sc, p.sc, p.sc);
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    mesh.instanceMatrix.needsUpdate = true;
}

// Self-register with the orchestrator (#9): weather ticks off the shared ctx.
registerSystem({
    id: 'weather',
    update(dt, ctx) { updateWeather(dt, ctx.season ? ctx.season.name : '', ctx.playerPos); },
});
