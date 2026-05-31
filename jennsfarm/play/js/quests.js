// js/quests.js - Grandpa's intro chore chain (Alice Greenfingers style). He hands
// Jenn the farm but walks her through the basics first: clear weeds, till, plant,
// water, harvest, chop. Each step is announced as a Grandpa bark, tracked in a HUD
// box, and pays a small reward. Progress persists.

import { grandpaSayText } from './grandpa.js';

const CHAIN = [
    { id: 'weed',    text: 'Clear the weeds',   goal: 4, event: 'weed',    reward: { coins: 20 },
      intro: "First things first, {name} — pull them weeds. Use your Hand or the Hoe." },
    { id: 'till',    text: 'Till the soil',     goal: 4, event: 'till',    reward: { coins: 20 },
      intro: "Good! Now work the dirt — till some plots with the Hoe." },
    { id: 'plant',   text: 'Plant some seeds',  goal: 4, event: 'plant',   reward: { seeds: { carrot_seed: 3 } },
      intro: "Pop seeds in the tilled soil. Carrots are a fine start, {name}." },
    { id: 'water',   text: 'Water your crops',  goal: 4, event: 'water',   reward: { coins: 25 },
      intro: "Give 'em a drink — watered crops grow far quicker." },
    { id: 'harvest', text: 'Harvest the crops', goal: 4, event: 'harvest', reward: { coins: 40 },
      intro: "When they're ripe, harvest with your Hand. That's the payoff!" },
    { id: 'chop',    text: 'Chop a tree',       goal: 1, event: 'chop',    reward: { coins: 30 },
      intro: "Last chore: grab the Axe and fell a tree at the wood's edge for lumber." },
];

let index = 0, progress = 0, done = false;
let playerName = 'Jenn';
let onReward = null;
let onComplete = null;
let hudEl = null;

function fill(s) { return s.replace(/\{name\}/g, playerName); }

function ensureHud() {
    if (hudEl) return;
    hudEl = document.createElement('div');
    hudEl.id = 'quest-tracker';
    // styled via #quest-tracker in style.css (unified design system)
    document.body.appendChild(hudEl);
}

function renderHud() {
    ensureHud();
    if (done) {
        hudEl.innerHTML = `<div class="qt-done">✓ Farm chores complete!</div>
            <div class="qt-done-sub">The farm is yours, ${playerName}. 🌾</div>`;
        return;
    }
    const q = CHAIN[index];
    const pct = Math.min(100, (progress / q.goal) * 100);
    hudEl.innerHTML = `<div class="qt-label">👴 Grandpa's chore</div>
        <div class="qt-task">${q.text} <span class="qt-prog">${progress}/${q.goal}</span></div>
        <div class="qt-bar"><div class="qt-fill" style="width:${pct}%"></div></div>`;
}

function announceCurrent() {
    if (done) { grandpaSayText(fill(`The farm's all yours now, {name}. Make your grandma proud. 🌻`)); return; }
    grandpaSayText(fill(CHAIN[index].intro));
}

export function initQuests({ name = 'Jenn', reward, complete } = {}) {
    playerName = name;
    onReward = reward;
    onComplete = complete;
    index = 0; progress = 0; done = false; // idempotent init; loadQuests overrides for saves
    renderHud();
    // greet + first chore shortly after load (let the scene settle)
    setTimeout(() => announceCurrent(), 1500);
}

/** Feed a gameplay event; advances the active chore if it matches. */
export function questEvent(type) {
    if (done) return;
    const q = CHAIN[index];
    if (q.event !== type) return;
    progress++;
    if (progress >= q.goal) {
        if (onReward && q.reward) onReward(q.reward);
        index++;
        progress = 0;
        if (index >= CHAIN.length) { done = true; if (onComplete) onComplete(); }
        renderHud();
        // let the reward toast land, then Grandpa sets the next chore
        setTimeout(() => announceCurrent(), 700);
    } else {
        renderHud();
    }
}

export function setQuestName(name) { playerName = name; renderHud(); }

/** Mark the whole chain done with no celebration — used to un-stick old saves
 *  that have the quest active but nothing (e.g. weeds) to act on. */
export function completeSilently() {
    index = CHAIN.length;
    progress = 0;
    done = true;
    renderHud();
}

export function getQuestIndex() { return index; }

export function serializeQuests() { return { index, progress, done }; }

export function loadQuests(data) {
    if (!data) return;
    index = data.index ?? 0;
    progress = data.progress ?? 0;
    done = !!data.done;
    renderHud();
}
