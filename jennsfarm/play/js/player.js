import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';
import { isSolidTile } from './world.js';
import { isBlockingTreeAt } from './trees.js';

function blocked(x, z) { return isSolidTile(x, z) || isBlockingTreeAt(x, z); }

let playerGroup;
let heldGroup; // tool shown in Jenn's hand, swaps with the selected tool
let targetX = 24, targetZ = 24;
let currentX = 24, currentZ = 24;
let moving = false;
let stuckTimer = 0;
let path = null, pathIdx = 0; // optional A* waypoint queue (route around obstacles)
let bodyMesh, ponytail; // for gender appearance
let gender = 'girl';
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
    bodyMesh = body;

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

    // Ponytail (shown for the girl variant) at the back of the head
    ponytail = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), curvedMaterial({ color: 0x6b3f1e }));
    ponytail.scale.set(1, 1.8, 1);
    ponytail.position.set(0, 0.72, -0.15);
    playerGroup.add(ponytail);
    setPlayerGender(gender); // apply current appearance

    // Hand anchor for the held tool (front-right of the player)
    heldGroup = new THREE.Group();
    heldGroup.position.set(0.2, 0.42, 0.16);
    playerGroup.add(heldGroup);

    playerGroup.position.set(currentX, 0.07, currentZ);
    scene.add(playerGroup);

    return playerGroup;
}

// Build a small in-hand tool model for the given hotbar tool id
function buildHeldTool(toolId) {
    const g = new THREE.Group();
    const add = (geo, color, x, y, z, rx, rz) => {
        const m = new THREE.Mesh(geo, curvedMaterial({ color }));
        m.position.set(x, y, z);
        if (rx) m.rotation.x = rx;
        if (rz) m.rotation.z = rz;
        g.add(m);
    };
    if (toolId === 'water') {
        add(new THREE.BoxGeometry(0.16, 0.14, 0.14), 0x5b9bd5, 0, 0, 0);          // can body
        add(new THREE.CylinderGeometry(0.015, 0.03, 0.18, 5), 0x5588bb, 0.12, 0.05, 0, 0, -0.9); // spout
        add(new THREE.TorusGeometry(0.05, 0.012, 4, 8), 0x4477aa, 0, 0.1, 0, Math.PI / 2); // handle
    } else if (toolId === 'hoe') {
        add(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 5), 0x8b6914, 0, 0.05, 0, 0, 0.4); // shaft
        add(new THREE.BoxGeometry(0.03, 0.02, 0.1), 0x9a9a9a, 0.16, 0.22, 0);                 // head
    } else if (toolId === 'axe') {
        add(new THREE.CylinderGeometry(0.014, 0.014, 0.4, 5), 0x7a5320, 0, 0.05, 0, 0, 0.35); // handle
        add(new THREE.BoxGeometry(0.02, 0.1, 0.12), 0xb8b8c0, 0.15, 0.2, 0);                  // blade
    } else if (toolId === 'sprinkler') {
        add(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 6), 0x6b7886, 0, 0, 0);
        add(new THREE.SphereGeometry(0.05, 6, 5), 0x3f8fd0, 0, 0.1, 0);
    } else if (toolId === 'hand') {
        add(new THREE.TorusGeometry(0.08, 0.02, 4, 10), 0xb8924a, 0, 0, 0, Math.PI / 2);       // a little basket hoop
        add(new THREE.CylinderGeometry(0.08, 0.06, 0.08, 8), 0xc8a86e, 0, -0.04, 0);
    } else if (toolId && toolId.endsWith('_seed')) {
        add(new THREE.BoxGeometry(0.1, 0.12, 0.06), 0xb58a4a, 0, 0, 0);                        // seed pouch
    } else {
        return null; // 'move' / unknown — empty hands
    }
    return g;
}

export function setPlayerGender(g) {
    gender = (g === 'boy') ? 'boy' : 'girl';
    if (bodyMesh) bodyMesh.material.color.set(gender === 'boy' ? 0x5b9bd5 : 0xe0699a); // blue vs rose shirt
    if (ponytail) ponytail.visible = (gender === 'girl');
}

export function setHeldTool(toolId) {
    if (!heldGroup) return;
    while (heldGroup.children.length) {
        const c = heldGroup.children[0];
        heldGroup.remove(c);
        c.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
    const tool = buildHeldTool(toolId);
    if (tool) heldGroup.add(tool);
}

// Walk straight to a tile (soft collision handles the rest). Clears any path.
export function moveTo(x, z) {
    targetX = x;
    targetZ = z;
    path = null;
    moving = true;
    stuckTimer = 0;
}

// Follow an A* route (array of {x,z} waypoints) so Jenn rounds obstacles.
export function moveAlong(waypoints) {
    if (!waypoints || !waypoints.length) return;
    path = waypoints;
    pathIdx = 0;
    targetX = waypoints[0].x;
    targetZ = waypoints[0].z;
    moving = true;
    stuckTimer = 0;
}

// Advance to the next waypoint; returns false when the route is finished.
function advanceWaypoint() {
    if (path && pathIdx < path.length - 1) {
        pathIdx++;
        targetX = path[pathIdx].x;
        targetZ = path[pathIdx].z;
        stuckTimer = 0;
        return true;
    }
    path = null;
    return false;
}

export function updatePlayer(dt) {
    if (!moving || !playerGroup) return;

    const dx = targetX - currentX;
    const dz = targetZ - currentZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.05) {
        currentX = targetX;
        currentZ = targetZ;
        if (!advanceWaypoint()) moving = false;   // reached final waypoint
    } else {
        const step = Math.min(SPEED * dt, dist);
        const mx = (dx / dist) * step;
        const mz = (dz / dist) * step;

        // Soft collision: glide through clear ground, slide along walls (avoidance),
        // but if you stay genuinely pinned and keep pushing, phase through after a beat.
        // (A* already routes around static solids; this just handles dynamic nudges.)
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

        if (Math.hypot(targetX - currentX, targetZ - currentZ) < 0.05) {
            currentX = targetX; currentZ = targetZ;
            if (!advanceWaypoint()) { moving = false; stuckTimer = 0; }
        }

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
    path = null;
    moving = false;
    if (playerGroup) {
        playerGroup.position.set(x, 0.07, z);
    }
}

export function getPlayerGroup() {
    return playerGroup;
}
