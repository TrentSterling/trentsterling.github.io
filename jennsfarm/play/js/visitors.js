// js/visitors.js — stray visitor cats that wander onto the farm now and then,
// mill about, then mosey off (#54). Pure ambient charm — "many animals show up
// lol". Self-registering system (one import in main, no other wiring). A food
// bowl that attracts MORE of them is the planned next slice.

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { registerSystem } from './registry.js';

const FARM_CX = 24, FARM_CZ = 24;
const MAX_VISITORS = 4;
const SPAWN_EVERY = 45;       // base seconds between arrivals
const CAT_COLORS = [0x9a9a9a, 0xd6913a, 0x2a2a2a, 0xe8e2d6]; // grey / ginger / black / cream

let visitors = [];
let timer = 20; // first cat wanders in ~20s after load

function buildCat(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.32), curvedMaterial({ color }));
    body.position.y = 0.14; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.15), curvedMaterial({ color }));
    head.position.set(0, 0.22, 0.2); g.add(head);
    for (const ex of [-0.05, 0.05]) {
        const e = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), curvedMaterial({ color }));
        e.position.set(ex, 0.32, 0.18); g.add(e);
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 5), curvedMaterial({ color }));
    tail.position.set(0, 0.2, -0.2); tail.rotation.x = -0.5; g.add(tail);
    for (const lx of [-0.07, 0.07]) for (const lz of [-0.1, 0.1]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 5), curvedMaterial({ color }));
        l.position.set(lx, 0.07, lz); g.add(l);
    }
    scene.add(g);
    return g;
}

function disposeVisitor(v) {
    scene.remove(v.grp);
    v.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
}

export function spawnVisitor() {
    if (visitors.length >= MAX_VISITORS) return null;
    const ang = Math.random() * Math.PI * 2, r = 18; // arrive from the edge
    const x = FARM_CX + Math.cos(ang) * r, z = FARM_CZ + Math.sin(ang) * r;
    const grp = buildCat(CAT_COLORS[Math.floor(Math.random() * CAT_COLORS.length)]);
    grp.position.set(x, 0.02, z);
    const v = { grp, x, z, tx: FARM_CX + (Math.random() * 2 - 1) * 9, tz: FARM_CZ + (Math.random() * 2 - 1) * 9, ttl: 30 + Math.random() * 45, bob: Math.random() * 6 };
    visitors.push(v);
    return v;
}

export function updateVisitors(dt) {
    timer -= dt;
    if (timer <= 0) { timer = SPAWN_EVERY + Math.random() * 30; spawnVisitor(); }
    for (let i = visitors.length - 1; i >= 0; i--) {
        const v = visitors[i];
        v.ttl -= dt;
        const dx = v.tx - v.x, dz = v.tz - v.z, d = Math.hypot(dx, dz);
        if (d > 0.25) {
            const s = Math.min(d, 1.6 * dt);
            v.x += (dx / d) * s; v.z += (dz / d) * s;
            v.grp.rotation.y = Math.atan2(dx, dz);
        } else { // reached a spot → pick a new place to pad to
            v.tx = FARM_CX + (Math.random() * 2 - 1) * 9;
            v.tz = FARM_CZ + (Math.random() * 2 - 1) * 9;
        }
        v.bob += dt;
        v.grp.position.set(v.x, 0.02 + Math.abs(Math.sin(v.bob * 6)) * 0.03, v.z);
        if (v.ttl <= 0) { disposeVisitor(v); visitors.splice(i, 1); }
    }
}

export function getVisitorCount() { return visitors.length; }
export function clearVisitors() { for (const v of visitors) disposeVisitor(v); visitors = []; timer = 20; }

// Self-register (#54): cats wander in/out each tick.
registerSystem({ id: 'visitors', update(dt) { updateVisitors(dt); } });
