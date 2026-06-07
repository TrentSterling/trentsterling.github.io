// js/meshmerge.js — shared helper: collapse a built Group of coloured parts into a
// single mesh carrying per-vertex colour, so a multi-part building/prop is ONE draw
// call instead of many (#35). Bakes each child's local transform + material colour.

import * as THREE from 'three';
import { curvedMaterial } from './renderer.js';

const _c = new THREE.Color();

// One shared vertex-colour material for everything merged this way.
export const mergedMat = curvedMaterial({ vertexColors: true });

// Merge a Group's mesh children into one BufferGeometry (baked transforms + colours).
export function mergeGroupGeo(group) {
    const baked = [];
    let total = 0;
    group.traverse(c => {
        if (!c.isMesh || !c.geometry) return;
        c.updateMatrix();
        const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        g.applyMatrix4(c.matrix);
        const col = (c.material && c.material.color) ? c.material.color : _c.set(0xcccccc);
        baked.push({ g, r: col.r, gg: col.g, b: col.b });
        total += g.attributes.position.count;
        if (c.geometry !== g) c.geometry.dispose();
        if (c.material) c.material.dispose();
    });
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let o = 0;
    for (const b of baked) {
        const p = b.g.attributes.position, nn = b.g.attributes.normal;
        for (let i = 0; i < p.count; i++) {
            const j = (o + i) * 3;
            pos[j] = p.getX(i); pos[j + 1] = p.getY(i); pos[j + 2] = p.getZ(i);
            if (nn) { nor[j] = nn.getX(i); nor[j + 1] = nn.getY(i); nor[j + 2] = nn.getZ(i); }
            col[j] = b.r; col[j + 1] = b.gg; col[j + 2] = b.b;
        }
        o += p.count; b.g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
}

// Build the parts in a temp Group, return ONE merged mesh (shared material).
// fn receives the Group to add parts to.
export function mergedMesh(fn) {
    const g = new THREE.Group();
    fn(g);
    return new THREE.Mesh(mergeGroupGeo(g), mergedMat);
}
