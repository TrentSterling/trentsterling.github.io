// js/greenhouse.js — a pricey glass house (#51). While you own one, crops grow
// at full speed year-round — winter (and autumn) no longer slow them. Kept
// low-coupling: it just lifts the season-growth multiplier's floor to 1.0; main
// wraps its setSeasonGrowth calls with effectiveGrowth(). One greenhouse.

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';

const FARM_CX = 24, FARM_CZ = 24;
export const GREENHOUSE_COST = 3000;

let greenhouse = null;

function buildModel() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 1.6), curvedMaterial({ color: 0x8a6a4a }));
    base.position.y = 0.1; g.add(base);
    const glass = curvedMaterial({ color: 0xaad8ec });
    glass.transparent = true; glass.opacity = 0.4;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 1.5), glass);
    walls.position.y = 0.7; g.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.65, 4), glass);
    roof.position.y = 1.45; roof.rotation.y = Math.PI / 4; g.add(roof);
    g.position.set(FARM_CX + 7, 0.02, FARM_CZ - 4);
    scene.add(g);
    return g;
}

export function hasGreenhouse() { return !!greenhouse; }
export function buildGreenhouse() { if (greenhouse) return false; greenhouse = buildModel(); return true; }

// Crops grow at full speed year-round once a greenhouse is up.
export function effectiveGrowth(baseGrowth) { return greenhouse ? Math.max(baseGrowth, 1.0) : baseGrowth; }

export function serializeGreenhouse() { return { built: !!greenhouse }; }
export function loadGreenhouse(d) {
    const want = !!(d && d.built);
    if (want && !greenhouse) buildGreenhouse();
    else if (!want && greenhouse) {
        scene.remove(greenhouse);
        greenhouse.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        greenhouse = null;
    }
}
