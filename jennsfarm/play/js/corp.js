// js/corp.js — The long game. Every coin you earn from selling counts toward
// your "company value", which lifts your corporate rank; each rank grants a
// permanent sell bonus. Grow from a roadside stand all the way up to a Shampoo
// Corporation. This is the farm→corporation progression arc (#31), sitting on
// top of all your production (crops, animals, factories).
//
// Pure data + state (no THREE/DOM) so it's unit-testable in the suite.

export const RANKS = [
    { name: 'Roadside Stand',      emoji: '🧺', need: 0,      bonus: 0.00 },
    { name: 'Family Farm',         emoji: '🚜', need: 600,    bonus: 0.04 },
    { name: 'Country Co-op',       emoji: '🏡', need: 2500,   bonus: 0.08 },
    { name: 'Valley Grocers',      emoji: '🏪', need: 7000,   bonus: 0.13 },
    { name: 'AgriCorp',            emoji: '🏢', need: 18000,  bonus: 0.19 },
    { name: 'MegaFarm Holdings',   emoji: '🏦', need: 45000,  bonus: 0.26 },
    { name: 'Shampoo Corporation', emoji: '🧴', need: 120000, bonus: 0.35 },
];

let lifetime = 0; // total coins earned from selling, ever (the "company value")

export function addEarnings(coins) {
    if (coins > 0) lifetime += coins;
}

export function getLifetime() { return lifetime; }

export function getRankIndex() {
    let idx = 0;
    for (let i = 0; i < RANKS.length; i++) if (lifetime >= RANKS[i].need) idx = i;
    return idx;
}

export function getRank() {
    const i = getRankIndex();
    return { index: i, ...RANKS[i], next: i + 1 < RANKS.length ? RANKS[i + 1] : null };
}

// Permanent multiplier (as a fraction) on sell income from your corporate rank.
export function getSellBonus() { return RANKS[getRankIndex()].bonus; }

// 0..1 progress from the current rank's threshold toward the next (1 when maxed).
export function getRankProgress() {
    const i = getRankIndex();
    if (i + 1 >= RANKS.length) return 1;
    const cur = RANKS[i].need, nxt = RANKS[i + 1].need;
    return Math.max(0, Math.min(1, (lifetime - cur) / (nxt - cur)));
}

export function serializeCorp() { return { lifetime }; }
export function loadCorp(d) { lifetime = (d && d.lifetime) || 0; }
