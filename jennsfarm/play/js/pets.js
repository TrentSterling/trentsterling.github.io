// js/pets.js — a companion pet (dog or cat) that follows Jenn around, trots off
// to fetch nearby produce drops for you, and bobs happily as it runs (#48). One
// pet at a time. The drop "fetch" works with animals.js: the pet's position is
// passed into updateAnimals as a second collector, so a drop the pet reaches is
// picked up. Logic is testable; the model is a simple low-poly critter.

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { registerSystem } from './registry.js';

const SPEED = 3.6;       // pet trot speed (tiles/sec) — a touch faster than Jenn
const FETCH_RANGE = 10;  // how far the pet will range to fetch a drop
export const PET_COST = 200;

let pet = null; // { species, name, x, z, grp, bob }

function buildModel(species) {
    const g = new THREE.Group();
    const fur = species === 'cat' ? 0x9a9a9a : 0xb5763a;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.4), curvedMaterial({ color: fur }));
    body.position.y = 0.18; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.2), curvedMaterial({ color: fur }));
    head.position.set(0, 0.27, 0.26); g.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.09), curvedMaterial({ color: 0x2a2018 }));
    snout.position.set(0, 0.23, 0.38); g.add(snout);
    for (const ex of [-0.07, 0.07]) {
        const e = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 4), curvedMaterial({ color: fur }));
        e.position.set(ex, 0.39, 0.24); g.add(e);
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.18, 5), curvedMaterial({ color: fur }));
    tail.position.set(0, 0.25, -0.22); tail.rotation.x = -0.8; g.add(tail);
    for (const lx of [-0.09, 0.09]) for (const lz of [-0.13, 0.13]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 5), curvedMaterial({ color: fur }));
        l.position.set(lx, 0.08, lz); g.add(l);
    }
    g.position.set(0, 0.02, 0);
    scene.add(g);
    return g;
}

export function hasPet() { return !!pet; }
export function getPetPos() { return pet ? { x: pet.x, z: pet.z } : null; }
export function getPetName() { return pet ? pet.name : null; }

export function adoptPet(species, x, z, name) {
    if (pet) { scene.remove(pet.grp); pet.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    pet = { species: species === 'cat' ? 'cat' : 'dog', name: name || (species === 'cat' ? 'Whiskers' : 'Buddy'), x, z, grp: buildModel(species), bob: 0 };
    pet.grp.position.set(x, 0.02, z);
    return pet;
}

// Follow Jenn; detour to fetch the nearest drop within range (getNearestDrop is
// animals.js's, called from the pet's position).
export function updatePet(dt, playerPos, getNearestDrop) {
    if (!pet) return;
    let target = null;
    const d = getNearestDrop ? getNearestDrop(pet.x, pet.z) : null;
    if (d && (d.x - pet.x) ** 2 + (d.z - pet.z) ** 2 < FETCH_RANGE * FETCH_RANGE) target = d;
    if (!target && playerPos) target = { x: playerPos.x - 0.8, z: playerPos.z + 0.8 }; // heel just behind

    let moving = false;
    if (target) {
        const dx = target.x - pet.x, dz = target.z - pet.z, dist = Math.hypot(dx, dz);
        if (dist > 0.35) {
            const step = Math.min(dist, SPEED * dt);
            pet.x += (dx / dist) * step; pet.z += (dz / dist) * step;
            pet.grp.rotation.y = Math.atan2(dx, dz);
            moving = true;
        }
    }
    pet.bob += dt;
    pet.grp.position.set(pet.x, 0.02 + (moving ? Math.abs(Math.sin(pet.bob * 9)) * 0.05 : 0), pet.z);
}

// Self-register (#9): the pet follows + fetches each tick via the shared ctx.
registerSystem({ id: 'pet', update(dt, ctx) { updatePet(dt, ctx.playerPos, ctx.getNearestDrop); } });

export function serializePet() { return pet ? { species: pet.species, name: pet.name, x: pet.x, z: pet.z } : null; }
export function loadPet(d) {
    if (pet) { scene.remove(pet.grp); pet.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); pet = null; }
    if (d) adoptPet(d.species, d.x, d.z, d.name);
}
