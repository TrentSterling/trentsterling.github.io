// js/grandpa.js - Grandpa, the guiding NPC (Alice Greenfingers style). He drifts
// near the cottage and pipes up with contextual suggestions, tasks and idle
// "barks" via a speech bubble that tracks his head on screen.

import * as THREE from 'three';
import { camera, curveUniforms } from './renderer.js';
import { getGrandpaPos } from './animals.js';

let bubble = null;
let visibleFor = 0;   // seconds the current bubble stays up
let cooldown = 4;     // seconds until the next bark
let lastLine = '';
const recent = [];    // avoid repeating the last few lines
const _v = new THREE.Vector3();

function ensureBubble() {
    if (bubble) return;
    bubble = document.createElement('div');
    bubble.id = 'grandpa-bubble'; // styled via style.css (unified design system)
    document.body.appendChild(bubble);
}

// --- Bark selection ---
// Each entry: { when(state) -> bool (optional), lines: [...] }. Contextual ones
// are tried first; generic flavor fills the gaps.
const CONTEXT = [
    { when: s => s.day === 1, lines: [
        "Welcome to the farm, {name}! Till some soil and pop those seeds in.",
        "Your grandma loved this land, {name}. Make it bloom." ] },
    { when: s => s.coins < 40, lines: [
        "Coffers lookin' light? Haul some crops to the market, {name}.",
        "No shame in sellin' a little to get goin'." ] },
    { when: s => s.wood >= 6, lines: [
        "That's a tidy woodpile, {name}! Town pays good coin for lumber.",
        "Plenty of timber there — don't let it rot in the bag." ] },
    { when: s => s.crops >= 10, lines: [
        "Bag's gettin' heavy, {name}! Sell at the market or stash it in the barn.",
        "Fine haul! The barn'll keep that fresh." ] },
    { when: s => s.day >= 4 && s.coins > 400, lines: [
        "Doin' well, {name}! Maybe expand the farm or hire some hooves.",
        "Time to dream bigger — more land, more animals." ] },
];
const FLAVOR = [
    "Chop a tree with the axe if you're short on wood.",
    "Prices swing every mornin' — check the market, {name}.",
    "Goat milk fetches more than cow's, you know.",
    "A square watermelon? Worth a small fortune in town.",
    "Mix herbs an' flowers at the workshop for the real money.",
    "Nothin' beats fresh air and good dirt.",
    "Water keeps the crops happy, {name}.",
    "I remember when this whole valley was forest...",
    "Them critters won't bother the crops. Mostly.",
    "Take your time, sweetpea. The farm ain't goin' nowhere.",
    "You're a natural at this, {name}. Always knew you would be.",
    "Your grandma'd be so proud, {name}. I sure am.",
    "This whole valley feels brighter with you here, {name}.",
];

function fill(line, state) { return line.replace(/\{name\}/g, state.name || 'Jenn'); }

function pickLine(state) {
    // gather candidate lines: matching context first, else flavor
    let pool = [];
    for (const c of CONTEXT) {
        if (!c.when || c.when(state)) pool.push(...c.lines);
    }
    // bias toward contextual but always allow flavor variety
    if (pool.length === 0 || Math.random() < 0.5) pool = pool.concat(FLAVOR);
    // avoid the last couple of lines
    const fresh = pool.filter(l => !recent.includes(l));
    const chosen = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length ? fresh.length : pool.length))];
    recent.push(chosen);
    if (recent.length > 3) recent.shift();
    return fill(chosen, state);
}

function say(text) {
    ensureBubble();
    bubble.textContent = text;
    bubble.style.display = 'block';
    requestAnimationFrame(() => { bubble.style.opacity = '1'; });
    visibleFor = 5.5;
    lastLine = text;
}

/** Manually trigger a contextual line (e.g. on a notable event). */
export function grandpaSay(state) { say(pickLine(state)); cooldown = 12 + Math.random() * 8; }

/** Speak an exact line (used by the quest system). Holds off random barks. */
export function grandpaSayText(text) { say(text); cooldown = Math.max(cooldown, 9); }

function place() {
    const p = getGrandpaPos();
    if (!p) { bubble.style.display = 'none'; return; }
    const c = curveUniforms.curvature.value;
    const pz = curveUniforms.curveOrigin.value.z;
    // match the ground-curvature applied in the vertex shader so the bubble sits right
    const yCurve = -(p.z - pz) * (p.z - pz) * c;
    _v.set(p.x, 1.25 + yCurve, p.z).project(camera);
    if (_v.z > 1) { bubble.style.display = 'none'; return; } // behind camera
    bubble.style.display = 'block';
    bubble.style.left = ((_v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    bubble.style.top = ((-_v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
}

export function initGrandpa() { ensureBubble(); }

export function updateGrandpa(dt, state) {
    ensureBubble();
    cooldown -= dt;
    if (cooldown <= 0) { say(pickLine(state)); cooldown = 13 + Math.random() * 9; }

    if (visibleFor > 0) {
        visibleFor -= dt;
        if (visibleFor <= 0) { bubble.style.opacity = '0'; setTimeout(() => { if (visibleFor <= 0) bubble.style.display = 'none'; }, 220); }
        else place();
    }
}
