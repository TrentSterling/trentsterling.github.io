// js/factories.js — Auto-production. Build a factory and it passively converts
// the raw goods you grow into high-value products over time; hire workers to
// speed each one up. This is the backbone of the farm→corporation arc (#30/#31).
//
// Deliberately self-contained (no THREE/scene imports) so the conversion logic
// is unit-testable in the suite. Factories pull their inputs straight from the
// player's bag, so growing grapes quietly becomes a stream of wine.

import { ITEMS } from './inventory.js';

const EMP_SPEED = 0.5;   // each worker adds +50% throughput
const OFFLINE_CAP = 30;  // max conversions per factory while away (anti-runaway)

// Each factory turns one raw good into a finished product. Inputs/outputs all
// reference real ITEMS, and every output is worth more than its inputs (guarded
// by the suite) so a factory always adds value.
export const FACTORY_TYPES = {
    winery:    { name: 'Winery',    emoji: '🍷', cost: 700,  input: 'grape',             inCount: 3, output: 'wine',        every: 16, maxEmployees: 4 },
    creamery:  { name: 'Creamery',  emoji: '🧀', cost: 1000, input: 'goat_milk',         inCount: 2, output: 'cheese',      every: 18, maxEmployees: 4 },
    juicery:   { name: 'Juicery',   emoji: '🥤', cost: 1600, input: 'square_watermelon', inCount: 1, output: 'melon_juice', every: 22, maxEmployees: 4 },
    perfumery: { name: 'Perfumery', emoji: '🌸', cost: 3500, input: 'rose',              inCount: 2, output: 'perfume',     every: 24, maxEmployees: 5 }, // late-game tier
};

// Hiring the (n+1)-th worker costs more each time — escalating money sink.
export function employeeCost(type, currentEmployees) {
    const def = FACTORY_TYPES[type];
    if (!def) return Infinity;
    return Math.round(def.cost * 0.4) * (currentEmployees + 1);
}

function speed(type, employees) {
    return 1 + employees * EMP_SPEED;
}

// owned: { [type]: { employees, timer } } — only present once built.
let owned = {};

export function ownsFactory(type) { return !!owned[type]; }

export function getFactories() {
    const out = {};
    for (const t in owned) out[t] = { employees: owned[t].employees, timer: owned[t].timer };
    return out;
}

export function buildFactory(type) {
    if (!FACTORY_TYPES[type] || owned[type]) return false;
    owned[type] = { employees: 0, timer: FACTORY_TYPES[type].every };
    return true;
}

export function hireEmployee(type) {
    const f = owned[type];
    const def = FACTORY_TYPES[type];
    if (!f || !def || f.employees >= def.maxEmployees) return false;
    f.employees++;
    return true;
}

// Per-frame tick: convert inputs → outputs as time accrues. Returns a map of
// { outputId: qtyProduced } for this tick (usually empty; non-empty ~every Ns).
export function updateFactories(dt, inventory) {
    const produced = {};
    for (const type in owned) {
        const f = owned[type];
        const def = FACTORY_TYPES[type];
        f.timer -= dt * speed(type, f.employees);
        let guard = 0;
        while (f.timer <= 0 && guard++ < 100) {
            if (inventory.has(def.input, def.inCount)) {
                inventory.remove(def.input, def.inCount);
                inventory.add(def.output, 1);
                produced[def.output] = (produced[def.output] || 0) + 1;
                f.timer += def.every;
            } else {
                f.timer = 0;   // idle, pinned ready, until inputs arrive
                break;
            }
        }
    }
    return produced;
}

// While the player is away each factory runs on whatever inputs are in the bag,
// limited by both elapsed time and available inputs, and hard-capped.
export function creditOfflineFactories(seconds, inventory) {
    const produced = {};
    for (const type in owned) {
        const f = owned[type];
        const def = FACTORY_TYPES[type];
        const byTime = Math.floor((seconds * speed(type, f.employees)) / def.every);
        const byInput = Math.floor(inventory.count(def.input) / def.inCount);
        const n = Math.min(byTime, byInput, OFFLINE_CAP);
        if (n > 0) {
            inventory.remove(def.input, n * def.inCount);
            inventory.add(def.output, n);
            produced[def.output] = n;
        }
    }
    return produced;
}

export function serializeFactories() {
    const data = {};
    for (const t in owned) data[t] = { employees: owned[t].employees, timer: owned[t].timer };
    return data;
}

export function loadFactories(data) {
    owned = {};
    if (!data) return;
    for (const t in data) {
        if (!FACTORY_TYPES[t]) continue; // ignore unknown/removed types
        owned[t] = {
            employees: Math.min(data[t].employees || 0, FACTORY_TYPES[t].maxEmployees),
            timer: typeof data[t].timer === 'number' ? data[t].timer : FACTORY_TYPES[t].every,
        };
    }
}
