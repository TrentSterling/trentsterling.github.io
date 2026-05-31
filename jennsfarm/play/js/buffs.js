// js/buffs.js — short-lived buffs from eating special cooked meals (#50 promised
// "meals + buffs"; meals only healed until now). Eating a buff-meal peps up a stat
// for a while. First wired stat: 'luck', which makes premium (⭐⭐) harvests more
// likely. Pure timer/stack manager — main calls applyMeal() on eat and
// tickBuffs(dt) each frame; harvest queries luckMult(). One buff per stat (eating
// again refreshes the timer). Ephemeral by design — not persisted across reloads.
//
// The meals are crafted from valuable inputs, so a buff is a trade, not free
// income — it stays clear of the economy.

const MEAL_BUFFS = {
    honey_cake:   { stat: 'luck',  mult: 2,    secs: 90,  label: '🍀 Honey Cake — lucky harvests for a while!' },
    grand_elixir: { stat: 'luck',  mult: 3,    secs: 120, label: '🍀 Grand Elixir — very lucky harvests!' },
    fish_stew:    { stat: 'speed',  mult: 1.35, secs: 90,  label: '🐟 Fish Stew — quick feet!' },
    country_cake: { stat: 'speed',  mult: 1.2,  secs: 120, label: '🍰 Country Cake — a spring in your step!' },
    veggie_soup:  { stat: 'growth', mult: 1.5,  secs: 90,  label: '🌱 Veggie Soup — crops grow faster!' },
};

let active = {}; // stat -> { mult, remaining }

export function buffForMeal(id) { return MEAL_BUFFS[id] || null; }

// Eat a meal; if it grants a buff, (re)start it and return the buff (for a toast).
export function applyMeal(id) {
    const b = MEAL_BUFFS[id];
    if (!b) return null;
    active[b.stat] = { mult: b.mult, remaining: b.secs };
    return b;
}

export function tickBuffs(dt) {
    for (const stat of Object.keys(active)) {
        active[stat].remaining -= dt;
        if (active[stat].remaining <= 0) delete active[stat];
    }
}

export function statMult(stat) { return active[stat] ? active[stat].mult : 1; }
export function luckMult() { return statMult('luck'); }
export function speedMult() { return statMult('speed'); }
export function growthMult() { return statMult('growth'); }

export function activeBuffs() {
    return Object.entries(active).map(([stat, b]) => ({ stat, mult: b.mult, remaining: Math.max(0, b.remaining) }));
}

export function clearBuffs() { active = {}; }
