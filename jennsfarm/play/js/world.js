import * as THREE from 'three';
import { scene, curvedMaterial, applyCurvature } from './renderer.js';
import { createGrassTexture, createSoilTexture, createPathTexture, createWaterTexture, createBuildingTexture, createBarnTexture } from './textures.js';
import { addTree, removeTreesInside } from './trees.js';
import { mergedMesh, freezeStatic } from './meshmerge.js';

export const WORLD_SIZE = 48;
const FARM_CX = 24;
const FARM_CZ = 24;

// Farm expansion: level → half-size of farm area
// Level 1: 8x8, Level 2: 14x14, Level 3: 20x20, etc.
let farmLevel = 1;
export const EXPANSION_COSTS = [0, 200, 500, 1000, 2000, 4000, 8000];

export function getFarmLevel() { return farmLevel; }
export function getNextExpansionCost() {
    return farmLevel < EXPANSION_COSTS.length ? EXPANSION_COSTS[farmLevel] : null;
}

function getFarmHalfSize() { return 4 + (farmLevel - 1) * 3; }

export function isInFarm(x, z) {
    const hs = getFarmHalfSize();
    return x >= FARM_CX - hs && x < FARM_CX + hs &&
           z >= FARM_CZ - hs && z < FARM_CZ + hs;
}

// Tile types
export const TILE = {
    GRASS: 'grass',
    SOIL: 'soil',
    PLANTED: 'planted',
    PATH: 'path',
    WATER: 'water',
    SHOP: 'shop',
    MARKET: 'market',
    BARN: 'barn',
    HOUSE: 'house',
};

// Sparse tile storage - only farm area + special tiles
const farmTiles = new Map();
// Tile overlays (soil/path/water/building pads) render as ONE InstancedMesh per
// type — a big tilled farm was hundreds of individual tile meshes (#35). Rebuilt
// only when a tile changes type (till/build), coalesced to once per frame.
let _overlayIM = {};       // type -> InstancedMesh of all tiles of that type
const _overlayMat = {};    // type -> shared material (cached)
let _overlayDirty = true;
const _ovM4 = new THREE.Matrix4();

function tileKey(x, z) { return `${x},${z}`; }

function noise(x, y, seed) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 43758.5453) * 43758.5453;
    return n - Math.floor(n);
}

// --- Textures ---

let textures = {};
let sharedTileGeo;

function initTextures() {
    textures = {
        grass: createGrassTexture(),
        soil: createSoilTexture(),
        path: createPathTexture(),
        water: createWaterTexture(),
        shop: createBuildingTexture('shop'),
        market: createBuildingTexture('market'),
        barn: createBarnTexture(),
    };
}

function materialForTile(type) {
    const map = {
        [TILE.SOIL]: textures.soil,
        [TILE.PLANTED]: textures.soil,
        [TILE.PATH]: textures.path,
        [TILE.WATER]: textures.water,
        [TILE.SHOP]: textures.shop,
        [TILE.MARKET]: textures.market,
        [TILE.BARN]: textures.barn,
        [TILE.HOUSE]: textures.barn,
    };
    return curvedMaterial({ map: map[type] || textures.grass });
}

// --- Ground plane (covers entire world, grass textured) ---

function createGroundPlane() {
    const grassTex = createGrassTexture();
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(WORLD_SIZE, WORLD_SIZE);

    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, WORLD_SIZE * 2, WORLD_SIZE * 2);
    geo.rotateX(-Math.PI / 2);
    const mat = curvedMaterial({ map: grassTex });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(WORLD_SIZE / 2 - 0.5, -0.02, WORLD_SIZE / 2 - 0.5);
    scene.add(mesh);
}

// --- Tile overlays (only non-grass farm tiles) ---

// A tile changed type — the batched per-type InstancedMeshes rebuild next frame
// (reads farmTiles, the source of truth). Both create + remove just flag dirty.
function createOverlay(x, z, type) { _overlayDirty = true; }
function removeOverlay(key) { _overlayDirty = true; }

