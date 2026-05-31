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

function buildFoliage(x, z, isFruit) {
    const group = new THREE.Group();
    const height = 0.6 + noise(x, z, 50) * 0.6;

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.06, 0.1, height, 6);
    const trunkMat = curvedMaterial({ color: 0x8B5A2B });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = height / 2;
    group.add(trunk);

    // Foliage - explicit RGB to guarantee natural greens
    const n1 = noise(x, z, 51);
    const r = 30 + Math.floor(n1 * 45);                 // 30-75
    const g = 110 + Math.floor(noise(x, z, 52) * 70);   // 110-180
    const b = 30 + Math.floor(noise(x, z, 53) * 35);    // 30-65
    const fColor = (r << 16) | (g << 8) | b;
    const fMat = curvedMaterial({ color: fColor });

    const f1 = new THREE.Mesh(new THREE.SphereGeometry(0.4 + noise(x, z, 52) * 0.2, 6, 5), fMat);
    f1.position.y = height + 0.3;
    group.add(f1);

    const f2 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 5, 4), fMat);
    f2.position.set(0.12, height + 0.55, 0.08);
    group.add(f2);

    // Fruit trees show little red apples in the canopy
    if (isFruit) {
        const appleMat = curvedMaterial({ color: 0xe23b3b });
        const spots = [[0.22, height + 0.25, 0.1], [-0.18, height + 0.4, -0.12], [0.05, height + 0.55, -0.2]];
        for (const s of spots) {
            const a = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), appleMat);
            a.position.set(s[0], s[1], s[2]);
            group.add(a);
        }
    }

    return group;
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
        if (c.material) c.material.dispose(); // free materials too (long-idle leak)
    });
}

// --- Public: world generation registers trees here ---

export function addTree(x, z) {
    const ox = (noise(x, z, 53) - 0.5) * 0.3;
    const oz = (noise(x, z, 54) - 0.5) * 0.3;
    const isFruit = noise(x, z, 80) > 0.5; // ~half the trees bear fruit
    const mesh = buildFoliage(x, z, isFruit);
    mesh.position.set(x + ox, 0, z + oz);
    scene.add(mesh);

    const tree = {
        x, z, ox, oz,
        mesh,
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

    // ...and either topple the old foliage (live chop) or just remove it (load).
    if (animate && tree.mesh) {
        fallers.push({ mesh: tree.mesh, t: 0, dur: 0.6, dir: Math.random() < 0.5 ? 1 : -1 });
    } else {
        disposeMesh(tree.mesh);
    }

    tree.mesh = stump;
    tree.isStump = true;
    tree.hp = 0;
    tree.shake = 0;
    tree.regrow = regrowTime;
    active.add(tree);
}

function regrowTree(tree) {
    disposeMesh(tree.mesh);
    const mesh = buildFoliage(tree.x, tree.z, tree.fruit);
    mesh.position.set(tree.x + tree.ox, 0, tree.z + tree.oz);
    scene.add(mesh);
    tree.mesh = mesh;
    tree.isStump = false;
    tree.hp = tree.maxHp;
    tree.regrow = 0;
    active.delete(tree);
}

/**
 * Chop near tile (tx, tz). One axe swing.
 * Returns null if no choppable tree there, else:
 *   { felled: true, drops: {wood: n} }  when the tree comes down
 *   { felled: false, hp: n }            on a non-final hit
 */
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
        if (k >= 1) { disposeMesh(f.mesh); fallers.splice(i, 1); }
    }

    for (const tree of active) {
        if (tree.shake > 0) {
            tree.shake -= dt;
            if (tree.shake <= 0) {
                tree.mesh.rotation.z = 0;
            } else {
                tree.mesh.rotation.z = Math.sin(now * 0.06) * tree.shake * 0.6;
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
