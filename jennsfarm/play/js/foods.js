// js/foods.js — how much health an item restores when eaten. Pure + shared by
// the eat action (main.js) and the Bag hover tooltips (ui.js), so the number the
// player sees is exactly the number they get. Unit-testable.

import { ITEMS } from './inventory.js';
import { CROPS } from './farm.js';

export function healValue(id) {
    if (id === 'wood') return 0;                    // not food
    if (ITEMS[id] && ITEMS[id].crafted) return 45;  // potions / crafted goods heal the most
    const c = CROPS[id];
    if (c && c.kind === 'herb') return 16;          // mint
    if (c && c.kind === 'flower') return 12;        // lavender, rose, tulip, sunflower
    return 6;                                        // plain crops, fruit, produce
}
