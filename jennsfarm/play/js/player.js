import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { isSolidTile } from './world.js';
import { isBlockingTreeAt } from './trees.js';

function blocked(x, z) { return isSolidTile(x, z) || isBlockingTreeAt(x, z); }

let playerGroup;
let targetX = 24, targetZ = 24;
let currentX = 24, currentZ = 24;
let moving = false;
let stuckTimer = 0;
const SPEED = 5; // tiles per second
const PUSH_THROUGH = 0.7; // seconds fully pinned before you phase through a solid

export function createPlayer() {
    playerGroup = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.5, 8);
    const bodyMat = curvedMaterial({ color: 0x5b9bd5 }); // Blue shirt
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    playerGroup.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.16, 8, 6);
    const headMat = curvedMaterial({ color: 0xf5c6a0 }); // Skin
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.78;
    playerGroup.add(head);

    // Hair
    const hairGeo = new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const hairMat = curvedMaterial({ color: 0x5c3317 }); // Brown hair
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 0.82;
    playerGroup.add(hair);

    // Hat
    const brimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 8);
    const hatMat = curvedMaterial({ color: 0xc8a86e }); // Straw hat
    const brim = new THREE.Mesh(brimGeo, hatMat);
    brim.position.y = 0.92;
    playerGroup.add(brim);

    const topGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.15, 8);
    const top = new THREE.Mesh(topGeo, hatMat);
    top.position.y = 1.0;
    playerGroup.add(top);

    playerGroup.position.set(currentX, 0.07, currentZ);
    scene.add(playerGroup);

    return playerGroup;
}

export function moveTo(x, z) {
    targetX = x;
    targetZ = z;
    moving = true;
    stuckTimer = 0;
}

export function updatePlayer(dt) {
    if (!moving || !playerGroup) return;

    const dx = targetX - currentX;
    const dz = targetZ - currentZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.05) {
        currentX = targetX;
        currentZ = targetZ;
        moving = false;
    } else {
        const step = Math.min(SPEED * dt, dist);
        const mx = (dx / dist) * step;
        const mz = (dz / dist) * step;

        // Soft collision: glide through clear ground, slide along walls (avoidance),
        // but if you stay genuinely pinned and keep pushing, phase through after a beat.
        if (!blocked(currentX + mx, currentZ + mz)) {
            currentX += mx; currentZ += mz; stuckTimer = 0;
        } else if (Math.abs(mx) > 0.001 && !blocked(currentX + mx, currentZ)) {
            currentX += mx; stuckTimer = 0;                 // slide along a wall
        } else if (Math.abs(mz) > 0.001 && !blocked(currentX, currentZ + mz)) {
            currentZ += mz; stuckTimer = 0;                 // slide along a wall
        } else {
            stuckTimer += dt;                               // truly pinned
            if (stuckTimer > PUSH_THROUGH) { currentX += mx; currentZ += mz; } // push through
        }

        if (Math.hypot(targetX - currentX, targetZ - currentZ) < 0.05) { moving = false; stuckTimer = 0; }

        // Face movement direction
        if (dist > 0.1) playerGroup.rotation.y = Math.atan2(dx, dz);
    }

    playerGroup.position.x = currentX;
    playerGroup.position.z = currentZ;
    // Bob while moving, settle when stopped
    playerGroup.position.y = 0.07 + (moving ? Math.sin(performance.now() * 0.01) * 0.03 : 0);
}

export function getPlayerPos() {
    return { x: Math.round(currentX), z: Math.round(currentZ) };
}

export function getPlayerWorldPos() {
    return { x: currentX, z: currentZ };
}

export function isMoving() {
    return moving;
}

export function setPlayerPos(x, z) {
    currentX = x;
    currentZ = z;
    targetX = x;
    targetZ = z;
    moving = false;
    if (playerGroup) {
        playerGroup.position.set(x, 0.07, z);
    }
}

export function getPlayerGroup() {
    return playerGroup;
}
