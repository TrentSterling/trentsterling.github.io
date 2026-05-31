// js/mailbox.js — Grandpa leaves a letter every day: either a small gift, or a
// "wanted" delivery request (bring N of a crop for a premium payout). Ongoing
// Grandpa quests beyond the intro chore chain + a daily reason to visit home.
// Pure + deterministic from the day number (same day → same letter, no reroll
// on reopen), so it's unit-testable.

import { ITEMS } from './inventory.js';

const REQUEST_CROPS = ['carrot', 'tomato', 'potato', 'wheat', 'strawberry', 'mint', 'grape'];

function rng(seed) {
    const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
}

export function makeLetter(day) {
    if (day < 1) day = 1;
    if (rng(day) < 0.34) {
        const coins = 30 + Math.floor(rng(day * 2.1) * 71); // 30..100
        return { kind: 'gift', day, coins, text: `Morning! A little something to keep you going. ❤ (+🪙${coins})` };
    }
    const crop = REQUEST_CROPS[Math.floor(rng(day * 1.7) * REQUEST_CROPS.length)];
    const qty = 3 + Math.floor(rng(day * 3.3) * 6); // 3..8
    const unit = (ITEMS[crop] && ITEMS[crop].sellPrice) || 15;
    const reward = Math.round(qty * unit * 1.6); // a premium over selling them yourself
    const name = ITEMS[crop] ? ITEMS[crop].name : crop;
    return { kind: 'request', day, crop, qty, reward,
        text: `The market's short on ${name}. Bring me ${qty} and I'll pay 🪙${reward}.` };
}

export function canFulfill(letter, inventory) {
    return !!letter && letter.kind === 'request' && inventory.has(letter.crop, letter.qty);
}

// Apply a letter: gift → its coins; request → consume the goods (if able) → its
// reward. Returns coins granted, or 0 if a request can't currently be fulfilled.
export function claimLetter(letter, inventory) {
    if (!letter) return 0;
    if (letter.kind === 'gift') return letter.coins;
    if (!canFulfill(letter, inventory)) return 0;
    inventory.remove(letter.crop, letter.qty);
    return letter.reward;
}

let lastClaimedDay = 0;
export function isClaimed(day) { return lastClaimedDay >= day; }
export function markClaimed(day) { lastClaimedDay = Math.max(lastClaimedDay, day); }
export function serializeMail() { return { lastClaimedDay }; }
export function loadMail(d) { lastClaimedDay = (d && d.lastClaimedDay) || 0; }
