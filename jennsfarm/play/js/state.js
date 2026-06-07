// js/state.js — the single shared mutable game-state object (#9 modularization keystone).
//
// WHY ONE OBJECT: ES-module `let` exports are live but READ-ONLY at the import site
// (`import { coins }; coins += 5` is a TypeError). So every shared scalar lives as a
// PROPERTY of `G` — `G.coins += 5` is legal from any module. This file imports only
// leaf modules (inventory, seasons) so it's an acyclic sink, fully constructed before
// any game code runs → eliminates the whole "let used before its declaration" TDZ class.
//
// See MODULARIZATION.md for the full extraction plan.

import { createInventory } from './inventory.js';
import { getSeason } from './seasons.js';

// Inventory singletons: const bindings, never reassigned, mutated in place.
// Exported directly AND hung on G so callers can use either form.
export const inventory = createInventory();
export const barnStorage = createInventory();

// Shared constants (were module-level const in main.js).
export const MAX_HEALTH = 100;
export const HEALTH_DRAIN = 0.35;        // per second while actively playing (not AFK)
export const DAY_LENGTH = 300;           // seconds per day
export const AFK_MS = 7000;              // idle this long (post-onboarding) -> AI takes over
export const PAN_SCALE = 0.03;           // drag screen px -> world units
export const BARN_UPGRADE_COSTS = [150, 300, 600, 1200];

// The one mutable state bag. Every former main.js `let` becomes a property here.
export const G = {
    // Core save-model primitives
    coins: 100,
    day: 1,
    gameTime: 0,
    playerName: 'Jenn',
    playerGender: 'girl',
    health: 100,
    season: getSeason(1),
    barnLevel: 1,
    barnCapacity: 50,            // derived; recalcBarnCapacity() overwrites

    // Inventory singletons (also exported as const above)
    inventory,
    barnStorage,

    // Selection / pending-action / input flags
    selectedSlot: 0,
    pendingAction: null,         // { x, z, tool, auto? }
    pendingRoute: null,          // { tx, tz }
    lastInputAt: performance.now(),
    autoActive: false,
    autoCheckTimer: 0,
    namePromptOpen: false,
    autoSkip: new Set(),         // auto-farm tiles unreachable this AFK session

    // Throttled-UI / step / health-UI timers
    _uiDirty: true,
    _uiTimer: 0,
    stepTimer: 0,
    healthUiTimer: 0,
    buffHudTimer: 0,

    // Fishing
    fishing: null,               // { state:'cast'|'bite', timer }

    // Loop scratch / timer handles
    saveTimer: null,
    lastTime: performance.now(),
    _sysCtx: null,

    // Drag-to-pan camera state
    dragDown: false,
    dragMoved: false,
    dragLastX: 0,
    dragLastY: 0,
    dragStartX: 0,
    dragStartY: 0,

    // Lazy DOM nodes (reassigned from null)
    autoBadgeEl: null,
    buffBarEl: null,
};
