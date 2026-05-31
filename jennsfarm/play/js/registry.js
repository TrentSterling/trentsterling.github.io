// js/registry.js — the game's System Registry (the mod-loader core). Feature
// modules register a System here at import time; main.js becomes a thin
// orchestrator that ticks / saves / loads / offline-credits them GENERICALLY,
// instead of hand-wiring every feature into the game loop + save object. New
// systems self-register → no main.js edits → multiple modules can be built in
// parallel without stepping on each other (Trent's ask).
//
// A System is a plain object:
//   { id,
//     update?(dt, ctx),     // per-frame
//     offline?(secs, ctx),  // away-time catch-up
//     serialize?(),         // -> data (collected into the save under `id`)
//     load?(data) }         // restore
// `ctx` is the shared world API the orchestrator hands in (playerPos, gameTime,
// season, isNight, inventory, …) so systems never import main's mutable state.

const systems = [];

export function registerSystem(sys) {
    if (!sys || !sys.id) throw new Error('registerSystem: a system needs an id');
    if (systems.some(s => s.id === sys.id)) return; // idempotent — safe across re-imports
    systems.push(sys);
}

export function getSystems() { return systems.slice(); }

export function updateSystems(dt, ctx) {
    for (const s of systems) if (s.update) s.update(dt, ctx);
}

export function offlineSystems(seconds, ctx) {
    for (const s of systems) if (s.offline) s.offline(seconds, ctx);
}

export function serializeSystems() {
    const out = {};
    for (const s of systems) if (s.serialize) out[s.id] = s.serialize();
    return out;
}

export function loadSystems(data) {
    if (!data) return;
    for (const s of systems) if (s.load && data[s.id] !== undefined) s.load(data[s.id]);
}

// Test-only: clear the registry so the suite can register fakes in isolation.
export function _resetSystems() { systems.length = 0; }
