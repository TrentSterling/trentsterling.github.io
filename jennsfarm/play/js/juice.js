// js/juice.js - Game feel: particle bursts, squash/stretch pops, FRIM damping.
// Smoothing uses the half-life method (Freya Holmér, see tront.xyz/lerp):
//   value = lerp(value, target, 1 - 2^(-dt/halfLife))

import * as THREE from 'three';
import { scene } from './renderer.js';

// FRIM half-life damp - "halfLife" = seconds to cover half the remaining distance.
export const damp = (a, b, halfLife, dt) => a + (b - a) * (1 - Math.pow(2, -dt / halfLife));

const particles = []; // { mesh, vx, vy, vz, grav, spin, life, maxLife }
const tweens = [];    // { obj, t, dur, amount, base }  squash/stretch on an Object3D

// Shared geometries (never disposed) keep bursts cheap.
let chipGeo, sparkGeo, coinGeo;
function ensureGeo() {
    if (chipGeo) return;
    chipGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    sparkGeo = new THREE.SphereGeometry(0.05, 5, 4);
    coinGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 8);
}

function spawn(x, y, z, color, o) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
    const m = new THREE.Mesh(o.geo || chipGeo, mat);
    m.position.set(x, y, z);
    if (o.scale) m.scale.setScalar(o.scale);
    scene.add(m);
    const speed = o.speed ?? 2.5;
    particles.push({
        mesh: m,
        vx: (Math.random() * 2 - 1) * speed,
        vy: (o.up ?? 3) + Math.random() * 2,
        vz: (Math.random() * 2 - 1) * speed,
        grav: o.grav ?? 9,
        spin: (Math.random() * 2 - 1) * 8,
        life: o.life ?? 0.7, maxLife: o.life ?? 0.7,
    });
}

export function burst(x, y, z, opts = {}) {
    ensureGeo();
    const { count = 8, color = 0x8b5a2b } = opts;
    const colors = Array.isArray(color) ? color : [color];
    for (let i = 0; i < count; i++) spawn(x, y, z, colors[i % colors.length], opts);
}

// --- Presets ---
export const woodBurst = (x, z) => burst(x, 0.45, z, { count: 16, color: [0x8b5a2b, 0x6e4a26, 0xc8a86e], speed: 3.2, up: 4, life: 1.0 });
export const chip      = (x, z) => burst(x, 0.5, z,  { count: 5,  color: [0x8b5a2b, 0xc8a86e], speed: 2, up: 2.5, life: 0.5 });
export const coinBurst = (x, z) => { ensureGeo(); burst(x, 0.6, z, { count: 12, color: [0xffd24a, 0xf2c21b], speed: 2.5, up: 4.2, life: 0.95, geo: coinGeo }); };
export const puff      = (x, z) => burst(x, 0.15, z, { count: 7,  color: [0x8b5e3c, 0xa9764a], speed: 1.5, up: 1.5, life: 0.5, grav: 5 });
export const sparkle   = (x, y, z, color = [0xfff5aa, 0xffffff]) => { ensureGeo(); burst(x, y, z, { count: 9, color, speed: 1.8, up: 2.8, life: 0.75, geo: sparkGeo }); };
export const hearts    = (x, y, z) => { ensureGeo(); burst(x, y, z, { count: 12, color: [0xff5d8f, 0xff9ec0, 0xffd0e0], speed: 1.1, up: 3, life: 1.4, grav: 2.5, geo: sparkGeo }); };

// Squash/stretch: pops scale.y up and scale.xz in, then settles back (sin envelope).
export function pop(obj, amount = 0.35, dur = 0.32) {
    if (!obj) return;
    // If a pop is already running on this object, reuse ITS true base scale and
    // restart — otherwise we'd capture a mid-squash scale as the new base and
    // shrink the object a little every overlapping pop (the "tiny Jenn" bug).
    let base = obj.scale.x || 1;
    for (let i = tweens.length - 1; i >= 0; i--) {
        if (tweens[i].obj === obj) { base = tweens[i].base; obj.scale.setScalar(base); tweens.splice(i, 1); }
    }
    tweens.push({ obj, t: 0, dur, amount, base });
}

export function updateJuice(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
            scene.remove(p.mesh);
            p.mesh.material.dispose(); // geometry is shared - don't dispose
            particles.splice(i, 1);
            continue;
        }
        p.vy -= p.grav * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        if (p.mesh.position.y < 0.05) { p.mesh.position.y = 0.05; p.vy *= -0.4; p.vx *= 0.6; p.vz *= 0.6; }
        p.mesh.rotation.x += p.spin * dt;
        p.mesh.rotation.y += p.spin * dt;
        p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
    }
    for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i];
        tw.t += dt;
        const k = Math.min(1, tw.t / tw.dur);
        const e = Math.sin(k * Math.PI); // 0 -> 1 -> 0
        tw.obj.scale.y = tw.base * (1 + tw.amount * e);
        tw.obj.scale.x = tw.base * (1 - tw.amount * 0.5 * e);
        tw.obj.scale.z = tw.base * (1 - tw.amount * 0.5 * e);
        if (k >= 1) { tw.obj.scale.setScalar(tw.base); tweens.splice(i, 1); }
    }
}
