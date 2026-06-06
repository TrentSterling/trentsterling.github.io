// js/animals.js - Livestock, wildlife & NPCs with low-poly models and simple AI.
//  - Livestock (chicken/cow/goat): wander the farm, drop produce you collect.
//  - Wildlife (crow/skunk/ocelot): ambient life. Skunks chase crows; crows flee.
//  - NPC (grandpa): wanders near the cottage and chatters.

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { createSpatialHash } from './spatialhash.js';

const FARM_CX = 24, FARM_CZ = 24;
const PERCEPTION = 18;                  // how far an animal notices others (tiles)
const animalHash = createSpatialHash(6); // rebuilt each frame for fast nearest-queries
const FEED_DECAY = 1 / 600;             // hunger drains to empty over ~600s of play

// Production speed multiplier from how fed an animal is: well fed → full speed,
// starving → half speed (never zero, so the game stays cosy). #23
export function fedRate(fed) {
    const f = (typeof fed === 'number') ? Math.max(0, Math.min(1, fed)) : 1;
    return 0.5 + 0.5 * f;
}

// --- Definitions ---
export const ANIMALS = {
    chicken: { name: 'Chicken', kind: 'livestock', cost: 120, produce: 'egg',       every: 16, speed: 1.2 },
    rooster: { name: 'Rooster', kind: 'livestock', cost: 160,                        every: 0,  speed: 1.3 },
    goat:    { name: 'Goat',    kind: 'livestock', cost: 460, produce: 'goat_milk',  every: 24, speed: 1.0 },
    cow:     { name: 'Cow',     kind: 'livestock', cost: 680, produce: 'cow_milk',   every: 32, speed: 0.8 },
};

let animals = [];   // {species, kind, grp, x, z, tx, tz, idle, prodT, speed, flee}
let drops = [];     // {item, grp, x, z, baseY, t}

// --- Model builders (low-poly, flat-shaded-ish via curved Lambert) ---

// One shared material for every animal — colour comes from baked vertex colours.
const _animMat = curvedMaterial({ vertexColors: true });
const _amC = new THREE.Color();

