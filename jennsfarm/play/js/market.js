// js/market.js - Dynamic supply/demand pricing (Alice Greenfingers style)
// Each sellable item has a daily "demand" multiplier and a "supply pressure"
// that rises as you sell and recovers over days. Flooding the market tanks prices.

import { ITEMS } from './inventory.js';

const SELL_K = 0.06;       // pressure added per unit sold
const FLOOR = 0.30;        // min price multiplier
const CEIL = 1.70;         // max price multiplier
const DAILY_RECOVER = 0.55; // fraction of pressure remaining after a day

// id -> { demand, pressure }
const state = {};

function sellableIds() {
    return Object.keys(ITEMS).filter(id => ITEMS[id].type === 'crop');
}

export function initMarket() {
    for (const id of sellableIds()) {
        if (!state[id]) state[id] = { demand: 1, pressure: 0 };
    }
}

function modifier(id) {
    const s = state[id] || { demand: 1, pressure: 0 };
    const m = s.demand / (1 + s.pressure);
    return Math.max(FLOOR, Math.min(CEIL, m));
}

export function getPrice(id) {
    const base = ITEMS[id] ? ITEMS[id].sellPrice || 0 : 0;
    return Math.max(1, Math.round(base * modifier(id)));
}

// Returns -1 (cheap/glut), 0 (normal), 1 (hot demand) for UI arrows
export function getTrend(id) {
    const m = modifier(id);
    if (m > 1.12) return 1;
    if (m < 0.85) return -1;
    return 0;
}

export function recordSale(id, qty) {
    if (!state[id]) state[id] = { demand: 1, pressure: 0 };
    state[id].pressure += qty * SELL_K;
}

// Called when a new day starts: demand drifts, supply pressure recovers
export function dailyTick() {
    for (const id of sellableIds()) {
        if (!state[id]) state[id] = { demand: 1, pressure: 0 };
        // Demand random walk around 1.0, clamped
        const drift = (Math.random() - 0.5) * 0.5;
        state[id].demand = Math.max(0.7, Math.min(1.4, state[id].demand * 0.6 + (1 + drift) * 0.4));
        state[id].pressure *= DAILY_RECOVER;
        if (state[id].pressure < 0.01) state[id].pressure = 0;
    }
}

export function serializeMarket() {
    return state;
}

export function loadMarket(data) {
    if (!data) return;
    for (const id in data) {
        if (state[id] !== undefined || sellableIds().includes(id)) {
            state[id] = { demand: data[id].demand ?? 1, pressure: data[id].pressure ?? 0 };
        }
    }
}
