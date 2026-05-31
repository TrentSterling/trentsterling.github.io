// js/fishing.js — cast into the pond, wait for a bite, click to reel it in (#49).
// This module owns the pure "what did you catch" logic (season-influenced); the
// cast→bite→hook timing state machine lives in main.js (it drives off the game
// loop + clicks). Catches are normal sellable items (fish), great cooking inputs
// later (#50).

import { ITEMS } from './inventory.js';

export const FISH = ['minnow', 'trout', 'bass', 'salmon', 'pike'];
const SEASON_FISH = { Spring: 'trout', Summer: 'bass', Autumn: 'salmon', Winter: 'pike' };
const COMMON = ['minnow', 'trout', 'bass'];

// Pure: pick a fish from a 0..1 roll, biased toward the season's special.
export function pickFish(seasonName, roll) {
    const r = (((roll % 1) + 1) % 1); // tolerate any real
    const seasonal = SEASON_FISH[seasonName];
    if (seasonal && r < 0.45) return seasonal;
    return COMMON[Math.floor(r * COMMON.length) % COMMON.length];
}

// Guard so a misconfigured fish can't slip in (used by the suite).
export function fishIsValid(id) { return FISH.includes(id) && !!ITEMS[id]; }
