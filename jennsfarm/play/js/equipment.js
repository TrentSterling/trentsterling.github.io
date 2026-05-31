// js/equipment.js — Tool upgrade tiers. Spend money to widen the area your
// watering can and hoe cover (single tile → 3x3 → 5x5), turning "just unlock a
// thing" into a meaningful efficiency ladder — the mower/tiller progression
// Trent asked for (#33). Pure data + state (no THREE/DOM) so it's unit-testable.
// Tier 0 has radius 0 (single tile) === the original behaviour, so nothing
// changes until the player actually buys an upgrade.

export const TOOL_TIERS = {
    water: [
        { name: 'Watering Can',     radius: 0 },
        { name: 'Big Watering Can', radius: 1, cost: 450 },
        { name: 'Sprinkler Rig',    radius: 2, cost: 1800 },
    ],
    hoe: [
        { name: 'Hoe',      radius: 0 },
        { name: 'Wide Hoe', radius: 1, cost: 600 },
        { name: 'Tiller',   radius: 2, cost: 2200 },
    ],
};

let levels = { water: 0, hoe: 0 };

export function getToolLevel(tool) { return levels[tool] || 0; }

export function getToolRadius(tool) {
    const tiers = TOOL_TIERS[tool];
    return tiers ? tiers[levels[tool] || 0].radius : 0;
}

export function getToolName(tool) {
    const tiers = TOOL_TIERS[tool];
    return tiers ? tiers[levels[tool] || 0].name : tool;
}

// The next upgrade available for a tool, or null if already maxed.
export function nextUpgrade(tool) {
    const tiers = TOOL_TIERS[tool];
    if (!tiers) return null;
    const next = (levels[tool] || 0) + 1;
    return next < tiers.length ? { tool, level: next, name: tiers[next].name, cost: tiers[next].cost } : null;
}

export function upgradeTool(tool) {
    const n = nextUpgrade(tool);
    if (!n) return false;
    levels[tool] = n.level;
    return true;
}

// Tiles within a square (Chebyshev) radius of (cx,cz). radius 0 → just the tile.
export function tilesInRadius(cx, cz, radius) {
    const out = [];
    for (let dz = -radius; dz <= radius; dz++)
        for (let dx = -radius; dx <= radius; dx++)
            out.push({ x: cx + dx, z: cz + dz });
    return out;
}

export function serializeEquipment() { return { ...levels }; }

export function loadEquipment(d) {
    levels = { water: 0, hoe: 0 };
    if (!d) return;
    for (const tool of ['water', 'hoe']) {
        if (typeof d[tool] === 'number') levels[tool] = Math.max(0, Math.min(d[tool], TOOL_TIERS[tool].length - 1));
    }
}
