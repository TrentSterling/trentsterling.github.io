// js/debug.js — on-screen debug viz to diagnose movement + perf (#55):
//   • FPS / frame-time readout (top-right)
//   • magenta cube = where the cursor's raycast hits the ground (reveals any
//     offset between the click target and the visual terrain)
//   • green cube  = the player's current move target
//   • yellow line + nodes = the active A* path
// Toggle with the backtick (`) key. Markers draw on top (depthTest off) so they
// show through terrain. Pure-ish; the suite just checks it doesn't throw.

import * as THREE from 'three';
import { scene, renderer, getGpuMs } from './renderer.js';

let on = true; // default on while we're actively debugging (backtick toggles)
let hud = null;
let mouseCube = null, targetCube = null, pathLine = null;
let frames = 0, accum = 0, fps = 0, worstMs = 0;
let cpuEMA = 0;                       // smoothed CPU work per frame (ms)
const SAMPLES = 180;                  // ~3s of frame times for the histogram
const frameLog = [];                  // ring buffer of recent frame times (ms)

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

// Frame-time histogram buckets (ms). 16.6=vsync@60, 33=30fps, 50=20fps.
const HB = [8, 12, 16, 20, 33, 50, Infinity];
const HL = ['<8', '<12', '<16', '<20', '<33', '<50', '50+'];
function histogram(s) {
    const c = new Array(HB.length).fill(0);
    for (const v of s) for (let i = 0; i < HB.length; i++) if (v < HB[i]) { c[i]++; break; }
    const max = Math.max(1, ...c), W = 10;
    return HL.map((l, i) => `${l.padStart(3)} ${'█'.repeat(Math.round(c[i] / max * W)).padEnd(W)} ${c[i]}`).join('\n');
}
function pctile(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]; }

// Feed the raw frame time + the CPU work time this frame (ms). Refreshes 2x/sec.
export function tickDebug(frameMs, cpuMs = 0) {
    frames++; accum += frameMs;
    if (frameMs > worstMs) worstMs = frameMs;        // worst (stutter) frame this window
    cpuEMA = cpuEMA * 0.9 + cpuMs * 0.1;
    frameLog.push(frameMs);
    if (frameLog.length > SAMPLES) frameLog.shift();
    if (accum < 500) return;

    fps = Math.round(frames / (accum / 1000));
    frames = 0; accum = 0;
    const spike = worstMs; worstMs = 0;
    if (!on || !hud) return;

    const sorted = [...frameLog].sort((a, b) => a - b);
    const p50 = pctile(sorted, 0.50), p95 = pctile(sorted, 0.95), p99 = pctile(sorted, 0.99);
    const gpu = getGpuMs();                            // -1 if timer-query unavailable
    const gpuStr = gpu < 0 ? 'n/a' : gpu.toFixed(1);
    // js = actual game work this frame (sum of profiled phases). If cpu (measured
    // from the vsync timestamp) is much higher than js, the gap is BROWSER overhead
    // — GC pauses, DOM/paint, canvas composite — not our game loop.
    let js = 0; for (const k in prof) js += prof[k];

    // Who's the bottleneck?
    let bound = 'ok';
    if (js > 14) bound = 'GAME-JS';                    // our code is the cost
    else if (gpu > 16) bound = 'GPU-bound';
    else if (cpuEMA > 16) bound = 'browser/GC';        // cpu high but js low → not us
    else if (p95 > 20) bound = 'vsync-edge';

    const r = renderer && renderer.info ? renderer.info : null;
    const rr = r ? r.render : null;
    const mem = r ? r.memory : null;
    let inst = 0, plain = 0, nocull = 0;
    if (scene) scene.traverse(o => {
        if (o.isInstancedMesh) { inst++; if (o.frustumCulled === false) nocull++; }
        else if (o.isMesh) { plain++; if (o.frustumCulled === false) nocull++; }
    });
    const rows = Object.entries(prof).sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k.padEnd(8)}${v.toFixed(2)}`).join('\n');

    hud.textContent =
        `FPS ${fps}   frame ${(1000 / Math.max(fps, 1)).toFixed(1)}ms\n` +
        `cpu ${cpuEMA.toFixed(1)}  js ${js.toFixed(1)}  gpu ${gpuStr}\n` +
        `[${bound}]\n` +
        `p50 ${p50.toFixed(1)} p95 ${p95.toFixed(1)} p99 ${p99.toFixed(1)} max ${spike.toFixed(0)}\n` +
        `── frame ms (${frameLog.length}f) ──\n${histogram(frameLog)}\n` +
        `── phases ms ──\n${rows}\n` +
        (rr ? `draws ${rr.calls}  tris ${(rr.triangles / 1000).toFixed(0)}k\n` : '') +
        (mem ? `geo ${mem.geometries}  tex ${mem.textures}  prog ${r.programs ? r.programs.length : '?'}\n` : '') +
        `inst ${inst}  plain ${plain}  no-cull ${nocull}`;
}