// Bake a built model Group (parts each with their own colour/rotation/scale) into
// ONE mesh carrying per-vertex colour — 1 draw call per animal instead of 5-10 (#35).
function mergeGroup(group) {
    const baked = [];
    let total = 0;
    group.traverse(c => {
        if (!c.isMesh || !c.geometry) return;
        c.updateMatrix(); // local transform from position/rotation/scale
        const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        g.applyMatrix4(c.matrix);
        const col = (c.material && c.material.color) ? c.material.color : _amC.set(0xcccccc);
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
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return new THREE.Mesh(merged, _animMat);
}

function part(geo, color, parent, x, y, z) {
    const m = new THREE.Mesh(geo, curvedMaterial({ color }));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
}

function buildModel(species) {
    const g = new THREE.Group();
    switch (species) {
        case 'chicken': {
            part(new THREE.SphereGeometry(0.16, 8, 6), 0xf4f4ee, g, 0, 0.18, 0);          // body
            part(new THREE.SphereGeometry(0.1, 8, 6), 0xf8f8f2, g, 0, 0.34, 0.1);         // head
            part(new THREE.ConeGeometry(0.04, 0.08, 4), 0xf2a23a, g, 0, 0.34, 0.2).rotation.x = Math.PI / 2; // beak
            part(new THREE.BoxGeometry(0.06, 0.05, 0.02), 0xd6342a, g, 0, 0.42, 0.08);    // comb
            part(new THREE.BoxGeometry(0.18, 0.02, 0.14), 0xf4f4ee, g, 0, 0.18, -0.12);   // tail
            break;
        }
        case 'rooster': {
            part(new THREE.SphereGeometry(0.18, 8, 6), 0xc9803a, g, 0, 0.2, 0);
            part(new THREE.SphereGeometry(0.11, 8, 6), 0xd68b3f, g, 0, 0.38, 0.1);
            part(new THREE.ConeGeometry(0.04, 0.08, 4), 0xf2c21b, g, 0, 0.38, 0.21).rotation.x = Math.PI / 2;
            part(new THREE.BoxGeometry(0.08, 0.07, 0.02), 0xd62f2a, g, 0, 0.48, 0.08);    // big comb
            const tail = part(new THREE.ConeGeometry(0.12, 0.3, 5), 0x2f6f3a, g, 0, 0.3, -0.18);
            tail.rotation.x = -0.9;
            break;
        }
        case 'goat': {
            part(new THREE.BoxGeometry(0.34, 0.26, 0.5), 0xe7e2d6, g, 0, 0.34, 0);        // body
            part(new THREE.BoxGeometry(0.2, 0.2, 0.2), 0xeee9dd, g, 0, 0.42, 0.32);       // head
            part(new THREE.ConeGeometry(0.04, 0.14, 4), 0x9b8a6a, g, 0.06, 0.56, 0.32).rotation.x = -0.4; // horn
            part(new THREE.ConeGeometry(0.04, 0.14, 4), 0x9b8a6a, g, -0.06, 0.56, 0.32).rotation.x = -0.4;
            for (const lx of [-0.12, 0.12]) for (const lz of [-0.16, 0.16])
                part(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 5), 0xcfcabd, g, lx, 0.11, lz);
            break;
        }
        case 'cow': {
            part(new THREE.BoxGeometry(0.46, 0.34, 0.66), 0xf3f0ea, g, 0, 0.42, 0);       // body
            part(new THREE.BoxGeometry(0.16, 0.14, 0.3), 0x2b241c, g, 0.12, 0.46, 0.1);   // brown patch
            part(new THREE.BoxGeometry(0.24, 0.22, 0.22), 0xf6f3ee, g, 0, 0.5, 0.42);     // head
            part(new THREE.BoxGeometry(0.14, 0.1, 0.06), 0xe9a9a0, g, 0, 0.44, 0.54);     // snout
            for (const lx of [-0.16, 0.16]) for (const lz of [-0.22, 0.22])
                part(new THREE.CylinderGeometry(0.06, 0.06, 0.28, 5), 0xe8e4dc, g, lx, 0.14, lz);
            break;
        }
        case 'crow': {
            part(new THREE.SphereGeometry(0.12, 7, 5), 0x1c1c24, g, 0, 0.16, 0);
            part(new THREE.SphereGeometry(0.08, 7, 5), 0x24242e, g, 0, 0.28, 0.08);
            part(new THREE.ConeGeometry(0.03, 0.1, 4), 0xf2c21b, g, 0, 0.28, 0.18).rotation.x = Math.PI / 2;
            break;
        }
        case 'skunk': {
            part(new THREE.SphereGeometry(0.16, 8, 6), 0x16161c, g, 0, 0.16, 0);          // body
            part(new THREE.BoxGeometry(0.06, 0.06, 0.42), 0xf5f5f5, g, 0, 0.27, -0.02);   // white stripe
            part(new THREE.SphereGeometry(0.1, 8, 6), 0x16161c, g, 0, 0.2, 0.18);         // head
            const tail = part(new THREE.SphereGeometry(0.16, 8, 6), 0x111118, g, 0, 0.34, -0.22);
            tail.scale.set(0.7, 1.4, 0.7);
            part(new THREE.SphereGeometry(0.08, 6, 5), 0xf5f5f5, g, 0, 0.46, -0.24);      // white tail tip
            break;
        }
        case 'ocelot': {
            part(new THREE.BoxGeometry(0.22, 0.2, 0.46), 0xd9a45a, g, 0, 0.24, 0);        // body
            part(new THREE.SphereGeometry(0.13, 8, 6), 0xe0ad63, g, 0, 0.32, 0.26);       // head
            part(new THREE.ConeGeometry(0.05, 0.1, 4), 0xc98f45, g, -0.06, 0.44, 0.26);   // ear
            part(new THREE.ConeGeometry(0.05, 0.1, 4), 0xc98f45, g, 0.06, 0.44, 0.26);    // ear
            const tail = part(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 5), 0xc98f45, g, 0, 0.34, -0.28);
            tail.rotation.x = -0.7;
            for (const lx of [-0.08, 0.08]) for (const lz of [-0.14, 0.14])
                part(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 5), 0xcf9a50, g, lx, 0.1, lz);
            break;
        }
        case 'honey_badger': {
            // Honey badger don't care. Stocky, dark, pale stripe down the back.
            part(new THREE.BoxGeometry(0.26, 0.18, 0.52), 0x161616, g, 0, 0.16, 0);      // body
            part(new THREE.BoxGeometry(0.28, 0.07, 0.48), 0xdedacb, g, 0, 0.27, -0.02);  // pale back stripe
            part(new THREE.SphereGeometry(0.12, 8, 6), 0x202020, g, 0, 0.2, 0.3);        // head
            part(new THREE.BoxGeometry(0.16, 0.05, 0.1), 0xdedacb, g, 0, 0.28, 0.3);     // pale crown
            const tail = part(new THREE.SphereGeometry(0.08, 6, 5), 0x161616, g, 0, 0.2, -0.3);
            tail.scale.set(0.8, 0.8, 1.5);
            for (const lx of [-0.1, 0.1]) for (const lz of [-0.17, 0.17])
                part(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 5), 0x111111, g, lx, 0.07, lz); // stubby legs
            break;
        }
        case 'possum': {
            part(new THREE.SphereGeometry(0.15, 8, 6), 0xb8b2a6, g, 0, 0.16, 0);            // grey body
            part(new THREE.SphereGeometry(0.1, 8, 6), 0xe8e2d6, g, 0, 0.2, 0.18);           // pale head
            part(new THREE.ConeGeometry(0.04, 0.12, 5), 0xf0a0b0, g, 0, 0.19, 0.31).rotation.x = Math.PI / 2; // pink snout
            part(new THREE.ConeGeometry(0.04, 0.07, 4), 0x2a2a2a, g, -0.06, 0.3, 0.16);     // ears
            part(new THREE.ConeGeometry(0.04, 0.07, 4), 0x2a2a2a, g, 0.06, 0.3, 0.16);
            const ptail = part(new THREE.CylinderGeometry(0.015, 0.03, 0.32, 5), 0xf0a0b0, g, 0, 0.18, -0.24); // pink rat tail
            ptail.rotation.x = 0.6;
            break;
        }
        case 'grandpa': {
            part(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 8), 0x5a7d4a, g, 0, 0.4, 0);  // overalls
            part(new THREE.SphereGeometry(0.15, 8, 6), 0xf0c49a, g, 0, 0.78, 0);          // head
            part(new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), 0xe8e8e8, g, 0, 0.7, 0.06); // beard
            part(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 8), 0x9c7b4a, g, 0, 0.9, 0);  // hat brim
            part(new THREE.CylinderGeometry(0.12, 0.14, 0.14, 8), 0x9c7b4a, g, 0, 0.98, 0); // hat top
            break;
        }
        default:
            part(new THREE.SphereGeometry(0.15, 8, 6), 0xcccccc, g, 0, 0.2, 0);
    }
    return mergeGroup(g); // collapse the parts into a single-draw mesh (#35)
}