function overlayMat(type) {
    if (!_overlayMat[type]) _overlayMat[type] = materialForTile(type);
    return _overlayMat[type];
}

function rebuildOverlayIMs() {
    for (const t in _overlayIM) { scene.remove(_overlayIM[t]); _overlayIM[t].dispose(); }
    _overlayIM = {};
    const byType = {};
    for (const [key, tile] of farmTiles) {
        if (tile.type === TILE.GRASS) continue;
        const t = tile.type === TILE.PLANTED ? TILE.SOIL : tile.type; // planted ground shows soil
        const i = key.indexOf(',');
        (byType[t] || (byType[t] = [])).push([+key.slice(0, i), +key.slice(i + 1)]);
    }
    for (const t in byType) {
        const list = byType[t];
        const im = new THREE.InstancedMesh(sharedTileGeo, overlayMat(t), list.length);
        list.forEach(([x, z], k) => { _ovM4.makeTranslation(x, 0, z); im.setMatrixAt(k, _ovM4); });
        im.instanceMatrix.needsUpdate = true;
        scene.add(im);
        _overlayIM[t] = im;
    }
    _overlayDirty = false;
}

// Call once per frame from the game loop; rebuilds only when a tile changed type.
export function updateOverlays() { if (_overlayDirty) rebuildOverlayIMs(); }

// --- Farm tile management ---

function initFarmTiles() {
    const hs = getFarmHalfSize();
    for (let z = FARM_CZ - hs; z < FARM_CZ + hs; z++) {
        for (let x = FARM_CX - hs; x < FARM_CX + hs; x++) {
            const key = tileKey(x, z);
            if (!farmTiles.has(key)) {
                farmTiles.set(key, {
                    type: TILE.GRASS,
                    crop: null,
                    cropStage: 0,
                    cropTimer: 0,
                    watered: false,
                });
            }
        }
    }
}

function addStartingSoil() {
    // 4x4 tilled area in center of farm
    for (let z = FARM_CZ - 2; z < FARM_CZ + 2; z++) {
        for (let x = FARM_CX - 2; x < FARM_CX + 2; x++) {
            const key = tileKey(x, z);
            const tile = farmTiles.get(key);
            if (tile) {
                tile.type = TILE.SOIL;
                createOverlay(x, z, TILE.SOIL);
            }
        }
    }
}

function addPathsAndBuildings() {
    const hs = getFarmHalfSize();
    const shopX = FARM_CX + hs + 1;
    const shopZ = FARM_CZ - 1;
    const marketZ = FARM_CZ + 1;
    const barnZ = FARM_CZ - 3;

    // Path from farm edge to buildings
    for (let x = FARM_CX + hs - 1; x <= shopX; x++) {
        setSpecialTile(x, shopZ, TILE.PATH);
        setSpecialTile(x, marketZ, TILE.PATH);
        setSpecialTile(x, barnZ, TILE.PATH);
    }
    setSpecialTile(shopX, FARM_CZ, TILE.PATH);
    setSpecialTile(shopX, FARM_CZ - 2, TILE.PATH);

    // Buildings
    setSpecialTile(shopX, shopZ, TILE.SHOP);
    setSpecialTile(shopX, marketZ, TILE.MARKET);
    setSpecialTile(shopX, barnZ, TILE.BARN);

    // Building models
    addBuildingModel(shopX, shopZ, 0x4a7c59);
    addBuildingModel(shopX, marketZ, 0xc44040);
    addBarnModel(shopX, barnZ);

    // Small pond in wild area
    for (let z = FARM_CZ - 10; z < FARM_CZ - 7; z++) {
        for (let x = FARM_CX - 9; x < FARM_CX - 6; x++) {
            setSpecialTile(x, z, TILE.WATER);
        }
    }

    // Grandpa's cottage, just north of the farm
    addCottage(FARM_CX, FARM_CZ - 8);
}

