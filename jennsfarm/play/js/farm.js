import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { getTile, TILE, forEachFarmTile } from './world.js';

// Crop definitions
export const CROPS = {
    carrot: {
        name: 'Carrot',
        growTime: 30,      // seconds total (seed to harvest)
        stages: 4,         // 0=seed, 1=sprout, 2=growing, 3=mature
        seedItem: 'carrot_seed',
        harvestItem: 'carrot',
        harvestQty: 2,
        colors: ['#8b6914', '#4a8c3f', '#3a7a2f', '#ff7733'],
    },
    tomato: {
        name: 'Tomato',
        growTime: 50,
        stages: 4,
        seedItem: 'tomato_seed',
        harvestItem: 'tomato',
        harvestQty: 3,
        regrows: true, // keeps fruiting - re-ripens after each pick
        colors: ['#8b6914', '#4a8c3f', '#3a7a2f', '#e63946'],
    },
    potato: {
        name: 'Potato',
        growTime: 25,
        stages: 4,
        seedItem: 'potato_seed',
        harvestItem: 'potato',
        harvestQty: 2,
        colors: ['#8b6914', '#4a8c3f', '#3a7a2f', '#c8a86e'],
    },
    wheat: {
        name: 'Wheat',
        growTime: 40,
        stages: 4,
        seedItem: 'wheat_seed',
        harvestItem: 'wheat',
        harvestQty: 3,
        colors: ['#8b6914', '#5a9c4f', '#7ab840', '#deb841'],
    },
    // --- Herbs ---
    mint: {
        name: 'Mint', kind: 'herb',
        growTime: 28, stages: 4,
        seedItem: 'mint_seed', harvestItem: 'mint', harvestQty: 3,
        regrows: true, // herb keeps re-leafing
        colors: ['#8b6914', '#4a8c3f', '#3f9a55', '#5fd07a'],
    },
    lavender: {
        name: 'Lavender', kind: 'flower',
        growTime: 36, stages: 4,
        seedItem: 'lavender_seed', harvestItem: 'lavender', harvestQty: 2,
        colors: ['#8b6914', '#4a8c3f', '#6a7a4f', '#9b6fd6'],
    },
    // --- Flowers ---
    tulip: {
        name: 'Tulip', kind: 'flower',
        growTime: 30, stages: 4,
        seedItem: 'tulip_seed', harvestItem: 'tulip', harvestQty: 2,
        colors: ['#8b6914', '#4a8c3f', '#3a7a2f', '#e0588a'],
    },
    sunflower: {
        name: 'Sunflower', kind: 'flower',
        growTime: 46, stages: 4,
        seedItem: 'sunflower_seed', harvestItem: 'sunflower', harvestQty: 1,
        colors: ['#8b6914', '#4a8c3f', '#5a9c3f', '#f2c21b'],
    },
    rose: {
        name: 'Rose', kind: 'flower',
        growTime: 56, stages: 4,
        seedItem: 'rose_seed', harvestItem: 'rose', harvestQty: 2,
        colors: ['#8b6914', '#4a8c3f', '#3a7a2f', '#d62f4a'],
    },
    strawberry: {
        name: 'Strawberry', kind: 'berry',
        growTime: 24, stages: 4,
        seedItem: 'strawberry_seed', harvestItem: 'strawberry', harvestQty: 3,
        regrows: true, // berry bush keeps producing
        colors: ['#8b6914', '#4a8c3f', '#3a7a2f', '#e2452f'],
    },
    // --- Premium ---
    square_watermelon: {
        name: 'Square Watermelon', kind: 'melon',
        growTime: 95, stages: 4,
        seedItem: 'square_watermelon_seed', harvestItem: 'square_watermelon', harvestQty: 1,
        colors: ['#8b6914', '#4a8c3f', '#3a7a2f', '#2f7a32'],
    },
};

// Active crop meshes on the map
const cropMeshes = {}; // key: "x,z" -> THREE.Group

function cropKey(x, z) { return `${x},${z}`; }

// --- Water ---
// Water now MATTERS: watered crops grow at full speed, dry crops crawl. Water
// drains over time, so you re-water by hand or let a sprinkler keep it topped.
export const WATER_DURATION = 45;   // seconds a tile stays wet
const DRY_GROWTH = 0.3;             // growth multiplier when a tile is dry
const REGROW_STAGE = 2;             // mature regrowing crops drop back to this stage

export function waterTile(tile) {
    if (!tile) return;
    tile.watered = true;
    tile.waterT = WATER_DURATION;
}