// --- Spawning ---

function spawn(species, x, z) {
    const def = ANIMALS[species] || {};
    const grp = buildModel(species);
    grp.position.set(x, 0.02, z);
    scene.add(grp);
    animals.push({
        species, kind: def.kind || (species === 'grandpa' ? 'npc' : 'wildlife'),
        grp, x, z, tx: x, tz: z, idle: Math.random() * 3,
        prodT: def.every || 0, speed: def.speed || 1.2, flee: false, hop: 0,
        fed: 1, // 1 = well fed (full production), drains over time (#23)
        home: { x, z }, range: species === 'grandpa' ? 4 : (def.kind === 'livestock' ? 6 : 11),
    });
}

export function buyAnimalEntity(species) {
    // Spawn near barn-ish area inside the farm
    const x = FARM_CX + (Math.random() * 6 - 3);
    const z = FARM_CZ + (Math.random() * 6 - 3);
    spawn(species, x, z);
}

function clearAll() {
    const dump = o => o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material !== _animMat) c.material.dispose(); });
    for (const a of animals) { scene.remove(a.grp); dump(a.grp); }
    for (const d of drops) { scene.remove(d.grp); dump(d.grp); }
    animals = [];
    drops = [];
}

export function initAnimals(withStarter = true) {
    clearAll(); // start fresh (also prevents double-spawn if ever re-inited)
    // A crow right here + Grandpa so the world reads as alive immediately
    spawn('crow', FARM_CX - 6, FARM_CZ + 7);
    spawn('grandpa', FARM_CX + 3, FARM_CZ - 6);

    // Wifey wants critters EVERYWHERE — scatter a lively wild population in a ring
    // around the farm (skunks especially, per direct request).
    const scatter = (species, n, near, far) => {
        for (let i = 0; i < n; i++) {
            const ang = Math.random() * Math.PI * 2;
            const r = near + Math.random() * (far - near);
            spawn(species, FARM_CX + Math.cos(ang) * r, FARM_CZ + Math.sin(ang) * r);
        }
    };
    // SKUNKS. Wifey's favourite — she asked FIVE times. A big visible row right in
    // front of the camera + a whole swarm all around. ~20 of them.
    for (let i = 0; i < 8; i++) spawn('skunk', FARM_CX - 10 + i * 3, FARM_CZ - 6 - (i % 2) * 3);
    scatter('skunk', 12, 5, 20);         // even more skunks, every direction
    scatter('possum', 5, 7, 22);         // possums too! 🐀
    scatter('crow', 7, 8, 26);
    scatter('ocelot', 4, 8, 24);
    scatter('honey_badger', 2, 12, 26);  // fewer chasers so the skunks linger to be admired

    // A starter chicken so players meet the produce loop immediately (fresh game only)
    if (withStarter) spawn('chicken', FARM_CX + 1, FARM_CZ + 1);
}