function addCottage(x, z) {
    setSpecialTile(x, z, TILE.HOUSE); // solid + wood floor under the model
    // Whole cottage (walls/roof/door/window/chimney/mailbox) bakes into ONE draw (#35).
    const m = mergedMesh(g => {
        const part = (geo, color, px, py, pz, ry) => {
            const mesh = new THREE.Mesh(geo, curvedMaterial({ color }));
            mesh.position.set(px, py, pz); if (ry) mesh.rotation.y = ry; g.add(mesh);
        };
        part(new THREE.BoxGeometry(1.05, 0.85, 1.05, 2, 2, 2), 0xe8dcc0, 0, 0.5, 0);      // walls
        part(new THREE.ConeGeometry(0.95, 0.62, 4, 1), 0xb04a3a, 0, 1.25, 0, Math.PI / 4); // roof
        part(new THREE.BoxGeometry(0.3, 0.5, 0.04), 0x6e4423, 0, 0.3, 0.54);              // door
        part(new THREE.BoxGeometry(0.26, 0.26, 0.04), 0x9fdcec, 0.3, 0.56, 0.54);         // window
        part(new THREE.BoxGeometry(0.16, 0.42, 0.16), 0x8a6a4a, -0.32, 1.18, -0.18);      // chimney
        part(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), 0x6e4423, 0.72, 0.25, 0.5);  // mailbox post
        part(new THREE.BoxGeometry(0.22, 0.16, 0.14), 0x4a6b8a, 0.72, 0.52, 0.5);         // mailbox
        part(new THREE.BoxGeometry(0.02, 0.1, 0.08), 0xd64545, 0.84, 0.56, 0.5);          // flag
    });
    m.position.set(x, 0, z); freezeStatic(m); scene.add(m);
}

function setSpecialTile(x, z, type) {
    const key = tileKey(x, z);
    farmTiles.set(key, {
        type,
        crop: null,
        cropStage: 0,
        cropTimer: 0,
        watered: false,
    });
    createOverlay(x, z, type);
}

function addBuildingModel(x, z, color) {
    // Shop/market: body + roof baked into ONE draw (#35).
    const m = mergedMesh(g => {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9, 2, 2, 2), curvedMaterial({ color }));
        body.position.y = 0.5; g.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.5, 4, 1), curvedMaterial({ color: 0x8b6914 }));
        roof.position.y = 1.15; roof.rotation.y = Math.PI / 4; g.add(roof);
    });
    m.position.set(x, 0, z); freezeStatic(m); scene.add(m);
}

function addBarnModel(x, z) {
    // Barn: body + roof + door baked into ONE draw (#35).
    const m = mergedMesh(g => {
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1, 2, 2, 2), curvedMaterial({ color: 0x8B3A2B }));
        body.position.y = 0.6; g.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.6, 4, 1), curvedMaterial({ color: 0x6B4226 }));
        roof.position.y = 1.4; roof.rotation.y = Math.PI / 4; g.add(roof);
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.02, 1, 1, 1), curvedMaterial({ color: 0x5C2E0E }));
        door.position.set(0, 0.35, 0.56); g.add(door);
    });
    m.position.set(x, 0, z); freezeStatic(m); scene.add(m);
}

// --- Wild terrain decorations ---

const _YAXIS = new THREE.Vector3(0, 1, 0);

