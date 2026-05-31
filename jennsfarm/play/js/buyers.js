// js/buyers.js - A road runs past the farm and buyers drive by one at a time,
// stopping at the roadside stall to buy a good you're holding. Passive trickle
// income that suits the idle/animated-wallpaper vibe (Trent's idea).

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';

const ROAD_X = 31;            // just east of the shop/market
const STALL_Z = 25;           // beside the market
const Z_START = 1, Z_END = 47;
const SPEED = 3.2;            // tiles/sec
const PAUSE = 1.3;           // seconds stopped at the stall
const TRUCK_COLORS = [0x5b9bd5, 0xd56b6b, 0x6bbf6b, 0xd5b15b, 0x9b7bd5, 0xe08a4a];

let buyers = [];             // { grp, z, pause, bought }
let spawnTimer = 3;
let stall = null;

function buildTruck(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.82), curvedMaterial({ color }));
    body.position.y = 0.28; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.34), curvedMaterial({ color: 0xf0efe8 }));
    cab.position.set(0, 0.42, 0.22); g.add(cab);
    const wheelGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8);
    const wheelMat = curvedMaterial({ color: 0x18181a });
    for (const [wx, wz] of [[-0.24, 0.26], [0.24, 0.26], [-0.24, -0.26], [0.24, -0.26]]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2; w.position.set(wx, 0.1, wz); g.add(w);
    }
    return g;
}

function buildRoad() {
    if (stall) return;
    const road = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.04, Z_END - Z_START + 2),
        curvedMaterial({ color: 0x49453f })
    );
    road.position.set(ROAD_X, 0.02, (Z_START + Z_END) / 2);
    scene.add(road);
    // dashed centre line
    for (let z = Z_START; z <= Z_END; z += 2) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.7), curvedMaterial({ color: 0xd9c77a }));
        dash.position.set(ROAD_X, 0.05, z); scene.add(dash);
    }
    // roadside farm stand beside the market
    stall = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 0.5), curvedMaterial({ color: 0x9c6b3a }));
    counter.position.y = 0.25; stall.add(counter);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.07, 0.72), curvedMaterial({ color: 0xc44040 }));
    canopy.position.y = 0.72; stall.add(canopy);
    for (const px of [-0.5, 0.5]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5), curvedMaterial({ color: 0x6e4a26 }));
        post.position.set(px, 0.36, 0.3); stall.add(post);
    }
    stall.position.set(ROAD_X - 1, 0, STALL_Z);
    scene.add(stall);
}

export function initBuyers() { buildRoad(); }

function spawn() {
    const grp = buildTruck(TRUCK_COLORS[Math.floor(Math.random() * TRUCK_COLORS.length)]);
    grp.position.set(ROAD_X, 0.02, Z_START);
    scene.add(grp);
    buyers.push({ grp, z: Z_START, pause: 0, bought: false });
}

/**
 * @param dt seconds
 * @param onBuy(x,z) -> called once per buyer at the stall; should attempt a sale.
 */
export function updateBuyers(dt, onBuy) {
    // one buyer at a time: only spawn when the road is clear
    if (buyers.length === 0) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) { spawn(); spawnTimer = 7 + Math.random() * 6; }
    }

    for (let i = buyers.length - 1; i >= 0; i--) {
        const b = buyers[i];

        // Pause at the stall to buy
        if (!b.bought && Math.abs(b.z - STALL_Z) < 0.35) {
            b.pause += dt;
            if (b.pause >= PAUSE) {
                b.bought = true;
                if (onBuy) onBuy(ROAD_X - 1, STALL_Z);
            }
            continue; // hold position while paused
        }

        b.z += SPEED * dt;
        b.grp.position.z = b.z;
        if (b.z > Z_END) {
            scene.remove(b.grp);
            b.grp.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
            buyers.splice(i, 1);
        }
    }
}

export function getBuyerCount() { return buyers.length; }
