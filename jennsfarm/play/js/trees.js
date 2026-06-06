// js/trees.js - Choppable trees. Trees are scenery you can fell with the Axe for
// wood. Each tree has HP (takes a few swings), drops wood when felled, leaves a
// stump, and regrows after a while so lumber is renewable. State persists in saves.

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';

const TREE_HP = 3;          // axe swings to fell
const REGROW_TIME = 75;     // seconds for a stump to grow back
const FRUIT_ITEM = 'apple'; // what fruit trees drop (sells for ~$1)
const FRUIT_INTERVAL = 38;  // seconds between fruit drops per fruit tree
const FRUIT_CAP = 40;       // max fruit on the ground at once
const FRUIT_OFFLINE_CAP = 8; // max fruit credited per tree while away

// key "x,z" -> tree entity
const trees = new Map();
// trees needing per-frame updates (shaking or regrowing) - keeps the loop cheap
const active = new Set();
// foliage meshes mid-topple after being felled - { mesh, t, dur, dir }
const fallers = [];
// fruit-bearing trees (subset) and fruit currently on the ground
const fruitTrees = [];
const fruitDrops = []; // { mesh, x, z, t, tree }

function key(x, z) { return `${x},${z}`; }

function noise(x, y, seed) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 43758.5453) * 43758.5453;
    return n - Math.floor(n);
}

// --- Mesh builders ---

// One shared material for every tree — colour comes from baked vertex colours, so
// all trees can share it (no per-tree material). vertexColors lets one mesh carry
// brown trunk + green canopy + red apples.
const treeMat = curvedMaterial({ vertexColors: true });
const _mc = new THREE.Color();

// Merge several positioned, single-colour geometries into ONE BufferGeometry with
// baked per-vertex colour. Lets a whole tree render as a single draw call (#35) —
// trees were 3-6 separate meshes each, which dominated the draw count.
function mergeColored(parts) {
    const expanded = parts.map(p => {
        const g = p.geo.clone();
        g.translate(p.pos[0], p.pos[1], p.pos[2]);
        return { g: g.index ? g.toNonIndexed() : g, color: _mc.set(p.color).clone() };
    });
    let total = 0;
    for (const e of expanded) total += e.g.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let o = 0;
    for (const e of expanded) {
        const ep = e.g.attributes.position, en = e.g.attributes.normal, c = e.color;
        for (let i = 0; i < ep.count; i++) {
            const j = (o + i) * 3;
            pos[j] = ep.getX(i); pos[j + 1] = ep.getY(i); pos[j + 2] = ep.getZ(i);
            if (en) { nor[j] = en.getX(i); nor[j + 1] = en.getY(i); nor[j + 2] = en.getZ(i); }
            col[j] = c.r; col[j + 1] = c.g; col[j + 2] = c.b;
        }
        o += ep.count;
        e.g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
}

// Build ONE merged tree geometry (trunk + canopy [+ apples]) at a canonical
// height. Per-tree size/rotation come from the instance matrix, not the geometry,
// so every tree can share these two geometries via InstancedMesh.
function buildTreeGeo(isFruit) {
    const height = 0.95;
    const fColor = (52 << 16) | (140 << 8) | 48; // one natural green for all trees
    const parts = [
        { geo: new THREE.CylinderGeometry(0.06, 0.1, height, 6), color: 0x8B5A2B, pos: [0, height / 2, 0] },
        { geo: new THREE.SphereGeometry(0.5, 6, 5), color: fColor, pos: [0, height + 0.3, 0] },
        { geo: new THREE.SphereGeometry(0.3, 5, 4), color: fColor, pos: [0.12, height + 0.55, 0.08] },
    ];
    if (isFruit) {
        for (const s of [[0.22, height + 0.25, 0.1], [-0.18, height + 0.4, -0.12], [0.05, height + 0.55, -0.2]])
            parts.push({ geo: new THREE.SphereGeometry(0.07, 5, 4), color: 0xe23b3b, pos: s });
    }
    return mergeColored(parts);
}

// --- Instanced tree rendering (#35) ---
// All live (non-stump) trees draw as just TWO InstancedMeshes (plain + fruit)
// instead of one mesh each — ~400 tree draws collapse to ~2. A tree being felled
// pops out a temporary individual mesh to topple; shake updates one instance.
let plainGeo = null, fruitGeo = null, plainIM = null, fruitIM = null, imDirty = true;
const _te = new THREE.Euler(), _tq = new THREE.Quaternion(), _tp = new THREE.Vector3(), _ts = new THREE.Vector3(), _tm = new THREE.Matrix4();

function composeTree(t, shakeZ) {
    _te.set(0, t.rotY || 0, shakeZ || 0);
    _tq.setFromEuler(_te);
    _tp.set(t.x + t.ox, 0, t.z + t.oz);
    _ts.setScalar(t.scale || 1);
    return _tm.compose(_tp, _tq, _ts);
}

function makeIM(geo, list) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, treeMat, list.length);
    list.forEach((t, i) => { t._im = im; t._idx = i; im.setMatrixAt(i, composeTree(t, 0)); });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    scene.add(im);
    return im;
}