// --- Drops ---

function makeDrop(item, x, z) {
    const grp = new THREE.Group();
    if (item === 'egg') {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), curvedMaterial({ color: 0xfff6e0 }));
        e.scale.set(1, 1.3, 1); grp.add(e);
    } else {
        // milk bucket
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.16, 8), curvedMaterial({ color: 0xcdd2d6 }));
        grp.add(b);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 8), curvedMaterial({ color: 0xffffff }));
        m.position.y = 0.08; grp.add(m);
    }
    grp.position.set(x, 0.2, z);
    scene.add(grp);
    drops.push({ item, grp, x, z, baseY: 0.2, t: Math.random() * 6 });
}

// --- Update loop ---

// Nearest animal of a species within perception range, via the spatial hash —
// scales with local density, not the whole population (#40).
function nearestOf(a, species) {
    const best = animalHash.nearest(a.x, a.z, PERCEPTION, o => o !== a && o.species === species);
    return { best, dist: best ? Math.hypot(best.x - a.x, best.z - a.z) : Infinity };
}

// How a wildlife species reacts to Jenn nearby. Returns a move target
// {tx,tz,flee} or null (ignore her). Pure + exported so it's unit-testable.
//  - crow: skittish, bolts away   - ocelot: curious, pads toward her
//  - skunk: chill unless you're right on top of it   - honey badger: don't care
export function playerReaction(species, ax, az, px, pz) {
    const dx = ax - px, dz = az - pz, dist = Math.hypot(dx, dz) || 0.0001;
    if (species === 'crow' && dist < 6) {
        return { tx: ax + (dx / dist) * 5, tz: az + (dz / dist) * 5, flee: true };
    }
    if (species === 'skunk' && dist < 2.5) {
        return { tx: ax + (dx / dist) * 3, tz: az + (dz / dist) * 3, flee: true };
    }
    if (species === 'ocelot' && dist < 9 && dist > 2.5) {
        return { tx: px, tz: pz, flee: false };
    }
    return null; // honey badger don't care; distant / other animals carry on
}

