// js/cloudshadows.js — soft drifting cloud shadows over the terrain (#43): the
// cheap "transparent layer above the ground" Trent suggested instead of a real
// light cookie. A big curved plane that follows the player with a tiling
// cloud-shadow texture scrolling slowly across it → moving dappled light, ~free.
//
// SELF-REGISTERS as a system — main.js only has to import this file once; no
// loop/save wiring. This is the mod-loader pattern in action (#9).

import * as THREE from 'three';
import { scene, applyCurvature } from './renderer.js';
import { registerSystem } from './registry.js';

const SIZE = 72;
let mesh = null, tex = null;

function makeCloudTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    for (let i = 0; i < 16; i++) {
        const x = Math.random() * 256, y = Math.random() * 256, r = 35 + Math.random() * 70;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(18,26,14,0.26)');
        g.addColorStop(1, 'rgba(18,26,14,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    return t;
}

function ensure() {
    if (mesh) return;
    tex = makeCloudTexture();
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, 8, 8);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false });
    applyCurvature(mat); // hug the rolling world (curve origin = framed point)
    mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.1;
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    scene.add(mesh);
}

export function updateCloudShadows(dt, playerPos) {
    ensure();
    if (playerPos) mesh.position.set(playerPos.x, 0.1, playerPos.z); // stay around the player
    tex.offset.x += dt * 0.012; // drift
    tex.offset.y += dt * 0.006;
}

// Self-register (#9/#43): drifts each tick off the shared ctx.
registerSystem({ id: 'cloudshadows', update(dt, ctx) { updateCloudShadows(dt, ctx.playerPos); } });
