// js/offline.js - Idle/offline progress. The farm keeps living while you're away:
// crops grow (full speed where a sprinkler keeps them watered, slow otherwise),
// so leaving the game running - or just coming back later - is rewarded. Pairs
// with sprinklers + the idle/animated-wallpaper direction.

import { CROPS } from './farm.js';
import { forEachFarmTile, TILE } from './world.js';
import { isWatering } from './sprinklers.js';

/**
 * Advance all planted crops by `seconds` of elapsed time (multi-stage).
 * Returns a summary { grown, ripened } for a "while you were away" message.
 * Caller should rebuild crop meshes afterward.
 */
export function advanceCropsOffline(seconds) {
    let grown = 0, ripened = 0;
    forEachFarmTile((x, z, tile) => {
        if (tile.type !== TILE.PLANTED || !tile.crop) return;
        const crop = CROPS[tile.crop];
        if (!crop || tile.cropStage >= 3) return;

        // Sprinkler-covered tiles stay watered (full speed); others crawl.
        const watered = isWatering(x, z) || tile.watered;
        const stageTime = crop.growTime / 3;
        let t = (tile.cropTimer || 0) + seconds * (watered ? 1 : 0.3);
        const before = tile.cropStage;
        while (tile.cropStage < 3 && t >= stageTime) { t -= stageTime; tile.cropStage++; }
        tile.cropTimer = tile.cropStage < 3 ? t : 0;

        if (tile.cropStage > before) {
            grown += tile.cropStage - before;
            if (tile.cropStage >= 3) ripened++;
        }
    });
    return { grown, ripened };
}
