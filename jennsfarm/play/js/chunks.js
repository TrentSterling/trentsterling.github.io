// js/chunks.js — Infinite procedural terrain that streams in chunks around the
// player. The original hand-built area (the farm, buildings, core decor inside
// the 0..48 box) stays as the cosy core; chunks fill the endless wild BEYOND it
// so you can wander forever. Each chunk is fully determined by its coordinates
// (seeded hash noise), so terrain is stable across visits with nothing to save.
//
// Performance-minded: shared geometries, decor batched into a few InstancedMeshes
// per chunk, a small per-frame build budget (no hitching), and far chunks get
// recycled. Only ~a fog-radius of chunks is ever live.

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { terrainHeight, AMP } from './terrain.js';

export const CHUNK = 16;          // tiles per chunk side
const LOAD_RADIUS = 2;            // chunks kept loaded around the player (5x5)
const UNLOAD_RADIUS = 3;          // recycle once a chunk is farther than this
const BUILD_BUDGET = 3;           // chunks built per frame (spread to avoid hitches)
const CORE_MIN = 0, CORE_MAX = 48; // original world box — skip decor here (core owns it)
const GROUND_Y = -0.05;           // just under the core plane (-0.02) so they never z-fight

function noise(x, z, seed) {
    const n = Math.sin(x * 127.1 + z * 311.7 + seed * 43758.5453) * 43758.5453;
    return n - Math.floor(n);
}

export function worldToChunk(v) { return Math.floor(v / CHUNK); }
function ckey(cx, cz) { return cx + ',' + cz; }
function inCore(x, z) { return x >= CORE_MIN && x < CORE_MAX && z >= CORE_MIN && z < CORE_MAX; }
function chunkFullyInCore(cx, cz) {
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    return x0 >= CORE_MIN && x0 + CHUNK <= CORE_MAX && z0 >= CORE_MIN && z0 + CHUNK <= CORE_MAX;
}

// Which chunk coords should be live around (px,pz)?
export function desiredChunks(px, pz, radius = LOAD_RADIUS) {
    const ccx = worldToChunk(px), ccz = worldToChunk(pz);
    const out = [];
    for (let dz = -radius; dz <= radius; dz++)
        for (let dx = -radius; dx <= radius; dx++)
            out.push([ccx + dx, ccz + dz]);
    return out;
}

// --- Shared resources (created once, reused by every chunk) ---
// Ground geometry is per-chunk now (each carries its own heightmap + vertex
// colours); the material and all decor geometries are shared.
let groundMat, trunkGeo, trunkMat, leafGeo, grassGeo, rockGeo, rockMat;
let SHARED_GEO = [];
function ensureGeo() {
    if (groundMat) return;
    groundMat = curvedMaterial({ vertexColors: true });        // colour comes from the heightmap
    trunkGeo = new THREE.CylinderGeometry(0.09, 0.13, 0.7, 5);
    trunkMat = curvedMaterial({ color: 0x6b4a2a });
    leafGeo = new THREE.ConeGeometry(0.55, 1.1, 6);            // simple conifer canopy
    grassGeo = new THREE.ConeGeometry(0.05, 0.26, 4);
    rockGeo = new THREE.DodecahedronGeometry(0.22, 0);
    rockMat = curvedMaterial({ color: 0x8f8f8f });
    SHARED_GEO = [trunkGeo, leafGeo, grassGeo, rockGeo];
}

// A per-chunk ground plane displaced by the heightmap, vertex-painted grass→drier
// on the rises. Vertices are computed in world space (mesh sits at the chunk centre).
const _gc = new THREE.Color();
function makeGroundGeo(cx, cz) {
    const geo = new THREE.PlaneGeometry(CHUNK, CHUNK, CHUNK, CHUNK);
    geo.rotateX(-Math.PI / 2);
    const cxw = cx * CHUNK + CHUNK / 2 - 0.5, czw = cz * CHUNK + CHUNK / 2 - 0.5;
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
        const h = terrainHeight(cxw + pos.getX(i), czw + pos.getZ(i));
        pos.setY(i, h);
        const t = (h / AMP + 1) * 0.5; // 0 (dip) .. 1 (rise)
        _gc.setRGB(0.26 + t * 0.12, 0.48 + t * 0.14, 0.24 + t * 0.06);
        colors[i * 3] = _gc.r; colors[i * 3 + 1] = _gc.g; colors[i * 3 + 2] = _gc.b;
    }
    pos.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
}

const loaded = new Map();   // ckey -> { group|null, cx, cz }
const pending = [];         // [cx,cz] queued to build
let curCX = null, curCZ = null;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _col = new THREE.Color();
const _YUP = new THREE.Vector3(0, 1, 0);

function instanced(geo, mat, list, place) {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((d, i) => place(d, i, mesh));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
}

