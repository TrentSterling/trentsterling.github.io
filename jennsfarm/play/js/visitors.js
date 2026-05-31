// js/visitors.js — stray visitor cats that wander onto the farm now and then,
// mill about, then mosey off (#54). Pure ambient charm — "many animals show up
// lol". Self-registering system (one import in main, no other wiring). A food
// bowl that attracts MORE of them is the planned next slice.

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { registerSystem } from './registry.js';

const FARM_CX = 24, FARM_CZ = 24;
const MAX_VISITORS = 4;
const MAX_WITH_BOWL = 7;
const SPAWN_EVERY = 45;       // base seconds between arrivals
const CAT_COLORS = [0x9a9a9a, 0xd6913a, 0x2a2a2a, 0xe8e2d6]; // grey / ginger / black / cream
export const FOOD_BOWL_COST = 120;
const BOWL_POS = { x: FARM_CX - 3, z: FARM_CZ + 4 };

let visitors = [];
let timer = 20; // first cat wanders in ~20s after load
let foodBowl = null; // a placed food bowl draws more cats, faster, to it

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

function buildBowl() {
    const g = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.1, 10), curvedMaterial({ color: 0xb5532a }));
    bowl.position.y = 0.05; g.add(bowl);
    const food = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10), curvedMaterial({ color: 0xd8a05a }));
    food.position.y = 0.1; g.add(food);
    g.position.set(BOWL_POS.x, 0.02, BOWL_POS.z);
    scene.add(g);
    return g;
}

export function placeFoodBowl() { if (foodBowl) return false; foodBowl = buildBowl(); return true; }
export function hasFoodBowl() { return !!foodBowl; }

// A wander target — drawn to the food bowl when one's out, else roam the farm.
function wanderTarget() {
    if (foodBowl) return { x: BOWL_POS.x + (Math.random() * 2 - 1) * 3, z: BOWL_POS.z + (Math.random() * 2 - 1) * 3 };
    return { x: FARM_CX + (Math.random() * 2 - 1) * 9, z: FARM_CZ + (Math.random() * 2 - 1) * 9 };
}

export function spawnVisitor() {
    if (visitors.length >= MAX_WITH_BOWL) return null;
    const ang = Math.random() * Math.PI * 2, r = 18; // arrive from the edge
    const x = FARM_CX + Math.cos(ang) * r, z = FARM_CZ + Math.sin(ang) * r;
    const grp = buildCat(CAT_COLORS[Math.floor(Math.random() * CAT_COLORS.length)]);
    grp.position.set(x, 0.02, z);
    const t = wanderTarget();
    const ttl = foodBowl ? 80 + Math.random() * 60 : 30 + Math.random() * 45; // cats linger at the bowl
    const v = { grp, x, z, tx: t.x, tz: t.z, ttl, bob: Math.random() * 6 };
    visitors.push(v);
    return v;
}

export function updateVisitors(dt) {
    const every = foodBowl ? 12 : SPAWN_EVERY;       // food out → cats arrive faster
    const cap = foodBowl ? MAX_WITH_BOWL : MAX_VISITORS; // …and more of them
    timer -= dt;
    if (timer <= 0) { timer = every + Math.random() * (every * 0.5); if (visitors.length < cap) spawnVisitor(); }
    for (let i = visitors.length - 1; i >= 0; i--) {
        const v = visitors[i];
        v.ttl -= dt;
        const dx = v.tx - v.x, dz = v.tz - v.z, d = Math.hypot(dx, dz);
        if (d > 0.25) {
            const s = Math.min(d, 1.6 * dt);
            v.x += (dx / d) * s; v.z += (dz / d) * s;
            v.grp.rotation.y = Math.atan2(dx, dz);
        } else { // reached a spot → pick a new place to pad to (toward the bowl if any)
            const t = wanderTarget(); v.tx = t.x; v.tz = t.z;
        }
        v.bob += dt;
        v.grp.position.set(v.x, 0.02 + Math.abs(Math.sin(v.bob * 6)) * 0.03, v.z);
        if (v.ttl <= 0) { disposeVisitor(v); visitors.splice(i, 1); }
    }
}

export function getVisitorCount() { return visitors.length; }
export function clearVisitors() {
    for (const v of visitors) disposeVisitor(v);
    visitors = []; timer = 20;
    if (foodBowl) { scene.remove(foodBowl); foodBowl.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); foodBowl = null; }
}

export function serializeVisitors() { return { bowl: !!foodBowl }; }
export function loadVisitors(d) { if (d && d.bowl && !foodBowl) placeFoodBowl(); }

// Self-register (#54): cats wander in/out each tick.
registerSystem({ id: 'visitors', update(dt) { updateVisitors(dt); } });