function generateDecorations() {
    const grass = [];   // { x, z, rot, scale, shade }
    const flowers = []; // { x, z, color }
    const rocks = [];   // { x, z, size, gv, ox, oz, rx, ry } — instanced like grass (#35)
    const FLOWER_COLORS = [0xf9e04b, 0xf6f2e8, 0xe88bc4, 0xff8844, 0x8fb8ff];

    for (let z = 0; z < WORLD_SIZE; z++) {
        for (let x = 0; x < WORLD_SIZE; x++) {
            if (isInFarm(x, z)) continue;
            if (farmTiles.has(tileKey(x, z))) continue;

            const n = noise(x * 0.7, z * 0.7, 42);
            const n2 = noise(x * 1.3, z * 1.3, 99);

            if (n > 0.80) { addTree(x, z); continue; } // lush wild again (instanced = ~free); farm auto-clears its own
            if (n > 0.72 && n2 > 0.5) { // collect rock data — built as ONE InstancedMesh below
                rocks.push({
                    x, z,
                    size: 0.12 + noise(x, z, 60) * 0.18,
                    gv: 100 + Math.floor(noise(x, z, 61) * 60),
                    ox: (noise(x, z, 62) - 0.5) * 0.4,
                    oz: (noise(x, z, 63) - 0.5) * 0.4,
                    rx: noise(x, z, 64) * 1.5,
                    ry: noise(x, z, 65) * 2,
                });
                continue;
            }

            // Scattered grass tufts (dense, but instanced → ~free)
            const blades = n2 > 0.45 ? 3 : (n2 > 0.2 ? 2 : 1);
            for (let i = 0; i < blades; i++) {
                grass.push({
                    x: x + (noise(x + i, z, 70) - 0.5) * 0.85,
                    z: z + (noise(x, z + i, 71) - 0.5) * 0.85,
                    rot: noise(x + i, z + i, 72) * Math.PI,
                    scale: 0.7 + noise(x, z + i, 73) * 0.6,
                    shade: noise(x + i, z, 74),
                });
            }
            // Occasional wildflowers
            if (n2 > 0.82) {
                const fc = 1 + Math.floor(noise(x, z, 75) * 3);
                for (let i = 0; i < fc; i++) {
                    flowers.push({
                        x: x + (noise(x, z + i, 76) - 0.5) * 0.7,
                        z: z + (noise(x + i, z, 77) - 0.5) * 0.7,
                        color: FLOWER_COLORS[Math.floor(noise(x + i, z, 78) * FLOWER_COLORS.length)],
                    });
                }
            }
        }
    }
    buildInstancedDecor(grass, flowers, rocks);
}

// Thousands of grass tufts + flowers as TWO InstancedMeshes (one draw call each),
// with per-instance color. The curvature shader already handles USE_INSTANCING.
function buildInstancedDecor(grass, flowers, rocks) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();

    if (rocks && rocks.length) {
        const mesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), curvedMaterial({ color: 0xffffff }), rocks.length);
        rocks.forEach((r, i) => {
            p.set(r.x + r.ox, r.size * 0.4, r.z + r.oz);
            e.set(r.rx, r.ry, 0); q.setFromEuler(e);
            s.set(r.size, r.size, r.size);
            mesh.setMatrixAt(i, m.compose(p, q, s));
            const g = r.gv / 255;
            mesh.setColorAt(i, col.setRGB(g, g, g));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.frustumCulled = false;
        scene.add(mesh);
    }

    if (grass.length) {
        const mesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.24, 4), curvedMaterial({ color: 0xffffff }), grass.length);
        grass.forEach((g, i) => {
            p.set(g.x, 0.12 * g.scale, g.z);
            q.setFromAxisAngle(_YAXIS, g.rot);
            s.set(g.scale, g.scale, g.scale);
            mesh.setMatrixAt(i, m.compose(p, q, s));
            const lvl = 0.6 + g.shade * 0.45;
            col.setRGB(0.2 * lvl, 0.55 * lvl, 0.22 * lvl);
            mesh.setColorAt(i, col);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.frustumCulled = false;
        scene.add(mesh);
    }

    if (flowers.length) {
        const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 5, 4), curvedMaterial({ color: 0xffffff }), flowers.length);
        flowers.forEach((f, i) => {
            mesh.setMatrixAt(i, m.makeTranslation(f.x, 0.12, f.z));
            mesh.setColorAt(i, col.set(f.color));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.frustumCulled = false;
        scene.add(mesh);
    }
}

// Trees are choppable entities - generation/rendering/persistence lives in trees.js

