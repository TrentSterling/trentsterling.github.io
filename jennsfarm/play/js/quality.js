// js/quality.js — crop quality (#53). Harvesting a crop while it's watered is a
// premium harvest: it yields a little extra and earns a star (occasionally two,
// a bumper crop). Rewards keeping things watered. Pure + unit-testable; main
// applies it in doHarvest (no changes to the crop sim or inventory tiers).

export function harvestQuality(watered, roll = Math.random(), luck = 1) {
    if (!watered) return { stars: 0, bonus: 0 };
    const r = (((roll % 1) + 1) % 1);
    const L = luck || 1;
    const goldenChance = Math.min(0.15, 0.02 * L); // rare ⭐⭐⭐ golden; a luck buff helps
    const greatChance = Math.min(0.75, 0.25 * L);  // ⭐⭐ band, also widened by luck
    if (r < goldenChance) return { stars: 3, bonus: 3, golden: true }; // 🌟 golden crop!
    if (r < greatChance) return { stars: 2, bonus: 2 };                // ⭐⭐ bumper crop
    return { stars: 1, bonus: 1 };                                     // ⭐ healthy
}