export function updateAnimals(dt, playerPos, onCollect, petPos) {
    const now = performance.now();

    // Rebuild the spatial index for this frame's nearest-queries (cheap, O(n))
    animalHash.clear();
    for (const a of animals) animalHash.insert(a, a.x, a.z);

    for (const a of animals) {
        // --- Behaviour: choose target ---
        // Jenn's presence comes first: skittish critters scatter, curious ones approach.
        let reacted = false;
        if (playerPos && a.kind === 'wildlife') {
            const r = playerReaction(a.species, a.x, a.z, playerPos.x, playerPos.z);
            if (r) { a.tx = r.tx; a.tz = r.tz; a.flee = r.flee; a.idle = 0; reacted = true; }
        }
        if (!reacted && a.species === 'honey_badger') {
            // Don't care. Relentlessly chase the nearest skunk; otherwise roam bold.
            const { best } = nearestOf(a, 'skunk');
            if (best) { a.tx = best.x; a.tz = best.z; a.idle = 0; }
        } else if (!reacted && a.species === 'skunk') {
            const badger = nearestOf(a, 'honey_badger');
            if (badger.best && badger.dist < 5) {
                // a honey badger is coming - even the skunk flees
                const dx = a.x - badger.best.x, dz = a.z - badger.best.z, d = Math.hypot(dx, dz) || 1;
                a.tx = a.x + (dx / d) * 4; a.tz = a.z + (dz / d) * 4;
                a.flee = true; a.idle = 0;
            } else {
                a.flee = false;
                const { best } = nearestOf(a, 'crow');
                if (best) { a.tx = best.x; a.tz = best.z; a.idle = 0; }
            }
        } else if (!reacted && a.species === 'crow') {
            const { best, dist } = nearestOf(a, 'skunk');
            if (best && dist < 6) {
                // flee directly away from the skunk
                const dx = a.x - best.x, dz = a.z - best.z, d = Math.hypot(dx, dz) || 1;
                a.tx = a.x + (dx / d) * 4; a.tz = a.z + (dz / d) * 4;
                a.flee = true; a.idle = 0;
            } else {
                a.flee = false;
            }
        }

        // --- Wander when no target / arrived ---
        const arrived = Math.hypot(a.tx - a.x, a.tz - a.z) < 0.15;
        if (arrived && a.species !== 'skunk') {
            a.idle -= dt;
            if (a.idle <= 0) {
                a.tx = a.home.x + (Math.random() * 2 - 1) * a.range;
                a.tz = a.home.z + (Math.random() * 2 - 1) * a.range;
                a.idle = 1 + Math.random() * 3;
            }
        }

        // --- Move ---
        const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
        if (d > 0.05) {
            const spd = a.speed * (a.flee ? 1.8 : 1) * dt;
            const step = Math.min(d, spd);
            a.x += (dx / d) * step;
            a.z += (dz / d) * step;
            a.grp.rotation.y = Math.atan2(dx, dz);
        }
        a.grp.position.x = a.x;
        a.grp.position.z = a.z;
        // little hop/bob
        const bob = a.kind === 'livestock' || a.species === 'crow' ? 0.04 : 0.02;
        a.grp.position.y = 0.02 + Math.abs(Math.sin(now * 0.006 + a.x)) * bob;
        // Happy hop when petted
        if (a.hop > 0) {
            a.hop -= dt;
            a.grp.position.y += Math.sin(Math.max(0, a.hop) / 0.45 * Math.PI) * 0.28;
        }

        // --- Hunger + produce ---
        if (a.kind === 'livestock') {
            a.fed = Math.max(0, a.fed - FEED_DECAY * dt); // gets hungry over time
            if (a.prodT > 0 && ANIMALS[a.species] && ANIMALS[a.species].produce) {
                a.prodT -= dt * fedRate(a.fed); // hungry animals produce slower (never stop)
                if (a.prodT <= 0) {
                    a.prodT = ANIMALS[a.species].every;
                    makeDrop(ANIMALS[a.species].produce, a.x, a.z);
                }
            }
        }
    }

    // --- Drops: bob + collect when player walks near ---
    for (let i = drops.length - 1; i >= 0; i--) {
        const dp = drops[i];
        dp.t += dt;
        dp.grp.position.y = dp.baseY + Math.sin(dp.t * 3) * 0.05;
        dp.grp.rotation.y += dt * 1.5;
        const nearPlayer = playerPos && Math.hypot(dp.x - playerPos.x, dp.z - playerPos.z) < 1.2;
        const nearPet = petPos && Math.hypot(dp.x - petPos.x, dp.z - petPos.z) < 1.0; // the pet fetches drops too
        if (nearPlayer || nearPet) {
            scene.remove(dp.grp);
            dp.grp.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
            drops.splice(i, 1);
            if (onCollect) onCollect(dp.item, 1);
        }
    }
}