function createCropMesh(cropId, stage) {
    const crop = CROPS[cropId];
    if (!crop) return null;

    const group = new THREE.Group();
    const color = crop.colors[stage] || crop.colors[0];

    if (stage === 0) {
        // Seed - small mound
        const geo = new THREE.SphereGeometry(0.08, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.5);
        const mat = curvedMaterial({ color: 0x8b6914 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.08;
        group.add(mesh);
    } else if (stage === 1) {
        // Sprout - small green stem
        const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.2, 4);
        const stemMat = curvedMaterial({ color: 0x4a8c3f });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 0.18;
        group.add(stem);
        // Tiny leaves
        const leafGeo = new THREE.SphereGeometry(0.06, 4, 3);
        const leafMat = curvedMaterial({ color: 0x5aac4f });
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.y = 0.3;
        group.add(leaf);
    } else if (stage === 2) {
        // Growing - taller stem with foliage
        const stemGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.35, 6);
        const stemMat = curvedMaterial({ color: 0x3a7a2f });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 0.26;
        group.add(stem);
        const topGeo = new THREE.SphereGeometry(0.12, 6, 5);
        const topMat = curvedMaterial({ color });
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.y = 0.48;
        group.add(top);
    } else if (stage === 3) {
        // Mature - full plant with colored fruit/crop
        const stemGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.4, 6);
        const stemMat = curvedMaterial({ color: 0x3a7a2f });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 0.28;
        group.add(stem);

        // Crop-specific shape
        if (cropId === 'carrot' || cropId === 'potato') {
            // Root crop - visible top + implied underground
            const topGeo = new THREE.ConeGeometry(0.15, 0.2, 6);
            const topMat = curvedMaterial({ color });
            const top = new THREE.Mesh(topGeo, topMat);
            top.position.y = 0.55;
            group.add(top);
        } else if (cropId === 'tomato') {
            // Round fruit
            const fruitGeo = new THREE.SphereGeometry(0.14, 8, 6);
            const fruitMat = curvedMaterial({ color });
            const fruit = new THREE.Mesh(fruitGeo, fruitMat);
            fruit.position.y = 0.55;
            group.add(fruit);
            // Second fruit
            const fruit2 = new THREE.Mesh(fruitGeo, fruitMat);
            fruit2.position.set(0.1, 0.42, 0.08);
            fruit2.scale.setScalar(0.7);
            group.add(fruit2);
        } else if (cropId === 'wheat') {
            // Tall stalk with grain head
            const stalkGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.55, 4);
            const stalkMat = curvedMaterial({ color: 0x7ab840 });
            const stalk = new THREE.Mesh(stalkGeo, stalkMat);
            stalk.position.y = 0.36;
            group.add(stalk);
            const grainGeo = new THREE.CylinderGeometry(0.05, 0.03, 0.15, 4);
            const grainMat = curvedMaterial({ color });
            const grain = new THREE.Mesh(grainGeo, grainMat);
            grain.position.y = 0.68;
            group.add(grain);
        } else if (crop.kind === 'flower') {
            // Ring of petals around a bright center
            const petalMat = curvedMaterial({ color });
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const petal = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 4), petalMat);
                petal.position.set(Math.cos(a) * 0.13, 0.56, Math.sin(a) * 0.13);
                petal.scale.set(1, 0.45, 1);
                group.add(petal);
            }
            const center = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), curvedMaterial({ color: 0xffd24a }));
            center.position.y = 0.57;
            group.add(center);
        } else if (crop.kind === 'herb') {
            // Bushy cluster of upright leaves
            const leafMat = curvedMaterial({ color });
            const offs = [[0, 0.5, 0], [0.1, 0.46, 0.05], [-0.1, 0.46, -0.05], [0.08, 0.5, -0.08], [-0.07, 0.52, 0.08]];
            for (const o of offs) {
                const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 4), leafMat);
                leaf.position.set(o[0], o[1], o[2]);
                leaf.scale.set(0.8, 1.4, 0.8);
                group.add(leaf);
            }
        } else if (crop.kind === 'berry') {
            // Green bush dotted with berries
            const bush = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 6), curvedMaterial({ color: 0x3f9a4a }));
            bush.position.y = 0.5; bush.scale.set(1, 0.8, 1);
            group.add(bush);
            const berryMat = curvedMaterial({ color });
            for (const o of [[0.12, 0.46, 0.05], [-0.1, 0.48, -0.06], [0.0, 0.44, 0.14]]) {
                const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), berryMat);
                b.position.set(o[0], o[1], o[2]);
                group.add(b);
            }
        } else if (crop.kind === 'melon') {
            // Premium SQUARE watermelon - a striped cube
            const melon = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), curvedMaterial({ color }));
            melon.position.y = 0.46;
            group.add(melon);
            const stripeMat = curvedMaterial({ color: 0x1d5024 });
            for (let i = -1; i <= 1; i++) {
                const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.36), stripeMat);
                st.position.set(i * 0.11, 0.46, 0);
                group.add(st);
            }
        }

        // Sparkle indicator for harvestable
        const sparkleGeo = new THREE.SphereGeometry(0.04, 4, 4);
        const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xfff5aa, transparent: true, opacity: 0.8 });
        const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat);
        sparkle.position.y = 0.75;
        sparkle.userData.isSparkle = true;
        group.add(sparkle);
    }

    return group;
}