function buildChunk(cx, cz) {
    const group = new THREE.Group();
    const x0 = cx * CHUNK, z0 = cz * CHUNK;

    const ground = new THREE.Mesh(makeGroundGeo(cx, cz), groundMat);
    ground.position.set(x0 + CHUNK / 2 - 0.5, GROUND_Y, z0 + CHUNK / 2 - 0.5);
    group.add(ground);

    const trees = [], grass = [], rocks = [];
    for (let lz = 0; lz < CHUNK; lz++) {
        for (let lx = 0; lx < CHUNK; lx++) {
            const x = x0 + lx, z = z0 + lz;
            if (inCore(x, z)) continue;                 // the core handles its own decor
            const n = noise(x * 0.7, z * 0.7, 42), n2 = noise(x * 1.3, z * 1.3, 99);
            if (n > 0.80) {
                trees.push({ x: x + (noise(x, z, 7) - 0.5) * 0.5, z: z + (noise(z, x, 8) - 0.5) * 0.5, s: 0.8 + noise(x, z, 9) * 0.7, c: noise(x, z, 10) });
            } else if (n > 0.73 && n2 > 0.55) {
                rocks.push({ x, z, s: 0.6 + noise(x, z, 11) * 0.8 });
            } else {
                const blades = n2 > 0.5 ? 3 : (n2 > 0.25 ? 2 : 1);
                for (let i = 0; i < blades; i++) {
                    grass.push({ x: x + (noise(x + i, z, 70) - 0.5) * 0.85, z: z + (noise(x, z + i, 71) - 0.5) * 0.85, rot: noise(x + i, z + i, 72) * Math.PI, s: 0.7 + noise(x, z + i, 73) * 0.6, shade: noise(x + i, z, 74) });
                }
            }
        }
    }

    if (trees.length) {
        group.add(instanced(trunkGeo, trunkMat, trees, (t, i, mesh) => {
            _p.set(t.x, terrainHeight(t.x, t.z) + 0.35 * t.s, t.z); _q.identity(); _s.set(t.s, t.s, t.s);
            mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
        }));
        group.add(instanced(leafGeo, curvedMaterial({ color: 0xffffff }), trees, (t, i, mesh) => {
            _p.set(t.x, terrainHeight(t.x, t.z) + 0.9 * t.s, t.z); _q.identity(); _s.set(t.s, t.s, t.s);
            mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
            const g = 0.32 + t.c * 0.28;
            mesh.setColorAt(i, _col.setRGB(0.16 + g * 0.2, 0.45 + g * 0.3, 0.18 + g * 0.15));
        }));
    }
    if (grass.length) {
        group.add(instanced(grassGeo, curvedMaterial({ color: 0xffffff }), grass, (g, i, mesh) => {
            _p.set(g.x, terrainHeight(g.x, g.z) + 0.13 * g.s, g.z); _q.setFromAxisAngle(_YUP, g.rot); _s.set(g.s, g.s, g.s);
            mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
            const lvl = 0.6 + g.shade * 0.45;
            mesh.setColorAt(i, _col.setRGB(0.22 * lvl, 0.55 * lvl, 0.24 * lvl));
        }));
    }
    if (rocks.length) {
        group.add(instanced(rockGeo, rockMat, rocks, (r, i, mesh) => {
            _p.set(r.x, terrainHeight(r.x, r.z) + 0.1 * r.s, r.z); _q.setFromAxisAngle(_YUP, noise(r.x, r.z, 12) * 3); _s.set(r.s, r.s, r.s);
            mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
        }));
    }
    return group;
}

function disposeGroup(group) {
    group.children.forEach(c => {
        // per-chunk ground geo is unique → dispose; shared decor geos are kept
        if (c.geometry && !SHARED_GEO.includes(c.geometry)) c.geometry.dispose();
        // leaf/grass materials are per-chunk (instanceColor variants); ground/trunk/rock are shared
        if (c.material && c.material !== groundMat && c.material !== trunkMat && c.material !== rockMat) c.material.dispose();
    });
}

// Stream chunks around the player. Call every frame; cheap unless a boundary is
// crossed, and it only builds a few chunks per call so it never hitches.
export function updateChunks(px, pz) {
    ensureGeo();
    const cx = worldToChunk(px), cz = worldToChunk(pz);
    const first = curCX === null;
    if (first || cx !== curCX || cz !== curCZ) {
        curCX = cx; curCZ = cz;
        for (const [dcx, dcz] of desiredChunks(px, pz)) {
            const k = ckey(dcx, dcz);
            if (loaded.has(k)) continue;
            if (chunkFullyInCore(dcx, dcz)) { loaded.set(k, { group: null, cx: dcx, cz: dcz }); continue; }
            if (!pending.some(p => p[0] === dcx && p[1] === dcz)) pending.push([dcx, dcz]);
        }
        for (const [k, c] of loaded) {
            if (Math.max(Math.abs(c.cx - cx), Math.abs(c.cz - cz)) > UNLOAD_RADIUS) {
                if (c.group) { scene.remove(c.group); disposeGroup(c.group); }
                loaded.delete(k);
            }
        }
        for (let i = pending.length - 1; i >= 0; i--)
            if (Math.max(Math.abs(pending[i][0] - cx), Math.abs(pending[i][1] - cz)) > UNLOAD_RADIUS) pending.splice(i, 1);
    }
    let budget = first ? 999 : BUILD_BUDGET; // populate the whole first ring at once
    while (pending.length && budget-- > 0) {
        const [bcx, bcz] = pending.shift();
        const k = ckey(bcx, bcz);
        if (loaded.has(k)) continue;
        const group = buildChunk(bcx, bcz);
        scene.add(group);
        loaded.set(k, { group, cx: bcx, cz: bcz });
    }
}

export function getLoadedChunkCount() {
    let n = 0;
    for (const c of loaded.values()) if (c.group) n++;
    return n;
}

export function resetChunks() {
    for (const c of loaded.values()) if (c.group) { scene.remove(c.group); disposeGroup(c.group); }
    loaded.clear();
    pending.length = 0;
    curCX = curCZ = null;
}
