// js/workers.js — visible "vacuum dudes": one little farmhand per hired factory
// employee, wandering the farm and sucking up loose drops (eggs/milk/fruit) into
// your bag. Makes the abstract employee count ALIVE and keeps the ground tidy.
// Self-registering (#9); each worker is a single merged mesh (1 draw, capped).

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { registerSystem } from './registry.js';
import { getFactories } from './factories.js';
import { getNearestDrop, collectDropNear } from './animals.js';

const FARM_CX = 24, FARM_CZ = 24;
const MAX_WORKERS = 10;     // cap so a giant payroll can't tank perf
const SPEED = 2.4;
const VACUUM_RANGE = 0.75;

const _wmat = curvedMaterial({ vertexColors: true });
const _wc = new THREE.Color();

// Merge positioned, single-colour parts into one vertex-coloured geometry (1 draw).
function mergeParts(parts) {
    const baked = parts.map(p => {
        const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
        g.translate(p.pos[0], p.pos[1], p.pos[2]);
        return { g, c: _wc.set(p.color).clone() };
    });
    let total = 0; for (const e of baked) total += e.g.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let o = 0;
    for (const e of baked) {
        const p = e.g.attributes.position, nn = e.g.attributes.normal;
        for (let i = 0; i < p.count; i++) {
            const j = (o + i) * 3;
            pos[j] = p.getX(i); pos[j + 1] = p.getY(i); pos[j + 2] = p.getZ(i);
            if (nn) { nor[j] = nn.getX(i); nor[j + 1] = nn.getY(i); nor[j + 2] = nn.getZ(i); }
            col[j] = e.c.r; col[j + 1] = e.c.g; col[j + 2] = e.c.b;
        }
        o += p.count; e.g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
}

let _workerGeo = null;
function workerGeo() {
    if (_workerGeo) return _workerGeo;
    _workerGeo = mergeParts([
        { geo: new THREE.BoxGeometry(0.22, 0.2, 0.18), color: 0x35509a, pos: [0, 0.12, 0] },        // legs/overalls
        { geo: new THREE.BoxGeometry(0.26, 0.28, 0.2), color: 0x4a72e0, pos: [0, 0.34, 0] },         // body
        { geo: new THREE.SphereGeometry(0.12, 8, 6), color: 0xf0c49a, pos: [0, 0.56, 0] },           // head
        { geo: new THREE.CylinderGeometry(0.14, 0.14, 0.05, 8), color: 0xd23b3b, pos: [0, 0.65, 0] },// cap brim
        { geo: new THREE.CylinderGeometry(0.1, 0.11, 0.08, 8), color: 0xd23b3b, pos: [0, 0.7, 0] },  // cap top
        { geo: new THREE.CylinderGeometry(0.05, 0.07, 0.26, 8), color: 0x9a9ea4, pos: [0, 0.22, 0.22] }, // vacuum nozzle
    ]);
    return _workerGeo;
}

let workers = []; // { x, z, tx, tz, grp, bob, idle }

function spawnWorker() {
    const g = new THREE.Mesh(workerGeo(), _wmat);
    const x = FARM_CX + (Math.random() * 2 - 1) * 6, z = FARM_CZ + (Math.random() * 2 - 1) * 6;
    g.position.set(x, 0.02, z);
    scene.add(g);
    workers.push({ x, z, tx: x, tz: z, grp: g, bob: Math.random() * 6, idle: 0 });
}
function despawnWorker() {
    const w = workers.pop();
    if (w) scene.remove(w.grp); // geometry + material are shared — never dispose them
}

export function getWorkerCount() { return workers.length; }

// One vacuum dude per hired factory employee, capped.
export function desiredWorkers() {
    let emp = 0;
    const f = getFactories();
    for (const t in f) emp += f[t].employees || 0;
    return Math.min(emp, MAX_WORKERS);
}

export function updateWorkers(dt, ctx) {
    const want = desiredWorkers();
    while (workers.length < want) spawnWorker();
    while (workers.length > want) despawnWorker();

    for (const w of workers) {
        const drop = getNearestDrop(w.x, w.z); // head for the nearest loose item, else amble
        if (drop) { w.tx = drop.x; w.tz = drop.z; }
        else { w.idle -= dt; if (w.idle <= 0) { w.tx = FARM_CX + (Math.random() * 2 - 1) * 7; w.tz = FARM_CZ + (Math.random() * 2 - 1) * 7; w.idle = 1 + Math.random() * 2; } }

        const dx = w.tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz);
        if (d > 0.05) { const s = Math.min(d, SPEED * dt); w.x += (dx / d) * s; w.z += (dz / d) * s; w.grp.rotation.y = Math.atan2(dx, dz); }

        const item = collectDropNear(w.x, w.z, VACUUM_RANGE); // suck it up
        if (item && ctx && ctx.addItem) { ctx.addItem(item, 1); if (ctx.refreshUI) ctx.refreshUI(); }

        w.bob += dt;
        w.grp.position.set(w.x, 0.02 + Math.abs(Math.sin(w.bob * 7)) * 0.03, w.z);
    }
}

export function clearWorkers() { for (const w of workers) scene.remove(w.grp); workers = []; }

// Self-register: spawn/move/vacuum each tick using the shared ctx.
registerSystem({ id: 'workers', update(dt, ctx) { updateWorkers(dt, ctx); } });