function addRock(x, z) {
    const size = 0.12 + noise(x, z, 60) * 0.18;
    const geo = new THREE.DodecahedronGeometry(size, 0);
    const gv = 100 + Math.floor(noise(x, z, 61) * 60); // 100-160 grey
    const mat = curvedMaterial({ color: (gv << 16) | (gv << 8) | gv });
    const mesh = new THREE.Mesh(geo, mat);
    const ox = (noise(x, z, 62) - 0.5) * 0.4;
    const oz = (noise(x, z, 63) - 0.5) * 0.4;
    mesh.position.set(x + ox, size * 0.4, z + oz);
    mesh.rotation.set(noise(x, z, 64) * 1.5, noise(x, z, 65) * 2, 0);
    scene.add(mesh);
}

// (flowers are now instanced in buildInstancedDecor)

// --- Farm border markers ---

const borderMeshes = [];

// Live fence geometry (set by updateFarmBorder) so collision + A* know where the
// rails actually are. The fence is a thin wall on the farm perimeter with one
// gate opening on the east edge (#21/#25).
const fence = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, gateHalf: 1.5, gateX: FARM_CX, gateZ: FARM_CZ, active: false };
const FENCE_BAND = 0.18; // half-thickness of the collision wall

// Is world point (x,z) standing on a fence rail (and NOT in a gate gap)?
// Each of the four edges has a gate opening at its centre — a crossroads (#25).
// Used as a continuous barrier for the player and (via the edge midpoint) by A*.
export function fenceBlocks(x, z) {
    if (!fence.active) return false;
    const { minX, maxX, minZ, maxZ, gateHalf, gateX, gateZ } = fence;
    const b = FENCE_BAND;
    const inGateX = Math.abs(x - gateX) <= gateHalf; // within the N/S gate opening
    const inGateZ = Math.abs(z - gateZ) <= gateHalf; // within the W/E gate opening
    // North / South rails (constant Z), only across the farm's X span
    if (x >= minX - b && x <= maxX + b && !inGateX) {
        if (Math.abs(z - minZ) < b) return true;
        if (Math.abs(z - maxZ) < b) return true;
    }
    // West / East rails (constant X), only across the farm's Z span
    if (z >= minZ - b && z <= maxZ + b && !inGateZ) {
        if (Math.abs(x - minX) < b) return true;
        if (Math.abs(x - maxX) < b) return true;
    }
    return false;
}

