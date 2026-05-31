// js/stats.js — a lifetime "farm ledger" of feel-good counters (numbers going up).
// Pure tracker: main bumps a stat at the relevant action; the Home overlay shows
// the running totals. Order here is the display order; only non-zero rows show.

const STATS = [
    { key: 'harvested', label: '🌾 Crops harvested' },
    { key: 'golden',    label: '🌟 Golden harvests' },
    { key: 'fish',      label: '🎣 Fish caught' },
    { key: 'chopped',   label: '🪓 Trees chopped' },
    { key: 'cooked',    label: '🍲 Things cooked' },
    { key: 'petted',    label: '💛 Animals petted' },
];

let counts = {};

export function bumpStat(key, n = 1) { counts[key] = (counts[key] || 0) + n; }
export function getStat(key) { return counts[key] || 0; }

// For display: [{key, label, value}] in declared order.
export function allStats() {
    return STATS.map(s => ({ key: s.key, label: s.label, value: counts[s.key] || 0 }));
}

export function serializeStats() { return { ...counts }; }
export function loadStats(d) { counts = (d && typeof d === 'object') ? { ...d } : {}; }
export function clearStats() { counts = {}; } // test isolation
