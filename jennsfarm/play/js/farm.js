import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { getTile, TILE, forEachFarmTile } from './world.js';
import { growthMult } from './buffs.js'; // meal growth buff multiplies crop growth (#50)

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
    grape: {
        name: 'Grapes', kind: 'vine',
        growTime: 70, stages: 4,
        seedItem: 'grape_seed', harvestItem: 'grape', harvestQty: 3,
        regrows: true, // vines keep fruiting
        colors: ['#8b6914', '#4a8c3f', '#3a7a2f', '#7a3f9a'],
    },
};

// Crops render as InstancedMeshes grouped by "cropId|stage" — a field of 300
// carrots is ~1 draw, not 300 (#35). Crops are static once placed, so we only
// rebuild when the planted set changes (plant/harvest/stage-up), never per frame.
let _cropIM = {};            // "cropId|stage" -> InstancedMesh of every tile at that combo
const _cropGeoCache = {};    // "cropId|stage" -> canonical merged geometry (built once)
let _cropDirty = true;       // planted set changed -> rebuild the combo batches
const _cropM4 = new THREE.Matrix4();

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

// --- Staggered crop sim (scales to huge farms) ---
// Planted tiles are processed round-robin, a batch per frame. Each advances by
// (cropClock - tile.lastTick), so a crop ticked rarely still grows correctly —
// no per-frame scan of every tile. Stale entries self-remove when processed.
let seasonGrowth = 1;
export function setSeasonGrowth(m) { seasonGrowth = m || 1; }

let cropClock = 0;
let cropCursor = 0;
const cropList = []; // [{ x, z }]
const cropSet = new Set(); // keys currently queued — prevents duplicate entries
const CROP_BATCH = 64;

function trackCrop(x, z) {
    const t = getTile(x, z);
    if (t) t.lastTick = cropClock; // (re)start its growth clock
    const key = cropKey(x, z);
    if (cropSet.has(key)) return;  // already queued — don't duplicate
    cropSet.add(key);
    cropList.push({ x, z });
}

// One shared material for every crop mesh — colour comes from baked vertex colours.
const _cropMat = curvedMaterial({ vertexColors: true });
const _ccol = new THREE.Color();

// Collapse a built crop Group (stem + fruit/petals/etc, each its own colour) into a
// SINGLE mesh with baked per-vertex colour — 1 draw per crop instead of up to ~7
// (flowers/herbs were the worst). The harvest sparkle bakes in as a bright bump.
function mergeCropGroup(group) {
    const baked = []; let total = 0;
    group.traverse(c => {
        if (!c.isMesh || !c.geometry) return;
        c.updateMatrix();
        const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        g.applyMatrix4(c.matrix);
        const col = (c.material && c.material.color) ? c.material.color : _ccol.set(0xffffff);
        baked.push({ g, r: col.r, gg: col.g, b: col.b });
        total += g.attributes.position.count;
        if (c.geometry !== g) c.geometry.dispose();
        if (c.material) c.material.dispose();
    });
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let o = 0;
    for (const b of baked) {
        const p = b.g.attributes.position, nn = b.g.attributes.normal;
        for (let i = 0; i < p.count; i++) {
            const j = (o + i) * 3;
            pos[j] = p.getX(i); pos[j + 1] = p.getY(i); pos[j + 2] = p.getZ(i);
            if (nn) { nor[j] = nn.getX(i); nor[j + 1] = nn.getY(i); nor[j + 2] = nn.getZ(i); }
            col[j] = b.r; col[j + 1] = b.gg; col[j + 2] = b.b;
        }
        o += p.count; b.g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
}

// Canonical merged geometry for one (cropId, stage), cached + reused by every tile.
function cropGeoFor(cropId, stage) {
    const k = cropId + '|' + stage;
    if (!_cropGeoCache[k]) _cropGeoCache[k] = buildCropGeo(cropId, stage);
    return _cropGeoCache[k];
}

// Rebuild the per-combo InstancedMeshes from current tile data. Cheap + only runs
// when _cropDirty (plant/harvest/stage change), coalesced to once per frame.
function rebuildCropIMs() {
    for (const k in _cropIM) { scene.remove(_cropIM[k]); _cropIM[k].dispose(); }
    _cropIM = {};
    const byCombo = {};
    forEachFarmTile((x, z, tile) => {
        if (tile.type === TILE.PLANTED && tile.crop) {
            const k = tile.crop + '|' + tile.cropStage;
            (byCombo[k] || (byCombo[k] = [])).push([x, z]);
        }
    });
    for (const k in byCombo) {
        const sep = k.lastIndexOf('|');
        const cropId = k.slice(0, sep), stage = +k.slice(sep + 1);
        const geo = cropGeoFor(cropId, stage);
        if (!geo) continue;
        const list = byCombo[k];
        const im = new THREE.InstancedMesh(geo, _cropMat, list.length);
        list.forEach(([x, z], i) => { _cropM4.makeTranslation(x, 0.07, z); im.setMatrixAt(i, _cropM4); });
        im.instanceMatrix.needsUpdate = true;
        im.frustumCulled = false; // the farm is small + central; ~1 draw per combo
        scene.add(im);
        _cropIM[k] = im;
    }
    _cropDirty = false;
}

function buildCropGeo(cropId, stage) {
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
        } else if (crop.kind === 'vine') {
            // Grapes on a little trellis post
            const trellis = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), curvedMaterial({ color: 0x9c7b4a }));
            trellis.position.y = 0.32;
            group.add(trellis);
            const grapeMat = curvedMaterial({ color });
            for (const o of [[0.06, 0.42, 0.0], [-0.05, 0.47, 0.05], [0.01, 0.34, -0.05], [0.05, 0.52, 0.03], [-0.04, 0.39, -0.04]]) {
                const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 5, 4), grapeMat);
                b.position.set(o[0], o[1], o[2]);
                group.add(b);
            }
        }

        // Sparkle indicator for harvestable
        const sparkleGeo = new THREE.SphereGeometry(0.04, 4, 4);
        const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xfff5aa, transparent: true, opacity: 0.8 });
        const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat);
        sparkle.position.y = 0.75;
        group.add(sparkle);
    }

    return mergeCropGroup(group); // one merged mesh = one draw per crop (#35)
}

