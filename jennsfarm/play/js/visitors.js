// js/visitors.js — stray critters that wander onto the farm now and then, mill
// about, then mosey off (#54). Not just cats: skunks (wifey's favourite), rabbits,
// ducks and possums all drop by — and a food bowl draws MORE of them, faster.
// Pure ambient charm — "many animals show up lol". Self-registering system (one
// import in main, no other wiring).

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { registerSystem } from './registry.js';
import { beautyScore } from './decor.js';

const FARM_CX = 24, FARM_CZ = 24;
const MAX_VISITORS = 4;
const MAX_WITH_BOWL = 7;
const ABS_MAX = 14;          // hard ceiling so a gorgeous farm still can't tank perf
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

// --- A variety of critters drop by, not just cats (#54: "many animals show up lol") ---
function box(w, h, d, color) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), curvedMaterial({ color })); }
function addLegs(g, color) {
    for (const lx of [-0.07, 0.07]) for (const lz of [-0.1, 0.1]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 5), curvedMaterial({ color }));
        l.position.set(lx, 0.07, lz); g.add(l);
    }
}

function buildSkunk() { // wifey loves skunks — a frequent, welcome guest
    const g = new THREE.Group(); const black = 0x17171a, white = 0xf2f2ea;
    const body = box(0.22, 0.15, 0.34, black); body.position.y = 0.14; g.add(body);
    const stripe = box(0.07, 0.16, 0.34, white); stripe.position.y = 0.165; g.add(stripe);
    const head = box(0.15, 0.13, 0.14, black); head.position.set(0, 0.2, 0.22); g.add(head);
    const snout = box(0.05, 0.05, 0.07, white); snout.position.set(0, 0.19, 0.3); g.add(snout);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.04, 0.32, 6), curvedMaterial({ color: white }));
    tail.position.set(0, 0.3, -0.2); tail.rotation.x = -0.7; g.add(tail);
    addLegs(g, black); scene.add(g); return g;
}

function buildRabbit() {
    const g = new THREE.Group(); const c = Math.random() < 0.5 ? 0xf0ece4 : 0x9c7b58;
    const body = box(0.2, 0.18, 0.26, c); body.position.y = 0.15; g.add(body);
    const head = box(0.15, 0.15, 0.14, c); head.position.set(0, 0.26, 0.16); g.add(head);
    for (const ex of [-0.04, 0.04]) { const ear = box(0.04, 0.16, 0.05, c); ear.position.set(ex, 0.4, 0.14); g.add(ear); }
    const tail = box(0.08, 0.08, 0.08, 0xffffff); tail.position.set(0, 0.16, -0.16); g.add(tail);
    addLegs(g, c); scene.add(g); return g;
}

function buildDuck() {
    const g = new THREE.Group(); const c = 0xf2d23a;
    const body = box(0.2, 0.16, 0.3, c); body.position.y = 0.13; g.add(body);
    const head = box(0.14, 0.14, 0.14, c); head.position.set(0, 0.27, 0.16); g.add(head);
    const beak = box(0.08, 0.05, 0.1, 0xe88a2a); beak.position.set(0, 0.25, 0.26); g.add(beak);
    const tail = box(0.1, 0.08, 0.08, c); tail.position.set(0, 0.16, -0.18); tail.rotation.x = 0.4; g.add(tail);
    for (const lx of [-0.05, 0.05]) { const f = box(0.06, 0.04, 0.1, 0xe88a2a); f.position.set(lx, 0.03, 0.02); g.add(f); }
    scene.add(g); return g;
}

function buildPossum() {
    const g = new THREE.Group(); const c = 0xb9b6ad;
    const body = box(0.22, 0.15, 0.32, c); body.position.y = 0.14; g.add(body);
    const head = box(0.14, 0.13, 0.16, 0xe8e4da); head.position.set(0, 0.19, 0.22); g.add(head);
    const nose = box(0.04, 0.04, 0.06, 0xd98ca0); nose.position.set(0, 0.17, 0.31); g.add(nose);
    for (const ex of [-0.05, 0.05]) { const ear = box(0.05, 0.05, 0.02, 0x6b6660); ear.position.set(ex, 0.27, 0.2); g.add(ear); }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 5), curvedMaterial({ color: 0xd9b3a0 }));
    tail.position.set(0, 0.12, -0.24); tail.rotation.x = 1.0; g.add(tail);
    addLegs(g, c); scene.add(g); return g;
}

// Weighted pick — cats lead, skunks are a beloved-and-frequent guest, rest sprinkle in.
export function pickVisitorSpecies(roll = Math.random()) {
    const r = (((roll % 1) + 1) % 1);
    if (r < 0.40) return 'cat';
    if (r < 0.62) return 'skunk';   // wifey asked for skunks everywhere — oblige
    if (r < 0.80) return 'rabbit';
    if (r < 0.92) return 'duck';
    return 'possum';
}

function buildVisitor(species) {
    switch (species) {
        case 'skunk':  return buildSkunk();
        case 'rabbit': return buildRabbit();
        case 'duck':   return buildDuck();
        case 'possum': return buildPossum();
        default:       return buildCat(CAT_COLORS[Math.floor(Math.random() * CAT_COLORS.length)]);
    }
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

// Current visitor cap: base (bowl raises it) + a bonus from farm beauty, capped.
export function visitorCap() {
    const base = foodBowl ? MAX_WITH_BOWL : MAX_VISITORS;
    return Math.min(base + Math.floor(beautyScore() / 6), ABS_MAX);
}

// Seconds between arrivals: bowl shortens it, beauty shortens it further (floor 6s).
function spawnInterval() {
    const base = foodBowl ? 12 : SPAWN_EVERY;
    return Math.max(6, base - beautyScore() * 0.6);
}

export function spawnVisitor() {
    if (visitors.length >= ABS_MAX) return null;
    const ang = Math.random() * Math.PI * 2, r = 18; // arrive from the edge
    const x = FARM_CX + Math.cos(ang) * r, z = FARM_CZ + Math.sin(ang) * r;
    const species = pickVisitorSpecies();
    const grp = buildVisitor(species);
    grp.position.set(x, 0.02, z);
    const t = wanderTarget();
    // critters linger at the bowl; a prettier farm makes everyone stay longer
    const ttl = (foodBowl ? 80 + Math.random() * 60 : 30 + Math.random() * 45) + Math.min(beautyScore(), 40);
    const v = { grp, species, x, z, tx: t.x, tz: t.z, ttl, bob: Math.random() * 6 };
    visitors.push(v);
    return v;
}

export function updateVisitors(dt) {
    const every = spawnInterval();   // food + beauty → arrive faster
    const cap = visitorCap();        // food + beauty → more of them
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
