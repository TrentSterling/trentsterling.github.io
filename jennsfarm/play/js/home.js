// js/home.js — Jenn's cottage is a real place now, not just a solid prop. Step
// inside to rest: sleeping skips the night and wakes you fresh next morning
// (crops grow + animals produce overnight, handled by main via the offline
// helpers). The pure time-of-day math lives here so it's unit-testable; the
// panel + wiring live in ui.js / main.js.

// The wake time within a day (0.2 of the day = the bright morning a fresh game
// opens on). Keep in sync with main.js's fresh-game gameTime.
export const WAKE_FRACTION = 0.2;

// Given the current gameTime, return the gameTime of the NEXT morning — i.e.
// always advance to tomorrow's wake time, never backwards.
export function nextMorning(gameTime, dayLength) {
    const morning = dayLength * WAKE_FRACTION;
    const curDay = Math.floor(gameTime / dayLength);
    return (curDay + 1) * dayLength + morning;
}
