// js/placement.js — unified "build mode" for purchasable structures (beehives,
// coops, decor…). Buying one enters placement mode: a translucent footprint ghost
// follows the cursor, green where it can go and red where it can't. Left-click
// drops it (and re-arms for another if you can afford it); ESC / right-click
// cancels. Replaces the old "auto-place at a random spot" behaviour (#36 follow-up).

import * as THREE from 'three';
import { scene } from './renderer.js';

// active = { kind, ghost, valid, rot }
// kind: { id, name, cost, footprint, canPlace(x,z)->bool, place(x,z,rot)->void,
//         afford()->bool, onExit?() }
let active = null;

export function isPlacing() { return !!active; }
export function placingName() { return active ? active.kind.name : null; }

// Spin the prop a quarter-turn (Sims-style). Re-render the ghost rotation.
export function rotatePlacement() {
    if (!active) return;
    active.rot = (active.rot + Math.PI / 2) % (Math.PI * 2);
    active.ghost.rotation.y = active.rot;
}

const _ghostMat = new THREE.MeshBasicMaterial({ color: 0x6cff6c, transparent: true, opacity: 0.32, depthWrite: false });
const _ghostBad = new THREE.MeshBasicMaterial({ color: 0xff5555, transparent: true, opacity: 0.32, depthWrite: false });

export function beginPlacement(kind) {
    cancelPlacement();
    let g;
    if (kind.preview) {
        // Real-model ghost: build the actual structure, then strip its materials to a
        // translucent green/red silhouette so you see the true shape before placing (#36 polish).
        g = kind.preview();
        g.traverse(o => { if (o.isMesh) { if (o.material && o.material.dispose) o.material.dispose(); o.material = _ghostMat; } });
        // a faint footprint pad under it so the placement spot reads clearly
        const f = kind.footprint || 0.9;
        const pad = new THREE.Mesh(new THREE.BoxGeometry(f, 0.04, f), _ghostMat);
        pad.position.y = 0.02; g.add(pad);
    } else {
        const f = kind.footprint || 0.9;
        g = new THREE.Group();
        const pad = new THREE.Mesh(new THREE.BoxGeometry(f, 0.06, f), _ghostMat);
        pad.position.y = 0.05; g.add(pad);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, f * 0.9, 6), _ghostMat);
        post.position.y = f * 0.55; g.add(post);
        const knob = new THREE.Mesh(new THREE.BoxGeometry(f * 0.5, f * 0.5, f * 0.5), _ghostMat);
        knob.position.y = f; g.add(knob);
    }
    scene.add(g);
    active = { kind, ghost: g, valid: false, rot: 0 };
}

// Slide the ghost to the hovered tile and recolour by validity.
export function moveGhost(x, z) {
    if (!active) return;
    active.ghost.position.set(x, 0.02, z);
    const ok = active.kind.canPlace(x, z) && active.kind.afford();
    active.valid = ok;
    const mat = ok ? _ghostMat : _ghostBad;
    active.ghost.traverse(o => { if (o.isMesh) o.material = mat; });
}

// Try to drop the structure here. Returns 'placed' | 'invalid' | 'done'
// ('done' = placed but can no longer afford another, so build mode ended).
export function confirmPlace(x, z) {
    if (!active) return 'invalid';
    if (!active.kind.canPlace(x, z) || !active.kind.afford()) return 'invalid';
    active.kind.place(x, z, active.rot);
    // Stay in build mode for rapid multi-placement, but bail if broke now.
    if (!active.kind.afford()) { cancelPlacement(); return 'done'; }
    return 'placed';
}

export function cancelPlacement() {
    if (!active) return;
    const onExit = active.kind.onExit;
    scene.remove(active.ghost);
    active.ghost.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    active = null;
    if (onExit) onExit();
}
