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
};

// Active crop meshes on the map
const cropMeshes = {}; // key: "x,z" -> THREE.Group

function cropKey(x, z) { return `${x},${z}`; }

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

    // Remove crop mesh
    const key = cropKey(x, z);
    if (cropMeshes[key]) {
        scene.remove(cropMeshes[key]);
        cropMeshes[key].traverse(c => { if (c.geometry) c.geometry.dispose(); });
        delete cropMeshes[key];
    }

    // Reset tile
    tile.type = TILE.SOIL;
    tile.crop = null;
    tile.cropStage = 0;
    tile.cropTimer = 0;

    return result;
}

export function updateCrops(dt) {
    const speed = 1;

    forEachFarmTile((x, z, tile) => {
        if (tile.type !== TILE.PLANTED || !tile.crop) return;

        const crop = CROPS[tile.crop];
        if (!crop || tile.cropStage >= 3) return;

        tile.cropTimer += dt * speed;
        const stageTime = crop.growTime / 3;

        if (tile.cropTimer >= stageTime) {
            tile.cropTimer -= stageTime;
            tile.cropStage++;

            const key = cropKey(x, z);
            if (cropMeshes[key]) {
                scene.remove(cropMeshes[key]);
                cropMeshes[key].traverse(c => { if (c.geometry) c.geometry.dispose(); });
            }
            const mesh = createCropMesh(tile.crop, tile.cropStage);
            if (mesh) {
                mesh.position.set(x, 0.07, z);
                scene.add(mesh);
                cropMeshes[key] = mesh;
            }
        }
    });

    // Animate sparkles on mature crops
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
        cropMeshes[key].traverse(c => { if (c.geometry) c.geometry.dispose(); });
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
