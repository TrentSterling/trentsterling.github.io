// js/terrain.js — gentle, cosmetic elevation for the wild terrain (#39). Pure +
// deterministic so chunks regenerate identically and it's unit-testable. Height
// fades to 0 over the flat core farm (0..48) so the play area, fences and
// buildings stay perfectly level and the seam with the core plane is invisible.
// "Don't go crazy on elevation" — amplitude is small (~±0.33 tiles) and purely
// visual; gameplay/collision stay flat.

const CORE_MIN = 0, CORE_MAX = 48;
export const AMP = 0.33;

function distOutsideCore(x, z) {
    const dx = Math.max(0, CORE_MIN - x, x - CORE_MAX);
    const dz = Math.max(0, CORE_MIN - z, z - CORE_MAX);
    return Math.hypot(dx, dz);
}

// 0 inside the core box, ramping to 1 over ~8 tiles once you're outside it.
function coreFade(x, z) {
    return Math.min(1, distOutsideCore(x, z) / 8);
}

// Gentle rolling height at world (x,z). Range ~[-AMP, AMP]; exactly 0 over the core.
export function terrainHeight(x, z) {
    const n = Math.sin(x * 0.18 + 1.3) * Math.cos(z * 0.15 - 0.7)
            + 0.5 * Math.sin((x + z) * 0.09 + 2.1);
    return (n / 1.5) * AMP * coreFade(x, z); // n/1.5 normalises to ±1 before scaling
}
