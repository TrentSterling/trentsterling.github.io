// js/debug.js — on-screen debug viz to diagnose movement + perf (#55):
//   • FPS / frame-time readout (top-right)
//   • magenta cube = where the cursor's raycast hits the ground (reveals any
//     offset between the click target and the visual terrain)
//   • green cube  = the player's current move target
//   • yellow line + nodes = the active A* path
// Toggle with the backtick (`) key. Markers draw on top (depthTest off) so they
// show through terrain. Pure-ish; the suite just checks it doesn't throw.

import * as THREE from 'three';
import { scene, renderer } from './renderer.js';

let on = true; // default on while we're actively debugging (backtick toggles)
let hud = null;
let mouseCube = null, targetCube = null, pathLine = null;
let frames = 0, accum = 0, fps = 0, worstMs = 0;

export function isDebugOn() { return on; }

function marker(color) {
    const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.4),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthTest: false })
    );
    m.renderOrder = 999; m.visible = false;
    scene.add(m);
    return m;
}

function ensureObjects() {
    if (mouseCube) return;
    mouseCube = marker(0xff00ff);   // cursor → ground hit
    targetCube = marker(0x00ff66);  // player move target
    pathLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffe000, depthTest: false }));
    pathLine.renderOrder = 999; pathLine.visible = false;
    scene.add(pathLine);
}

export function initDebug() {
    ensureObjects();
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'debug-hud';
        hud.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99998;background:rgba(0,0,0,0.6);color:#3f8;font:12px/1.4 monospace;padding:4px 8px;border-radius:4px;pointer-events:none;white-space:pre';
        document.body.appendChild(hud);
    }
    apply();
}

export function toggleDebug() { on = !on; apply(); }
function apply() {
    ensureObjects();
    if (hud) hud.style.display = on ? 'block' : 'none';
    if (!on) { mouseCube.visible = targetCube.visible = pathLine.visible = false; }
}

export function setMouseHit(x, z) { if (on) { ensureObjects(); mouseCube.position.set(x, 0.4, z); mouseCube.visible = true; } }

export function setPlayerTarget(t) {
    if (!on) return;
    ensureObjects();
    if (t) { targetCube.position.set(t.x, 0.4, t.z); targetCube.visible = true; }
    else targetCube.visible = false;
}

export function setPath(path) {
    if (!on) return;
    ensureObjects();
    if (path && path.length) {
        pathLine.geometry.setFromPoints(path.map(p => new THREE.Vector3(p.x, 0.3, p.z)));
        pathLine.visible = true;
    } else pathLine.visible = false;
}

// --- Per-phase frame profiler (#35) ---
// gameLoop calls profBegin() once, then profMark('label') after each phase. We
// keep an exponentially-smoothed ms per label and show the breakdown in the HUD,
// so we can SEE which system eats the frame instead of guessing.
const prof = {};
let profLast = 0;
export function profBegin() { profLast = performance.now(); }
export function profMark(label) {
    const now = performance.now();
    prof[label] = (prof[label] || 0) * 0.85 + (now - profLast) * 0.15;
    profLast = now;
}
export function getProfile() { return prof; }

// Feed the raw frame time (ms); refreshes the FPS readout twice a second.
export function tickDebug(frameMs) {
    frames++; accum += frameMs;
    if (frameMs > worstMs) worstMs = frameMs; // track the worst (stutter) frame in the window
    if (accum >= 500) {
        fps = Math.round(frames / (accum / 1000));
        frames = 0; accum = 0;
        const spike = worstMs; worstMs = 0;
        if (on && hud) {
            const rows = Object.entries(prof)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => `${k.padEnd(9)}${v.toFixed(2)}`)
                .join('\n');
            const r = renderer && renderer.info ? renderer.info.render : null;
            const draws = r ? `\ndraws ${r.calls}\ntris ${(r.triangles / 1000).toFixed(0)}k` : '';
            // Audit: how many instanced batches vs plain meshes are in the scene?
            // (plain meshes = the un-instanced draw spam we want to hunt down)
            let inst = 0, plain = 0;
            if (scene) scene.traverse(o => { if (o.isInstancedMesh) inst++; else if (o.isMesh) plain++; });
            const aud = `\ninstMesh ${inst}\nplainMesh ${plain}\nworst ${spike.toFixed(1)}ms`;
            hud.textContent = `FPS ${fps}   ${(1000 / Math.max(fps, 1)).toFixed(1)}ms\n${rows}${draws}${aud}`;
        }
    }
}