function rebuildTreeIMs() {
    if (!plainGeo) { plainGeo = buildTreeGeo(false); fruitGeo = buildTreeGeo(true); }
    if (plainIM) { scene.remove(plainIM); plainIM.dispose(); }
    if (fruitIM) { scene.remove(fruitIM); fruitIM.dispose(); }
    const plain = [], fruit = [];
    for (const t of trees.values()) { if (t.isStump) continue; (t.fruit ? fruit : plain).push(t); }
    plainIM = makeIM(plainGeo, plain);
    fruitIM = makeIM(fruitGeo, fruit);
    imDirty = false;
}

// A standalone tree mesh (shares the geometry + material) for the topple animation.
function buildFallingTree(tree) {
    if (!plainGeo) { plainGeo = buildTreeGeo(false); fruitGeo = buildTreeGeo(true); }
    const m = new THREE.Mesh(tree.fruit ? fruitGeo : plainGeo, treeMat);
    m.position.set(tree.x + tree.ox, 0, tree.z + tree.oz);
    m.scale.setScalar(tree.scale || 1);
    m.rotation.y = tree.rotY || 0;
    scene.add(m);
    return m;
}

function buildFruit(x, z) {
    const g = new THREE.Group();
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 6), curvedMaterial({ color: 0xe23b3b }));
    apple.position.y = 0.12;
    g.add(apple);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), curvedMaterial({ color: 0x4a9c3f }));
    leaf.position.set(0.05, 0.2, 0);
    g.add(leaf);
    g.position.set(x, 0.05, z);
    return g;
}

function buildStump(x, z) {
    const group = new THREE.Group();
    // Short cut trunk
    const stumpGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.18, 6);
    const stumpMat = curvedMaterial({ color: 0x6e4a26 });
    const stump = new THREE.Mesh(stumpGeo, stumpMat);
    stump.position.y = 0.09;
    group.add(stump);
    // Pale cut top
    const topGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.03, 6);
    const topMat = curvedMaterial({ color: 0xc8a86e });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 0.19;
    group.add(top);
    return group;
}

function disposeMesh(mesh) {
    if (!mesh) return;
    scene.remove(mesh);
    mesh.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        // free per-instance materials, but NEVER the shared tree material
        if (c.material && c.material !== treeMat) c.material.dispose();
    });
}

// --- Public: world generation registers trees here ---

export function addTree(x, z) {
    const ox = (noise(x, z, 53) - 0.5) * 0.3;
    const oz = (noise(x, z, 54) - 0.5) * 0.3;
    const isFruit = noise(x, z, 80) > 0.5; // ~half the trees bear fruit

    const tree = {
        x, z, ox, oz,
        scale: 0.8 + noise(x, z, 50) * 0.55,  // per-tree size (was canopy height) — via instance matrix
        rotY: noise(x, z, 55) * Math.PI * 2,  // a little rotational variety
        _im: null, _idx: -1,                   // which InstancedMesh + slot (assigned on rebuild)
        stumpMesh: null,
        hp: TREE_HP,
        maxHp: TREE_HP,
        isStump: false,
        regrow: 0,
        shake: 0,
        fruit: isFruit,
        fruitTimer: FRUIT_INTERVAL * (0.5 + noise(x, z, 81)), // staggered first drop
        hasFruitDrop: false,
    };
    trees.set(key(x, z), tree);
    if (isFruit) fruitTrees.push(tree);
    imDirty = true; // a new tree needs to join the instanced meshes
}

// --- Chopping ---

