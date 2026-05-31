import * as THREE from 'three';
import { scene, curvedMaterial, applyCurvature } from './renderer.js';
import { createGrassTexture, createSoilTexture, createPathTexture, createWaterTexture, createBuildingTexture, createBarnTexture } from './textures.js';
import { addTree } from './trees.js';

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
const overlayMeshes = new Map();

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

function createOverlay(x, z, type) {
    const key = tileKey(x, z);
    removeOverlay(key);
    if (type === TILE.GRASS) return; // grass = no overlay, ground shows through

    const mesh = new THREE.Mesh(sharedTileGeo, materialForTile(type));
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    overlayMeshes.set(key, mesh);
}

function removeOverlay(key) {
    if (overlayMeshes.has(key)) {
        const mesh = overlayMeshes.get(key);
        scene.remove(mesh);
        mesh.material.dispose();
        overlayMeshes.delete(key);
    }
}

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
    // Walls
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.85, 1.05, 2, 2, 2), curvedMaterial({ color: 0xe8dcc0 }));
    wall.position.set(x, 0.5, z); scene.add(wall);
    // Pitched roof (4-sided cone), warm red
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.62, 4, 1), curvedMaterial({ color: 0xb04a3a }));
    roof.position.set(x, 1.25, z); roof.rotation.y = Math.PI / 4; scene.add(roof);
    // Door (faces south, toward the farm)
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.04), curvedMaterial({ color: 0x6e4423 }));
    door.position.set(x, 0.3, z + 0.54); scene.add(door);
    // Window
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.04), curvedMaterial({ color: 0x9fdcec }));
    win.position.set(x + 0.3, 0.56, z + 0.54); scene.add(win);
    // Chimney
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), curvedMaterial({ color: 0x8a6a4a }));
    chimney.position.set(x - 0.32, 1.18, z - 0.18); scene.add(chimney);
    // Grandpa's mailbox by the door (daily letters — collected via the Home panel)
    const mbPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), curvedMaterial({ color: 0x6e4423 }));
    mbPost.position.set(x + 0.72, 0.25, z + 0.5); scene.add(mbPost);
    const mbBox = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.14), curvedMaterial({ color: 0x4a6b8a }));
    mbBox.position.set(x + 0.72, 0.52, z + 0.5); scene.add(mbBox);
    const mbFlag = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.08), curvedMaterial({ color: 0xd64545 }));
    mbFlag.position.set(x + 0.84, 0.56, z + 0.5); scene.add(mbFlag);
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
    const geo = new THREE.BoxGeometry(0.9, 0.8, 0.9, 2, 2, 2);
    const mat = curvedMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.5, z);
    scene.add(mesh);

    const roofGeo = new THREE.ConeGeometry(0.7, 0.5, 4, 1);
    const roofMat = curvedMaterial({ color: 0x8b6914 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(x, 1.15, z);
    roof.rotation.y = Math.PI / 4;
    scene.add(roof);
}

function addBarnModel(x, z) {
    // Barn body - wider than other buildings
    const bodyGeo = new THREE.BoxGeometry(1.1, 1.0, 1.1, 2, 2, 2);
    const bodyMat = curvedMaterial({ color: 0x8B3A2B });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(x, 0.6, z);
    scene.add(body);

    // Barn roof - steep triangle (cone with 4 sides)
    const roofGeo = new THREE.ConeGeometry(0.9, 0.6, 4, 1);
    const roofMat = curvedMaterial({ color: 0x6B4226 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(x, 1.4, z);
    roof.rotation.y = Math.PI / 4;
    scene.add(roof);

    // Barn door
    const doorGeo = new THREE.BoxGeometry(0.3, 0.5, 0.02, 1, 1, 1);
    const doorMat = curvedMaterial({ color: 0x5C2E0E });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(x, 0.35, z + 0.56);
    scene.add(door);
}

// --- Wild terrain decorations ---

const _YAXIS = new THREE.Vector3(0, 1, 0);

function generateDecorations() {
    const grass = [];   // { x, z, rot, scale, shade }
    const flowers = []; // { x, z, color }
    const FLOWER_COLORS = [0xf9e04b, 0xf6f2e8, 0xe88bc4, 0xff8844, 0x8fb8ff];

    for (let z = 0; z < WORLD_SIZE; z++) {
        for (let x = 0; x < WORLD_SIZE; x++) {
            if (isInFarm(x, z)) continue;
            if (farmTiles.has(tileKey(x, z))) continue;

            const n = noise(x * 0.7, z * 0.7, 42);
            const n2 = noise(x * 1.3, z * 1.3, 99);

            if (n > 0.78) { addTree(x, z); continue; }
            if (n > 0.72 && n2 > 0.5) { addRock(x, z); continue; }

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
    buildInstancedDecor(grass, flowers);
}

// Thousands of grass tufts + flowers as TWO InstancedMeshes (one draw call each),
// with per-instance color. The curvature shader already handles USE_INSTANCING.
function buildInstancedDecor(grass, flowers) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    const p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();

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

    const postGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.6, 5);
    const railGeo = new THREE.BoxGeometry(1, 0.04, 0.04, 2, 1, 1); // 1-tile wide rail segment
    const postMat = curvedMaterial({ color: 0xa0783c });
    const railMat = curvedMaterial({ color: 0xb8924a });

    const SPACING = 2;

    // Build fence along each edge: posts every 2 tiles, rails connecting them
    // Top edge (minZ) and bottom edge (maxZ)
    for (let x = minX; x <= maxX + 0.01; x += SPACING) {
        addPost(x, minZ);
        addPost(x, maxZ);
    }
    // Left edge full; the right (east) edge — facing the shops/road — has a gate
    const gateHalf = 1.5;
    const inGate = (zz) => Math.abs(zz - FARM_CZ) <= gateHalf;
    for (let z = minZ; z <= maxZ + 0.01; z += SPACING) {
        addPost(minX, z);
        if (!inGate(z)) addPost(maxX, z);
    }

    // Horizontal rails along top and bottom edges
    for (let x = minX; x < maxX - 0.01; x += 1) {
        addRail(x + 0.5, minZ, 0);    // top edge
        addRail(x + 0.5, maxZ, 0);    // bottom edge
    }
    // Horizontal rails along left and right edges (rotated 90 degrees)
    for (let z = minZ; z < maxZ - 0.01; z += 1) {
        addRail(minX, z + 0.5, Math.PI / 2);  // left edge
        if (!inGate(z + 0.5)) addRail(maxX, z + 0.5, Math.PI / 2); // right edge (gap at gate)
    }

    // Gate: two tall posts + a lintel across the east opening
    addGatePost(maxX, FARM_CZ - gateHalf);
    addGatePost(maxX, FARM_CZ + gateHalf);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, gateHalf * 2 + 0.25, 1, 1, 2), railMat);
    lintel.position.set(maxX, 0.92, FARM_CZ);
    scene.add(lintel);
    borderMeshes.push(lintel);

    function addPost(px, pz) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(px, 0.3, pz);
        scene.add(post);
        borderMeshes.push(post);
    }

    function addGatePost(px, pz) {
        const gp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.95, 6), postMat);
        gp.position.set(px, 0.47, pz);
        scene.add(gp);
        borderMeshes.push(gp);
    }

    function addRail(px, pz, rotY) {
        // Upper rail
        const rail1 = new THREE.Mesh(railGeo, railMat);
        rail1.position.set(px, 0.42, pz);
        rail1.rotation.y = rotY;
        scene.add(rail1);
        borderMeshes.push(rail1);
        // Lower rail
        const rail2 = new THREE.Mesh(railGeo, railMat);
        rail2.position.set(px, 0.22, pz);
        rail2.rotation.y = rotY;
        scene.add(rail2);
        borderMeshes.push(rail2);
    }
}

// --- Farm expansion ---

export function expandFarm() {
    if (farmLevel >= EXPANSION_COSTS.length) return false;
    farmLevel++;
    initFarmTiles();
    updateFarmBorder();
    return true;
}

export function setFarmLevel(level) {
    farmLevel = level;
    initFarmTiles();
    updateFarmBorder();
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