function updateFarmBorder() {
    // Remove old fence
    for (const m of borderMeshes) {
        scene.remove(m);
        if (m.geometry) m.geometry.dispose();
    }
    borderMeshes.length = 0;

    const hs = getFarmHalfSize();
    const minX = FARM_CX - hs - 0.5;
    const maxX = FARM_CX + hs - 0.5;
    const minZ = FARM_CZ - hs - 0.5;
    const maxZ = FARM_CZ + hs - 0.5;
    // Publish the live bounds for collision + pathfinding (#25)
    fence.minX = minX; fence.maxX = maxX; fence.minZ = minZ; fence.maxZ = maxZ;
    fence.gateHalf = 1.5; fence.gateX = FARM_CX; fence.gateZ = FARM_CZ; fence.active = true;

    const postGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.6, 5);
    const railGeo = new THREE.BoxGeometry(1, 0.04, 0.04, 2, 1, 1); // 1-tile wide rail segment
    const postMat = curvedMaterial({ color: 0xa0783c });
    const railMat = curvedMaterial({ color: 0xb8924a });

    const SPACING = 2;
    const _posts = [], _rails = []; // collected, then batched into 2 InstancedMeshes (#35)

    // Each edge has a gate opening at its centre — a crossroads (N/S/E/W exits, #25).
    const gateHalf = 1.5;
    const inGateX = (xx) => Math.abs(xx - FARM_CX) <= gateHalf; // gap on the N/S edges
    const inGateZ = (zz) => Math.abs(zz - FARM_CZ) <= gateHalf; // gap on the W/E edges

    // Posts: top (minZ) + bottom (maxZ) edges run along X — skip the centre gate
    for (let x = minX; x <= maxX + 0.01; x += SPACING) {
        if (inGateX(x)) continue;
        addPost(x, minZ);
        addPost(x, maxZ);
    }
    // Posts: left (minX) + right (maxX) edges run along Z — skip the centre gate
    for (let z = minZ; z <= maxZ + 0.01; z += SPACING) {
        if (inGateZ(z)) continue;
        addPost(minX, z);
        addPost(maxX, z);
    }

    // Rails along top + bottom edges (gap at the gate)
    for (let x = minX; x < maxX - 0.01; x += 1) {
        if (inGateX(x + 0.5)) continue;
        addRail(x + 0.5, minZ, 0);
        addRail(x + 0.5, maxZ, 0);
    }
    // Rails along left + right edges (rotated 90°, gap at the gate)
    for (let z = minZ; z < maxZ - 0.01; z += 1) {
        if (inGateZ(z + 0.5)) continue;
        addRail(minX, z + 0.5, Math.PI / 2);
        addRail(maxX, z + 0.5, Math.PI / 2);
    }

    // Four gates: tall posts + a lintel across each cardinal opening
    const gw = gateHalf * 2 + 0.25;
    const lintelGeoX = new THREE.BoxGeometry(gw, 0.09, 0.07, 2, 1, 1); // spans along X (N/S gates)
    const lintelGeoZ = new THREE.BoxGeometry(0.07, 0.09, gw, 1, 1, 2); // spans along Z (W/E gates)
    const addLintel = (geo, px, pz) => { const l = new THREE.Mesh(geo, railMat); l.position.set(px, 0.92, pz); scene.add(l); borderMeshes.push(l); };
    // North + South (along X)
    addGatePost(FARM_CX - gateHalf, minZ); addGatePost(FARM_CX + gateHalf, minZ); addLintel(lintelGeoX, FARM_CX, minZ);
    addGatePost(FARM_CX - gateHalf, maxZ); addGatePost(FARM_CX + gateHalf, maxZ); addLintel(lintelGeoX, FARM_CX, maxZ);
    // West + East (along Z)
    addGatePost(minX, FARM_CZ - gateHalf); addGatePost(minX, FARM_CZ + gateHalf); addLintel(lintelGeoZ, minX, FARM_CZ);
    addGatePost(maxX, FARM_CZ - gateHalf); addGatePost(maxX, FARM_CZ + gateHalf); addLintel(lintelGeoZ, maxX, FARM_CZ);

    // Batch all posts + rails into one InstancedMesh each. These were hundreds of
    // separate meshes — a big chunk of the draw calls on a big farm (#35). ~2 draws now.
    const _fm = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _fp = new THREE.Vector3(), _fs = new THREE.Vector3(1, 1, 1), _fy = new THREE.Vector3(0, 1, 0);
    if (_posts.length) {
        const im = new THREE.InstancedMesh(postGeo, postMat, _posts.length);
        _posts.forEach(([px, pz], i) => { _fp.set(px, 0.3, pz); im.setMatrixAt(i, _fm.compose(_fp, _fq.identity(), _fs)); });
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
        scene.add(im); borderMeshes.push(im);
    }
    if (_rails.length) {
        const im = new THREE.InstancedMesh(railGeo, railMat, _rails.length);
        _rails.forEach(([px, py, pz, rotY], i) => { _fp.set(px, py, pz); _fq.setFromAxisAngle(_fy, rotY); im.setMatrixAt(i, _fm.compose(_fp, _fq, _fs)); });
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
        scene.add(im); borderMeshes.push(im);
    }

    function addPost(px, pz) { _posts.push([px, pz]); }

    function addGatePost(px, pz) {
        const gp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.95, 6), postMat);
        gp.position.set(px, 0.47, pz);
        scene.add(gp);
        borderMeshes.push(gp);
    }

    function addRail(px, pz, rotY) {
        _rails.push([px, 0.42, pz, rotY]); // upper
        _rails.push([px, 0.22, pz, rotY]); // lower
    }
}

// --- Farm expansion ---

