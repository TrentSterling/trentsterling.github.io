// js/bins.js — placeable Wooden Crates: finite crop bins that harvester employees
// fill and haulers empty into the barn (the harvest→crate→barn→factory loop). Unlike
// the bag, a crate holds a CAPPED amount, so storage finally means something. PERF:
// all crate boxes render as ONE InstancedMesh and all fill-bars as another, rebuilt
// only when a crate is placed or its level changes (rebuild-on-dirty, #35).
// (Named bins.js to avoid clashing with crates.js, the delivery-truck crates.)

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { mergeGroupGeo, mergedMat } from './meshmerge.js';

export const CRATE_CAP = 50;        // crops per crate

let bins = [];                       // { x, z, items: {id:qty}, total }
let _boxGeo = null, _boxIM = null, _fillIM = null, _dirty = false;
const _fillMat = curvedMaterial({ color: 0x86c452 }); // green "crops" fill
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _YUP = new THREE.Vector3(0, 1, 0);

// An open-topped wooden crate (base + 4 walls), merged to one vertex-coloured geo.
function boxGeo() {
    if (_boxGeo) return _boxGeo;
    const g = new THREE.Group();
    const wood = 0x9c6b3a, wood2 = 0x855a2e;
    const add = (geo, c, x, y, z) => { const m = new THREE.Mesh(geo, curvedMaterial({ color: c })); m.position.set(x, y, z); g.add(m); };
    add(new THREE.BoxGeometry(0.52, 0.06, 0.52), wood2, 0, 0.03, 0);          // base
    add(new THREE.BoxGeometry(0.52, 0.32, 0.05), wood, 0, 0.2, 0.235);        // front
    add(new THREE.BoxGeometry(0.52, 0.32, 0.05), wood, 0, 0.2, -0.235);       // back
    add(new THREE.BoxGeometry(0.05, 0.32, 0.52), wood, 0.235, 0.2, 0);        // right
    add(new THREE.BoxGeometry(0.05, 0.32, 0.52), wood, -0.235, 0.2, 0);       // left
    _boxGeo = mergeGroupGeo(g);
    return _boxGeo;
}

function rebuildBinIMs() {
    _dirty = false;
    if (_boxIM) { scene.remove(_boxIM); _boxIM.dispose(); _boxIM = null; }
    if (_fillIM) { scene.remove(_fillIM); _fillIM.dispose(); _fillIM = null; }
    if (!bins.length) return;

    const im = new THREE.InstancedMesh(boxGeo(), mergedMat, bins.length);
    bins.forEach((b, i) => { _p.set(b.x, 0.02, b.z); _q.identity(); _s.set(1, 1, 1); im.setMatrixAt(i, _m4.compose(_p, _q, _s)); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    scene.add(im); _boxIM = im;

    // Fill bars: a green cube per crate, Y-scaled by how full it is.
    const fim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 1, 0.4), _fillMat, bins.length);
    bins.forEach((b, i) => {
        const h = Math.max(0.001, (b.total / CRATE_CAP) * 0.28);
        _p.set(b.x, 0.06 + h / 2, b.z); _q.identity(); _s.set(1, h, 1);
        fim.setMatrixAt(i, _m4.compose(_p, _q, _s));
    });
    fim.instanceMatrix.needsUpdate = true; fim.computeBoundingSphere();
    scene.add(fim); _fillIM = fim;
}

export function updateBins() { if (_dirty) rebuildBinIMs(); }

export function placeBin(x, z) { bins.push({ x, z, items: {}, total: 0 }); _dirty = true; return true; }

// Nearest crate with free space to (x,z) within range, or null.
export function nearestBinWithSpace(x, z, range = 99) {
    let best = null, bd = range * range;
    for (const b of bins) {
        if (b.total >= CRATE_CAP) continue;
        const d = (b.x - x) ** 2 + (b.z - z) ** 2;
        if (d < bd) { bd = d; best = b; }
    }
    return best;
}

// Nearest crate that has something in it (for haulers/collection), or null.
export function nearestFullishBin(x, z, range = 99, minTotal = 1) {
    let best = null, bd = range * range;
    for (const b of bins) {
        if (b.total < minTotal) continue;
        const d = (b.x - x) ** 2 + (b.z - z) ** 2;
        if (d < bd) { bd = d; best = b; }
    }
    return best;
}

// Drop `qty` of `item` into a crate; returns the overflow that didn't fit.
export function depositToBin(bin, item, qty) {
    if (!bin) return qty;
    const space = CRATE_CAP - bin.total;
    const n = Math.min(qty, space);
    if (n <= 0) return qty;
    bin.items[item] = (bin.items[item] || 0) + n;
    bin.total += n;
    _dirty = true;
    return qty - n;
}

// Empty a crate entirely; returns its {id:qty} contents (for the bag/barn).
export function emptyBin(bin) {
    if (!bin || !bin.total) return {};
    const out = bin.items;
    bin.items = {}; bin.total = 0;
    _dirty = true;
    return out;
}

export function getBinCount() { return bins.length; }
export function getBins() { return bins; }

// A fresh crate mesh for the build-mode ghost preview (#36).
export function crateModel() { return new THREE.Mesh(boxGeo(), mergedMat); }

export function serializeBins() { return bins.map(b => ({ x: b.x, z: b.z, items: b.items, total: b.total })); }
export function loadBins(data) {
    if (_boxIM) { scene.remove(_boxIM); _boxIM.dispose(); _boxIM = null; }
    if (_fillIM) { scene.remove(_fillIM); _fillIM.dispose(); _fillIM = null; }
    bins = [];
    if (data) for (const b of data) bins.push({ x: b.x, z: b.z, items: b.items || {}, total: b.total || 0 });
    _dirty = true;
}