// --- Save / load ---

export function serializeAnimals() {
    return animals
        .filter(a => a.kind === 'livestock')
        .map(a => ({ s: a.species, x: a.x, z: a.z, fed: a.fed }));
}

export function loadAnimals(data) {
    if (!data) return;
    for (const d of data) {
        spawn(d.s, d.x, d.z);
        if (typeof d.fed === 'number') animals[animals.length - 1].fed = d.fed;
    }
}

/** Nearest uncollected produce drop (egg/milk) to a point, for AFK collecting. */
/** Pet the nearest (non-grandpa) animal to a point — makes it hop happily. */
export function petNearest(x, z) {
    let best = null, bd = 1.3 * 1.3;
    for (const a of animals) {
        if (a.species === 'grandpa') continue;
        const d = (a.x - x) ** 2 + (a.z - z) ** 2;
        if (d < bd) { bd = d; best = a; }
    }
    if (!best) return null;
    best.hop = 0.45;
    return { species: best.species, x: best.x, z: best.z };
}

// Feed the nearest livestock to (x,z): tops its hunger back to full. Returns the
// animal {species,x,z} or null if none is close enough. #23
export function feedNearest(x, z) {
    let best = null, bd = 1.6 * 1.6;
    for (const a of animals) {
        if (a.kind !== 'livestock') continue;
        const d = (a.x - x) ** 2 + (a.z - z) ** 2;
        if (d < bd) { bd = d; best = a; }
    }
    if (!best) return null;
    best.fed = 1;
    best.hop = 0.45;
    return { species: best.species, x: best.x, z: best.z };
}

export function getFedLevel(species) {
    const a = animals.find(o => o.species === species);
    return a ? a.fed : null;
}

export function getLivestock() {
    return animals.filter(a => a.kind === 'livestock').map(a => ({ species: a.species, x: a.x, z: a.z, fed: a.fed }));
}

export function getNearestDrop(x, z) {
    let best = null, bd = Infinity;
    for (const d of drops) {
        const dd = (d.x - x) ** 2 + (d.z - z) ** 2;
        if (dd < bd) { bd = dd; best = d; }
    }
    return best ? { x: best.x, z: best.z } : null;
}

export function getLivestockCount() {
    return animals.filter(a => a.kind === 'livestock').length;
}

// Pests a carnivorous plant may eat. Skunks are SACRED and never on this list (#58).
const PESTS = ['crow'];

// Eat (despawn) the nearest pest within range of (x,z). Returns {species,x,z} or
// null. Will NEVER target a skunk — they're not pests, they're beloved.
export function eatNearestPest(x, z, range = 3) {
    let idx = -1, bd = range * range;
    for (let i = 0; i < animals.length; i++) {
        const a = animals[i];
        if (!PESTS.includes(a.species)) continue;
        const d = (a.x - x) ** 2 + (a.z - z) ** 2;
        if (d < bd) { bd = d; idx = i; }
    }
    if (idx < 0) return null;
    const a = animals[idx];
    scene.remove(a.grp);
    a.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    animals.splice(idx, 1);
    return { species: a.species, x: a.x, z: a.z };
}

export function getAnimalCount() { return animals.length; }
export function getSpeciesCount(species) { return animals.filter(a => a.species === species).length; }

/** Produce each livestock would have made over `seconds` away (capped per animal). */
export function creditOfflineProduce(seconds) {
    const out = {};
    for (const a of animals) {
        const def = ANIMALS[a.species];
        if (!def || !def.produce || !def.every) continue;
        const n = Math.min(Math.floor(seconds / def.every), 30); // cap so a long absence can't flood
        if (n > 0) out[def.produce] = (out[def.produce] || 0) + n;
    }
    return out;
}

export function getGrandpaPos() {
    const g = animals.find(a => a.species === 'grandpa');
    return g ? { x: g.x, z: g.z } : null;
}
