// js/stats.js — a lifetime "farm ledger" of feel-good counters (numbers going up).
// Pure tracker: main bumps a stat at the relevant action; the Home overlay shows
// the running totals. Order here is the display order; only non-zero rows show.

const STATS = [
    { key: 'harvested', label: '🌾 Crops harvested' },
    { key: 'planted',   label: '🌱 Seeds planted' },
    { key: 'watered',   label: '💧 Crops watered' },
    { key: 'golden',    label: '🌟 Golden harvests' },
    { key: 'sold',      label: '💰 Goods sold' },
    { key: 'fish',      label: '🎣 Fish caught' },
    { key: 'chopped',   label: '🪓 Trees chopped' },
    { key: 'cooked',    label: '🍲 Things cooked' },
    { key: 'petted',    label: '💛 Animals petted' },
];

const _label = {};
for (const s of STATS) _label[s.key] = s.label;

// Milestone thresholds per stat — crossing one pops a 🏅 celebration (no reward,
// just recognition; numbers going up is the point).
const MILESTONES = {
    harvested: [50, 250, 1000, 5000],
    planted:   [50, 250, 1000, 5000],
    watered:   [50, 250, 1000, 5000],
    golden:    [1, 10, 50, 200],
    sold:      [100, 500, 2500, 10000],
    fish:      [10, 50, 200],
    chopped:   [25, 100, 500],
    cooked:    [10, 50, 200],
    petted:    [25, 100, 500],
};

let counts = {};

// Add to a stat. Returns a milestone descriptor {key,label,milestone} if this bump
// crossed a threshold, else null — the caller celebrates it.
export function bumpStat(key, n = 1) {
    const before = counts[key] || 0;
    const after = before + n;
    counts[key] = after;
    const ms = MILESTONES[key];
    const hit = ms && ms.find(m => before < m && after >= m);
    return hit ? { key, label: _label[key] || key, milestone: hit } : null;
}
export function getStat(key) { return counts[key] || 0; }

// For display: [{key, label, value}] in declared order.
export function allStats() {
    return STATS.map(s => ({ key: s.key, label: s.label, value: counts[s.key] || 0 }));
}

export function serializeStats() { return { ...counts }; }
export function loadStats(d) { counts = (d && typeof d === 'object') ? { ...d } : {}; }
export function clearStats() { counts = {}; } // test isolation
