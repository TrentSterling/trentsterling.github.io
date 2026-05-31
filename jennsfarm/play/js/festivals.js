// js/festivals.js — each season opens with a little festival (#52): a string of
// festive bunting goes up in the season's colours and Grandpa gives a gift. Pure
// festival data + a bunting model; main calls startFestival on season change /
// load. No new menu (keeping the UI uncluttered).

import * as THREE from 'three';
import { scene, curvedMaterial } from './renderer.js';

const FEST = {
    Spring: { name: 'Spring Seed Fair',    emoji: '🌷', colors: [0xff9bc4, 0x9be88a, 0xfff0a0], gift: 80 },
    Summer: { name: 'Summer Night Market', emoji: '🏮', colors: [0xff6b4a, 0xffd24a, 0x4aa3d8], gift: 120 },
    Autumn: { name: 'Harvest Festival',    emoji: '🎃', colors: [0xd98a3a, 0xc0392b, 0xe0b24a], gift: 150 },
    Winter: { name: 'Winter Lights',       emoji: '❄️', colors: [0xaad8ec, 0xffffff, 0x9bb8e8], gift: 120 },
};

export function festivalFor(seasonName) { return FEST[seasonName] || null; }

let bunting = null;

function buildBunting(colors) {
    clearBunting();
    bunting = new THREE.Group();
    const x0 = 29, z = 27, n = 14; // strung up near the market
    for (let i = 0; i < n; i++) {
        const flag = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 3), curvedMaterial({ color: colors[i % colors.length] }));
        flag.position.set(x0 - i * 0.38, 1.5 - (i % 2) * 0.06, z);
        flag.rotation.x = Math.PI; // hang point-down
        bunting.add(flag);
    }
    scene.add(bunting);
}

export function clearBunting() {
    if (bunting) {
        scene.remove(bunting);
        bunting.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        bunting = null;
    }
}

// Put up this season's bunting; returns the festival info (name/emoji/gift) or null.
export function startFestival(seasonName) {
    const f = festivalFor(seasonName);
    if (f) buildBunting(f.colors);
    return f;
}