// --- Public API ---

export function plantCrop(x, z, cropId) {
    const tile = getTile(x, z);
    if (!tile || tile.type !== TILE.SOIL) return false;

    tile.type = TILE.PLANTED;
    tile.crop = cropId;
    tile.cropStage = 0;
    tile.cropTimer = 0;

    // Create and place mesh
    const mesh = createCropMesh(cropId, 0);
    if (mesh) {
        mesh.position.set(x, 0.07, z);
        scene.add(mesh);
        cropMeshes[cropKey(x, z)] = mesh;
    }
    return true;
}

export function harvestCrop(x, z) {
    const tile = getTile(x, z);
    if (!tile || tile.type !== TILE.PLANTED || tile.cropStage < 3) return null;

    const crop = CROPS[tile.crop];
    const result = { itemId: crop.harvestItem, qty: crop.harvestQty };

    // Remove current crop mesh
    const key = cropKey(x, z);
    if (cropMeshes[key]) {
        scene.remove(cropMeshes[key]);
        cropMeshes[key].traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
        delete cropMeshes[key];
    }

    if (crop.regrows) {
        // Multi-harvest: drop back to a growing stage and keep the plant
        tile.cropStage = REGROW_STAGE;
        tile.cropTimer = 0;
        result.regrew = true;
        const mesh = createCropMesh(tile.crop, tile.cropStage);
        if (mesh) {
            mesh.position.set(x, 0.07, z);
            scene.add(mesh);
            cropMeshes[key] = mesh;
        }
    } else {
        // One-and-done: clear back to soil
        tile.type = TILE.SOIL;
        tile.crop = null;
        tile.cropStage = 0;
        tile.cropTimer = 0;
    }

    return result;
}

let _cropAccum = 0;

export function updateCrops(dt) {
    // Throttle the O(all-tiles) simulation to ~5Hz with accumulated time — same
    // growth, far less per-frame work on a big farm. (Visuals below run per frame.)
    _cropAccum += dt;
    if (_cropAccum >= 0.2) {
    const step = _cropAccum;
    _cropAccum = 0;

    forEachFarmTile((x, z, tile) => {
        // Drain water on every farm tile over time
        if (tile.waterT > 0) {
            tile.waterT -= step;
            if (tile.waterT <= 0) { tile.waterT = 0; tile.watered = false; }
        }

        if (tile.type !== TILE.PLANTED || !tile.crop) return;

        const crop = CROPS[tile.crop];
        if (!crop || tile.cropStage >= 3) return;

        // Watered crops grow at full speed; dry crops crawl (water now matters)
        tile.cropTimer += step * (tile.watered ? 1 : DRY_GROWTH);
        const stageTime = crop.growTime / 3;

        if (tile.cropTimer >= stageTime) {
            tile.cropTimer -= stageTime;
            tile.cropStage++;

            const key = cropKey(x, z);
            if (cropMeshes[key]) {
                scene.remove(cropMeshes[key]);
                cropMeshes[key].traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
            }
            const mesh = createCropMesh(tile.crop, tile.cropStage);
            if (mesh) {
                mesh.position.set(x, 0.07, z);
                scene.add(mesh);
                cropMeshes[key] = mesh;
            }
        }
    });
    } // end throttled sim block

    // Animate sparkles on mature crops (cheap, every frame for smoothness)
    const time = performance.now() * 0.003;
    for (const key in cropMeshes) {
        const group = cropMeshes[key];
        group.traverse(child => {
            if (child.userData.isSparkle) {
                child.position.y = 0.75 + Math.sin(time + group.position.x * 3) * 0.05;
                child.material.opacity = 0.5 + Math.sin(time * 2 + group.position.z * 5) * 0.3;
            }
        });
    }
}

// Rebuild crop meshes from tile data (after load)
export function rebuildCropMeshes() {
    // Clear existing
    for (const key in cropMeshes) {
        scene.remove(cropMeshes[key]);
        cropMeshes[key].traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
        delete cropMeshes[key];
    }
    // Recreate from tile data
    forEachFarmTile((x, z, tile) => {
        if (tile.type === TILE.PLANTED && tile.crop) {
            const mesh = createCropMesh(tile.crop, tile.cropStage);
            if (mesh) {
                mesh.position.set(x, 0.07, z);
                scene.add(mesh);
                cropMeshes[cropKey(x, z)] = mesh;
            }
        }
    });
}
