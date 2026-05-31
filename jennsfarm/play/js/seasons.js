// js/seasons.js - A simple season cycle driven by the day count. Affects crop
// growth speed and shows in the HUD. Derived purely from `day`, so it needs no
// extra save data.

export const SEASONS = [
    { name: 'Spring', emoji: '🌸', growth: 1.10 },
    { name: 'Summer', emoji: '☀️', growth: 1.25 },
    { name: 'Autumn', emoji: '🍂', growth: 0.90 },
    { name: 'Winter', emoji: '❄️', growth: 0.55 },
];

const SEASON_DAYS = 3; // days per season → a 12-day year

export function getSeason(day) {
    const idx = Math.floor((Math.max(1, day) - 1) / SEASON_DAYS) % SEASONS.length;
    return { ...SEASONS[idx], index: idx };
}
