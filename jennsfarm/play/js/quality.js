// js/quality.js — crop quality (#53). Harvesting a crop while it's watered is a
// premium harvest: it yields a little extra and earns a star (occasionally two,
// a bumper crop). Rewards keeping things watered. Pure + unit-testable; main
// applies it in doHarvest (no changes to the crop sim or inventory tiers).

export function harvestQuality(watered, roll = Math.random()) {
    if (!watered) return { stars: 0, bonus: 0 };
    const r = (((roll % 1) + 1) % 1);
    if (r < 0.25) return { stars: 2, bonus: 2 }; // ⭐⭐ bumper crop
    return { stars: 1, bonus: 1 };               // ⭐ healthy
}