// --- Public API ---

export function plantCrop(x, z, cropId) {
    const tile = getTile(x, z);
    if (!tile || tile.type !== TILE.SOIL) return false;

    tile.type = TILE.PLANTED;
    tile.crop = cropId;
    tile.cropStage = 0;
    tile.cropTimer = 0;

    _cropDirty = true; // new crop joins its combo batch on the next tick
    trackCrop(x, z);
    return true;
}

export function harvestCrop(x, z) {
    const tile = getTile(x, z);
    if (!tile || tile.type !== TILE.PLANTED || tile.cropStage < 3) return null;

    const crop = CROPS[tile.crop];
    const result = { itemId: crop.harvestItem, qty: crop.harvestQty, watered: !!tile.watered };

    if (crop.regrows) {
        // Multi-harvest: drop back to a growing stage and keep the plant
        tile.cropStage = REGROW_STAGE;
        tile.cropTimer = 0;
        result.regrew = true;
    } else {
        // One-and-done: clear back to soil
        tile.type = TILE.SOIL;
        tile.crop = null;
        tile.cropStage = 0;
        tile.cropTimer = 0;
    }
    _cropDirty = true; // combo batches rebuild without/with the changed tile

    return result;
}

export function updateCrops(dt) {
    cropClock += dt;
    if (_cropDirty) rebuildCropIMs(); // a crop was planted/harvested/grew — rebuild combo batches
    const growth = growthMult(); // a meal growth buff speeds every crop this tick (#50)

    // Process a batch of planted tiles round-robin; each catches up via clock-diff,
    // so growth is correct no matter how rarely any single crop is ticked.
    const n = Math.min(CROP_BATCH, cropList.length);
    for (let k = 0; k < n; k++) {
        if (cropCursor >= cropList.length) cropCursor = 0;
        const e = cropList[cropCursor];
        const tile = getTile(e.x, e.z);

        if (!tile || tile.type !== TILE.PLANTED || !tile.crop) {
            cropSet.delete(cropKey(e.x, e.z));
            cropList.splice(cropCursor, 1); // harvested/cleared — drop it (don't advance cursor)
            continue;
        }

        const elapsed = cropClock - (tile.lastTick || cropClock);
        tile.lastTick = cropClock;

        if (tile.waterT > 0) {
            tile.waterT -= elapsed;
            if (tile.waterT <= 0) { tile.waterT = 0; tile.watered = false; }
        }

        const crop = CROPS[tile.crop];
        if (crop && tile.cropStage < 3) {
            tile.cropTimer += elapsed * (tile.watered ? 1 : DRY_GROWTH) * seasonGrowth * growth;
            const stageTime = crop.growTime / 3;
            while (tile.cropStage < 3 && tile.cropTimer >= stageTime) { // multi-stage catch-up
                tile.cropTimer -= stageTime;
                tile.cropStage++;
                _cropDirty = true; // grew a stage -> the combo batches rebuild next tick
            }
        }
        cropCursor++;
    }

    // (crop sparkles are baked into the merged crop mesh now — no per-frame loop)
}

// Rebuild crop sim state + instanced batches from tile data (after load).
export function rebuildCropMeshes() {
    cropList.length = 0;
    cropSet.clear();
    cropCursor = 0;
    forEachFarmTile((x, z, tile) => {
        if (tile.type === TILE.PLANTED && tile.crop) trackCrop(x, z);
    });
    _cropDirty = true; // rebuild the combo InstancedMeshes from the loaded tiles
}
