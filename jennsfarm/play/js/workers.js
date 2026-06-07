// js/workers.js — visible farmhand employees (one per hired factory employee).
// They run a real labour loop (#12/#67): walk to a ripe crop → harvest it → carry
// the armful to the nearest Wooden Crate → deposit; if there's no crop or crate they
// fall back to vacuuming loose drops, else amble. Each picks a DISTINCT crop (claimed)
// so they never dogpile, and commits to its task until done (Alice-Greenfingers-ish).
// Self-registering (#9); body is one merged mesh + a tiny "carry" cube (1-2 draws).

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { registerSystem } from './registry.js';
import { getFactories } from './factories.js';
import { getDrops, collectDropNear } from './animals.js';
import { nearestRipeCrop, harvestCrop } from './farm.js';
import { nearestBinWithSpace, depositToBin } from './bins.js';

const FARM_CX = 24, FARM_CZ = 24;
const MAX_WORKERS = 10;     // cap so a giant payroll can't tank perf
const SPEED = 2.4;
const VACUUM_RANGE = 0.75;
const WORK_RANGE = 0.6;     // how close to a crop/crate before acting
const SEARCH_R = 30;        // how far a farmhand looks for crops/crates
const SEP_RADIUS = 0.9;     // boids-lite: workers within this push apart
const SEP_WEIGHT = 1.6;     // how hard separation steers vs. heading for the target

const _wmat = curvedMaterial({ vertexColors: true });
const _carryMat = curvedMaterial({ color: 0x86c452 }); // armful of crops
const _wc = new THREE.Color();
const claimedCrops = new Set(); // "x,z" tiles a harvester is currently walking to
const ckey = (x, z) => x + ',' + z;

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

let workers = []; // { x, z, grp, carryMesh, bob, load, loadItem, task }

function spawnWorker() {
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(workerGeo(), _wmat));
    const carryMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), _carryMat);
    carryMesh.position.y = 0.86; carryMesh.visible = false; // shown while hauling an armful
    grp.add(carryMesh);
    const x = FARM_CX + (Math.random() * 2 - 1) * 6, z = FARM_CZ + (Math.random() * 2 - 1) * 6;
    grp.position.set(x, 0.02, z);
    scene.add(grp);
    workers.push({ x, z, grp, carryMesh, bob: Math.random() * 6, load: 0, loadItem: null, task: null });
}

function releaseClaim(w) { if (w.task && w.task.type === 'crop') claimedCrops.delete(ckey(w.task.x, w.task.z)); }

function despawnWorker() {
    const w = workers.pop();
    if (w) { releaseClaim(w); scene.remove(w.grp); } // geo/materials shared — never dispose
}

export function getWorkerCount() { return workers.length; }

// One farmhand per hired factory employee, capped.
export function desiredWorkers() {
    let emp = 0;
    const f = getFactories();
    for (const t in f) emp += f[t].employees || 0;
    return Math.min(emp, MAX_WORKERS);
}

// Pick the next job for a free farmhand (priority: deliver → harvest → vacuum → amble).
function assignTask(w, ctx) {
    releaseClaim(w); w.task = null;
    // Carrying an armful → take it to the nearest crate with room.
    if (w.load > 0) {
        const bin = nearestBinWithSpace(w.x, w.z, SEARCH_R);
        if (bin) { w.task = { type: 'crate', x: bin.x, z: bin.z, bin }; return; }
        if (ctx && ctx.addItem) ctx.addItem(w.loadItem, w.load); // no crate → dump to bag, don't get stuck
        w.load = 0; w.loadItem = null; w.carryMesh.visible = false;
    }
    // Harvest — only worth it if there's a crate to fill AND an unclaimed ripe crop.
    if (nearestBinWithSpace(w.x, w.z, SEARCH_R)) {
        const crop = nearestRipeCrop(w.x, w.z, SEARCH_R, (tx, tz) => claimedCrops.has(ckey(tx, tz)));
        if (crop) { claimedCrops.add(ckey(crop.x, crop.z)); w.task = { type: 'crop', x: crop.x, z: crop.z }; return; }
    }
    // Tidy up a loose drop.
    const drops = getDrops();
    if (drops.length) {
        let best = null, bd = Infinity;
        for (const d of drops) { const dd = (d.x - w.x) ** 2 + (d.z - w.z) ** 2; if (dd < bd) { bd = dd; best = d; } }
        if (best) { w.task = { type: 'drop', x: best.x, z: best.z }; return; }
    }
    // Nothing to do — amble.
    w.task = { type: 'wander', x: FARM_CX + (Math.random() * 2 - 1) * 7, z: FARM_CZ + (Math.random() * 2 - 1) * 7 };
}

// Act once a farmhand reaches its target; sets up the next task.
function resolveTask(w, ctx) {
    const t = w.task;
    if (t.type === 'crop') {
        const r = harvestCrop(t.x, t.z); // null if already gone
        if (r) { w.load += r.qty; w.loadItem = r.itemId; w.carryMesh.visible = true; }
    } else if (t.type === 'crate') {
        if (w.load > 0 && w.loadItem) {
            const overflow = depositToBin(t.bin, w.loadItem, w.load);
            w.load = overflow;
            if (w.load === 0) { w.loadItem = null; w.carryMesh.visible = false; }
        }
    } else if (t.type === 'drop') {
        const item = collectDropNear(w.x, w.z, VACUUM_RANGE);
        if (item && ctx && ctx.addItem) ctx.addItem(item, 1);
    }
    assignTask(w, ctx); // immediately line up the next job
}

export function updateWorkers(dt, ctx) {
    const want = desiredWorkers();
    while (workers.length < want) spawnWorker();
    while (workers.length > want) despawnWorker();

    for (const w of workers) {
        if (!w.task) assignTask(w, ctx);
        const t = w.task;

        // Steer toward the task with boids-lite separation (spread, no flocking).
        let vx = t.x - w.x, vz = t.z - w.z;
        const d = Math.hypot(vx, vz);
        if (d > 0.001) { vx /= d; vz /= d; }
        let sx = 0, sz = 0;
        for (const o of workers) {
            if (o === w) continue;
            const ox = w.x - o.x, oz = w.z - o.z, od = Math.hypot(ox, oz);
            if (od > 0.0001 && od < SEP_RADIUS) { const f = (SEP_RADIUS - od) / SEP_RADIUS; sx += (ox / od) * f; sz += (oz / od) * f; }
        }
        vx += sx * SEP_WEIGHT; vz += sz * SEP_WEIGHT;
        const vlen = Math.hypot(vx, vz);
        if (vlen > 0.0001) {
            const step = Math.min(SPEED * dt, d > 0.05 ? SPEED * dt : d);
            w.x += (vx / vlen) * step; w.z += (vz / vlen) * step;
            w.grp.rotation.y = Math.atan2(vx, vz);
        }

        // Arrived? Do the job. (Drops have a slightly longer reach so they get vacuumed.)
        const reach = t.type === 'drop' ? VACUUM_RANGE : (t.type === 'wander' ? 0.35 : WORK_RANGE);
        if (d <= reach) {
            if (t.type === 'wander') assignTask(w, ctx); else resolveTask(w, ctx);
        }

        w.bob += dt;
        w.grp.position.set(w.x, 0.02 + Math.abs(Math.sin(w.bob * 7)) * 0.03, w.z);
    }
}

export function clearWorkers() {
    for (const w of workers) scene.remove(w.grp);
    workers = []; claimedCrops.clear();
}

// Self-register: spawn/move/vacuum each tick using the shared ctx.
registerSystem({ id: 'workers', update(dt, ctx) { updateWorkers(dt, ctx); } });