// Find the nearest live (non-stump) tree to a clicked tile, searching a small
// neighborhood so imperfect clicks still connect.
function findLiveTreeNear(tx, tz) {
    let best = null;
    let bestDist = Infinity;
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            const t = trees.get(key(tx + dx, tz + dz));
            if (!t || t.isStump) continue;
            const d = Math.abs(dx) + Math.abs(dz);
            if (d < bestDist) { bestDist = d; best = t; }
        }
    }
    return best;
}

/** Is there a live (choppable) tree at/near this tile? For hover highlighting. */
export function hasTreeNear(x, z) { return !!findLiveTreeNear(x, z); }

/** Does a live tree occupy this exact tile? For movement collision. */
export function isBlockingTreeAt(x, z) {
    const t = trees.get(key(Math.round(x), Math.round(z)));
    return !!(t && !t.isStump);
}

function rollDrops() {
    const drops = {};
    drops.wood = 2 + Math.floor(Math.random() * 3); // 2-4 wood
    return drops;
}

function fell(tree, regrowTime, animate = false) {
    // Place the stump immediately at the base...
    const stump = buildStump(tree.x, tree.z);
    stump.position.set(tree.x + tree.ox, 0, tree.z + tree.oz);
    scene.add(stump);

    // On a live chop, pop a standalone tree mesh out of the instanced batch and
    // topple it. (On load there's nothing to topple — the instance just vanishes
    // when the meshes rebuild without this stump'd tree.)
    if (animate) {
        const faller = buildFallingTree(tree);
        fallers.push({ mesh: faller, t: 0, dur: 0.6, dir: Math.random() < 0.5 ? 1 : -1, temp: true });
    }

    tree.stumpMesh = stump;
    tree.isStump = true;
    tree.hp = 0;
    tree.shake = 0;
    tree.regrow = regrowTime;
    active.add(tree);
    imDirty = true; // tree leaves the instanced batch
}

function regrowTree(tree) {
    if (tree.stumpMesh) { disposeMesh(tree.stumpMesh); tree.stumpMesh = null; }
    tree.isStump = false;
    tree.hp = tree.maxHp;
    tree.regrow = 0;
    active.delete(tree);
    imDirty = true; // tree rejoins the instanced batch
}

/**
 * Chop near tile (tx, tz). One axe swing.
 * Returns null if no choppable tree there, else:
 *   { felled: true, drops: {wood: n} }  when the tree comes down
 *   { felled: false, hp: n }            on a non-final hit
 */
// Permanently remove every tree whose tile satisfies test(x,z) — used to clear
// trees off land the farm has expanded over (no trees on tilled ground).
export function removeTreesInside(test) {
    let changed = false;
    for (const [k, t] of trees) {
        if (test(t.x, t.z)) {
            if (t.stumpMesh) disposeMesh(t.stumpMesh);
            active.delete(t);
            trees.delete(k);
            changed = true;
        }
    }
    for (let i = fruitTrees.length - 1; i >= 0; i--) if (test(fruitTrees[i].x, fruitTrees[i].z)) fruitTrees.splice(i, 1);
    // also clear any apples already on the ground over the removed land (no orphaned meshes)
    for (let i = fruitDrops.length - 1; i >= 0; i--) if (test(fruitDrops[i].x, fruitDrops[i].z)) { disposeMesh(fruitDrops[i].mesh); fruitDrops.splice(i, 1); }
    if (changed) imDirty = true; // rebuild the instanced batches without the cleared trees
}

export function chopTree(tx, tz) {
    const tree = findLiveTreeNear(tx, tz);
    if (!tree) return null;

    tree.hp -= 1;
    tree.shake = 0.3;
    active.add(tree);

    // world position of the tree (with its in-tile offset) - handy for hit/fell FX
    const at = { x: tree.x, z: tree.z, worldX: tree.x + tree.ox, worldZ: tree.z + tree.oz };

    if (tree.hp <= 0) {
        fell(tree, REGROW_TIME, true); // animate the topple on a live chop
        return { felled: true, drops: rollDrops(), ...at };
    }
    return { felled: false, hp: tree.hp, ...at };
}

// --- Per-frame update: shake on hit, regrow stumps over time ---

