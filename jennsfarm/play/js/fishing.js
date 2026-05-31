// js/fishing.js — cast into the pond, wait for a bite, click to reel it in (#49).
// This module owns the pure "what did you catch" logic (season-influenced); the
// cast→bite→hook timing state machine lives in main.js (it drives off the game
// loop + clicks). Catches are normal sellable items (fish), great cooking inputs
// later (#50).

import { ITEMS } from './inventory.js';

export const FISH = ['minnow', 'trout', 'bass', 'salmon', 'pike', 'catfish', 'bob'];
const SEASON_FISH = { Spring: 'trout', Summer: 'bass', Autumn: 'salmon', Winter: 'pike' };
const COMMON = ['minnow', 'trout', 'bass'];

// Pure: pick a fish from a 0..1 roll, biased toward the season's special, with a
// couple of rare novelty catches (a catfish that has a cat face, and Bob).
export function pickFish(seasonName, roll) {
    const r = (((roll % 1) + 1) % 1); // tolerate any real
    if (r < 0.05) return 'catfish';   // rare: it has a cat face. meow.
    if (r < 0.09) return 'bob';       // rare: a fish named Bob. hi Bob.
    const seasonal = SEASON_FISH[seasonName];
    if (seasonal && r < 0.45) return seasonal;
    return COMMON[Math.floor(r * COMMON.length) % COMMON.length];
}

// Guard so a misconfigured fish can't slip in (used by the suite).
export function fishIsValid(id) { return FISH.includes(id) && !!ITEMS[id]; }

// --- Fish sizes + personal-best records (#49 depth) ---
// Each species has a weight range (lb); bigger fish run heavier. The roll is
// squared so most catches are small and a lunker feels special. Bob is always
// exactly 4 lb, because Bob is Bob.
const FISH_WEIGHT = {
    minnow:  [0.1, 0.6],
    trout:   [0.5, 3.5],
    bass:    [1, 6],
    salmon:  [2, 12],
    pike:    [3, 18],
    catfish: [2, 25],
    bob:     [4, 4],
};

export function rollFishSize(species, roll = Math.random()) {
    const [lo, hi] = FISH_WEIGHT[species] || [0.2, 2];
    const r = (((roll % 1) + 1) % 1);
    const w = lo + (hi - lo) * (r * r); // squared bias toward the small end
    return Math.round(w * 10) / 10;     // one decimal pound
}

let records = {}; // species -> best weight caught
export function fishRecord(species) { return records[species] || 0; }
// Record the catch; returns true if it's a new personal best for that species.
export function tryFishRecord(species, weight) {
    if (weight > (records[species] || 0)) { records[species] = weight; return true; }
    return false;
}
export function serializeFishRecords() { return { ...records }; }
export function loadFishRecords(d) { records = (d && typeof d === 'object') ? { ...d } : {}; }
export function clearFishRecords() { records = {}; } // test isolation