export function expandFarm() {
    if (farmLevel >= EXPANSION_COSTS.length) return false;
    farmLevel++;
    initFarmTiles();
    updateFarmBorder();
    removeTreesInside(isInFarm); // clear any wild trees the farm just grew over
    return true;
}

export function setFarmLevel(level) {
    farmLevel = level;
    initFarmTiles();
    updateFarmBorder();
    removeTreesInside(isInFarm); // saved farm size may enclose trees from world-gen
}

// --- Public API ---

export function createWorld() {
    initTextures();
    sharedTileGeo = new THREE.BoxGeometry(1.0, 0.15, 1.0, 2, 1, 2);

    createGroundPlane();
    initFarmTiles();
    addStartingSoil();
    addPathsAndBuildings();
    generateDecorations();
    updateFarmBorder();
}

export function getTile(x, z) {
    if (x < 0 || x >= WORLD_SIZE || z < 0 || z >= WORLD_SIZE) return null;
    return farmTiles.get(tileKey(x, z)) || null;
}

export function setTileType(x, z, type) {
    const key = tileKey(x, z);
    const tile = farmTiles.get(key);
    if (!tile) return;
    tile.type = type;
    createOverlay(x, z, type);
}

/** Solid tiles block movement: water, buildings, the cottage. Everything else —
 *  including the endless wild beyond the original box — is walkable, so Jenn can
 *  roam out into the streamed terrain chunks (chunks.js) forever. */
export function isSolidTile(x, z) {
    const ix = Math.round(x), iz = Math.round(z);
    const t = farmTiles.get(tileKey(ix, iz));
    if (!t) return false; // wild / ungenerated ground is open
    return t.type === TILE.WATER || t.type === TILE.SHOP || t.type === TILE.MARKET
        || t.type === TILE.BARN || t.type === TILE.HOUSE;
}

export function forEachFarmTile(callback) {
    for (const [key, tile] of farmTiles) {
        const parts = key.split(',');
        callback(parseInt(parts[0]), parseInt(parts[1]), tile);
    }
}

// --- Highlight ---

let highlightMesh = null;

export function initHighlight() {
    const geo = new THREE.BoxGeometry(1.02, 0.16, 1.02, 2, 1, 2);
    const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
        depthTest: true,
    });
    applyCurvature(mat);
    highlightMesh = new THREE.Mesh(geo, mat);
    highlightMesh.visible = false;
    scene.add(highlightMesh);
}

export function showHighlight(x, z, color = 0xffffff) {
    if (!highlightMesh) return;
    highlightMesh.position.set(x, 0.01, z);
    highlightMesh.material.color.setHex(color);
    highlightMesh.visible = true;
}

export function hideHighlight() {
    if (highlightMesh) highlightMesh.visible = false;
}

// --- Serialization ---

export function serializeWorld() {
    const data = [];
    for (const [key, t] of farmTiles) {
        // Only save modified tiles (not default grass, not fixed structures)
        if (t.type === TILE.GRASS || t.type === TILE.WATER ||
            t.type === TILE.SHOP || t.type === TILE.MARKET || t.type === TILE.BARN || t.type === TILE.PATH) continue;
        const parts = key.split(',');
        data.push({
            x: parseInt(parts[0]),
            z: parseInt(parts[1]),
            type: t.type,
            crop: t.crop,
            cropStage: t.cropStage,
            cropTimer: t.cropTimer,
            watered: t.watered,
        });
    }
    return data;
}

export function loadWorld(data, savedFarmLevel) {
    if (savedFarmLevel) {
        farmLevel = savedFarmLevel;
        initFarmTiles();
        updateFarmBorder();
    }
    if (!data) return;
    for (const d of data) {
        const key = tileKey(d.x, d.z);
        const tile = farmTiles.get(key);
        if (tile) {
            tile.type = d.type;
            tile.crop = d.crop;
            tile.cropStage = d.cropStage;
            tile.cropTimer = d.cropTimer;
            tile.watered = d.watered;
            createOverlay(d.x, d.z, d.type);
        }
    }
}