export function updateTrees(dt, playerPos, onCollectFruit) {
    const now = performance.now();

    if (imDirty) rebuildTreeIMs(); // a tree was added/felled/regrown — rebuild the batches

    // Fruit trees periodically drop a fruit at their base
    for (const tree of fruitTrees) {
        if (tree.isStump) continue;
        tree.fruitTimer -= dt;
        if (tree.fruitTimer <= 0) {
            tree.fruitTimer = FRUIT_INTERVAL * (0.8 + Math.random() * 0.5);
            if (!tree.hasFruitDrop && fruitDrops.length < FRUIT_CAP) {
                const fx = tree.x + tree.ox + (Math.random() - 0.5) * 0.4;
                const fz = tree.z + tree.oz + (Math.random() - 0.5) * 0.4;
                const mesh = buildFruit(fx, fz);
                scene.add(mesh);
                fruitDrops.push({ mesh, x: fx, z: fz, t: Math.random() * 6, tree });
                tree.hasFruitDrop = true;
            }
        }
    }

    // Fruit on the ground: bob, and collect when the player walks near
    for (let i = fruitDrops.length - 1; i >= 0; i--) {
        const d = fruitDrops[i];
        d.t += dt;
        d.mesh.position.y = 0.1 + Math.abs(Math.sin(d.t * 3)) * 0.06;
        d.mesh.rotation.y += dt;
        if (playerPos && Math.hypot(d.x - playerPos.x, d.z - playerPos.z) < 1.3) {
            disposeMesh(d.mesh);
            if (d.tree) d.tree.hasFruitDrop = false;
            fruitDrops.splice(i, 1);
            if (onCollectFruit) onCollectFruit(FRUIT_ITEM, 1);
        }
    }

    // Toppling foliage: tip over, sink, then shrink away
    for (let i = fallers.length - 1; i >= 0; i--) {
        const f = fallers[i];
        f.t += dt;
        const k = Math.min(1, f.t / f.dur);
        f.mesh.rotation.z = f.dir * k * k * 1.5;   // accelerate the fall
        f.mesh.position.y = -k * 0.15;
        if (k > 0.7) f.mesh.scale.setScalar(Math.max(0.01, 1 - (k - 0.7) / 0.3));
        // temp fallers share the canonical geo + treeMat — just unhook, never dispose those
        if (k >= 1) { scene.remove(f.mesh); fallers.splice(i, 1); }
    }

    for (const tree of active) {
        if (!tree.isStump && tree.shake > 0) {
            tree.shake -= dt;
            const sz = tree.shake > 0 ? Math.sin(now * 0.06) * tree.shake * 0.6 : 0;
            if (tree._im && tree._idx >= 0) {
                tree._im.setMatrixAt(tree._idx, composeTree(tree, sz)); // shake one instance
                tree._im.instanceMatrix.needsUpdate = true;
            }
        }
        if (tree.isStump) {
            tree.regrow -= dt;
            if (tree.regrow <= 0) { regrowTree(tree); continue; }
        }
        if (tree.shake <= 0 && !tree.isStump) active.delete(tree);
    }
}

/** Fruit credited while away — a modest windfall ("Grandpa gathered some"),
 *  not the full per-tree haul, so offline can't trivialize the economy. */
export function creditOfflineFruit(seconds) {
    let count = 0;
    for (const tree of fruitTrees) {
        if (tree.isStump) continue;
        count += Math.min(Math.floor(seconds / FRUIT_INTERVAL), FRUIT_OFFLINE_CAP);
    }
    return Math.min(count, 80); // total cap regardless of how many trees exist
}

/** Nearest fruit on the ground to a point, for AFK collecting. */
export function getNearestFruitDrop(x, z) {
    let best = null, bd = Infinity;
    for (const d of fruitDrops) {
        const dd = (d.x - x) ** 2 + (d.z - z) ** 2;
        if (dd < bd) { bd = dd; best = d; }
    }
    return best ? { x: best.x, z: best.z } : null;
}

// --- Save / load ---

export function serializeTrees() {
    const out = [];
    for (const [k, t] of trees) {
        if (t.isStump) out.push({ k, s: 1, r: t.regrow });
        else if (t.hp < t.maxHp) out.push({ k, hp: t.hp });
    }
    return out;
}

export function loadTrees(data) {
    if (!data) return;
    for (const d of data) {
        const t = trees.get(d.k);
        if (!t) continue;
        if (d.s) {
            fell(t, d.r != null ? d.r : REGROW_TIME);
        } else if (d.hp != null) {
            t.hp = d.hp;
        }
    }
}
