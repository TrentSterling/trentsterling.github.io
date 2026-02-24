import * as THREE from 'three';
import { scene, curvedMaterial, applyCurvature } from './renderer.js';
import { createGrassTexture, createSoilTexture, createPathTexture, createWaterTexture, createBuildingTexture, createBarnTexture } from './textures.js';

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
};

// Sparse tile storage — only farm area + special tiles
const farmTiles = new Map();
const overlayMeshes = new Map();

function tileKey(x, z) { return `${x},${z}`; }

function noise(x, y, seed) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 43758.5453) * 43758.5453;
    return n - Math.floor(n);
}

// ——— Textures ———

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
    };
    return curvedMaterial({ map: map[type] || textures.grass });
}

// ——— Ground plane (covers entire world, grass textured) ———

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

// ——— Tile overlays (only non-grass farm tiles) ———

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

// ——— Farm tile management ———

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
    // Barn body — wider than other buildings
    const bodyGeo = new THREE.BoxGeometry(1.1, 1.0, 1.1, 2, 2, 2);
    const bodyMat = curvedMaterial({ color: 0x8B3A2B });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(x, 0.6, z);
    scene.add(body);

    // Barn roof — steep triangle (cone with 4 sides)
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

// ——— Wild terrain decorations ———

function generateDecorations() {
    for (let z = 0; z < WORLD_SIZE; z++) {
        for (let x = 0; x < WORLD_SIZE; x++) {
            // Skip farm area and nearby
            if (isInFarm(x, z)) continue;
            if (farmTiles.has(tileKey(x, z))) continue;

            const n = noise(x * 0.7, z * 0.7, 42);
            const n2 = noise(x * 1.3, z * 1.3, 99);

            if (n > 0.78) {
                addTree(x, z);
            } else if (n > 0.72 && n2 > 0.5) {
                addRock(x, z);
            } else if (n2 > 0.82) {
                addFlowers(x, z);
            }
        }
    }
}

function addTree(x, z) {
    const group = new THREE.Group();
    const height = 0.6 + noise(x, z, 50) * 0.6;

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.06, 0.1, height, 6);
    const trunkMat = curvedMaterial({ color: 0x8B5A2B });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = height / 2;
    group.add(trunk);

    // Foliage — explicit RGB to guarantee natural greens
    const n1 = noise(x, z, 51);
    const r = 30 + Math.floor(n1 * 45);       // 30-75
    const g = 110 + Math.floor(noise(x, z, 52) * 70); // 110-180
    const b = 30 + Math.floor(noise(x, z, 53) * 35);  // 30-65
    const fColor = (r << 16) | (g << 8) | b;
    const fMat = curvedMaterial({ color: fColor });

    const f1 = new THREE.Mesh(new THREE.SphereGeometry(0.4 + noise(x, z, 52) * 0.2, 6, 5), fMat);
    f1.position.y = height + 0.3;
    group.add(f1);

    const f2 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 5, 4), fMat);
    f2.position.set(0.12, height + 0.55, 0.08);
    group.add(f2);

    // Slight random offset within tile
    const ox = (noise(x, z, 53) - 0.5) * 0.3;
    const oz = (noise(x, z, 54) - 0.5) * 0.3;
    group.position.set(x + ox, 0, z + oz);
    scene.add(group);
}

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

function addFlowers(x, z) {
    const colors = [0xf9e04b, 0xf0f0f0, 0xe88bc4, 0xff8844, 0x88bbff];
    const count = 2 + Math.floor(noise(x, z, 70) * 3);
    for (let i = 0; i < count; i++) {
        const color = colors[Math.floor(noise(x + i, z, 71) * colors.length)];
        const geo = new THREE.SphereGeometry(0.05, 4, 3);
        const mat = curvedMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        const ox = (noise(x, z + i, 72) - 0.5) * 0.7;
        const oz = (noise(x + i, z, 73) - 0.5) * 0.7;
        mesh.position.set(x + ox, 0.08, z + oz);
        scene.add(mesh);
    }
}

// ——— Farm border markers ———

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
    // Left edge (minX) and right edge (maxX)
    for (let z = minZ; z <= maxZ + 0.01; z += SPACING) {
        addPost(minX, z);
        addPost(maxX, z);
    }

    // Horizontal rails along top and bottom edges
    for (let x = minX; x < maxX - 0.01; x += 1) {
        addRail(x + 0.5, minZ, 0);    // top edge
        addRail(x + 0.5, maxZ, 0);    // bottom edge
    }
    // Horizontal rails along left and right edges (rotated 90 degrees)
    for (let z = minZ; z < maxZ - 0.01; z += 1) {
        addRail(minX, z + 0.5, Math.PI / 2);  // left edge
        addRail(maxX, z + 0.5, Math.PI / 2);  // right edge
    }

    function addPost(px, pz) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(px, 0.3, pz);
        scene.add(post);
        borderMeshes.push(post);
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

// ——— Farm expansion ———

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

// ——— Public API ———

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

export function forEachFarmTile(callback) {
    for (const [key, tile] of farmTiles) {
        const parts = key.split(',');
        callback(parseInt(parts[0]), parseInt(parts[1]), tile);
    }
}

// ——— Highlight ———

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

export function showHighlight(x, z) {
    if (!highlightMesh) return;
    highlightMesh.position.set(x, 0.01, z);
    highlightMesh.visible = true;
}

export function hideHighlight() {
    if (highlightMesh) highlightMesh.visible = false;
}

// ——— Serialization ———

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
