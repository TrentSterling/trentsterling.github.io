# main.js Modularization Plan (#9)

`js/main.js` is ~1840 lines and holds ~30 shared mutable state vars threaded through dozens of
functions, so parallel agents collide on it. This is the plan to split it into a thin bootstrap +
6 focused modules. **Authoritative, critic-hardened** (a map→design→adversarial-verify agent pass
produced and reviewed it). Execute steps IN ORDER; each is independently shippable.

## ⚠ Verification gate after EVERY step
The test suite (`tests/suite.html`) does **NOT** import `main.js`, so it cannot catch a boot crash
or a corrupted save. After each step you MUST:
1. Run the suite (`bash tools/shot.sh "tests/suite.html" suite.png` → 104/104) — catches imported-module breakage.
2. **Boot-check**: `bash tools/shot.sh "index.html" game.png 7000` → read the PNG; a clean boot shows
   the welcome prompt + farm + HUD, a crash shows the red error overlay. Kill Chrome immediately after.
3. **Save round-trip review**: read the final `triggerAutoSave` save object — every value must be
   `key: G.key`, `key: serializeX()`, or a literal (NO bare shorthand identifiers, which would
   reference deleted `let`s and silently write `undefined` → reset the wife's coins to 100).
4. Test BOTH a fresh game (cleared localStorage) AND an existing save — the init paths differ.

## The keystone: `js/state.js`
ES-module `let` exports are read-only at the import site, so shared scalars live on ONE mutable
object `G` (mutating `G.coins` is always legal anywhere). `state.js` imports only leaves
(`inventory.js`, `seasons.js`) → it's an acyclic sink, constructed before any game code runs, which
**eliminates the whole TDZ bug class** (the `_uiDirty`-before-init crash we already hit).

`G` holds every former module-level `let`: coins, day, gameTime, playerName, playerGender, health,
season, barnLevel, barnCapacity, selectedSlot, pendingAction, pendingRoute, lastInputAt, autoActive,
autoCheckTimer, namePromptOpen, autoSkip(Set), _uiDirty, _uiTimer, stepTimer, healthUiTimer,
buffHudTimer, fishing, saveTimer, lastTime, _sysCtx, autoBadgeEl, buffBarEl, drag* (6). Plus
exported singletons `inventory`, `barnStorage` and consts MAX_HEALTH, HEALTH_DRAIN, DAY_LENGTH,
AFK_MS, PAN_SCALE, BARN_UPGRADE_COSTS. NOT on G: `_grandpaCtx`/`_camTmp` (loop-local scratch),
`container`/`hotbarSlots`/`camDock`/`*Btn` (DOM, passed by reference), `_params`/`_num` (boot-only).

## Modules (each = hoisted `function` declarations, exported by name)
- **saveload.js** — `triggerAutoSave`, `applySave(saved)` (the L147-257 load+offline+quest-boot block).
- **uiwiring.js** — `refreshUI`/`doRefreshUI`/`getDayProgress`/`getTimeString`, the buy/sell/open
  family, `eatItem`, `recordStat`, `grantReward`, `registerShopHandlers()` (wraps `setShopHandlers`).
- **buildmode.js** — `canPlaceStructure`, `openBuild`, `start{Decor,Crate,Barn}Placement`, `buyBeehive`, `buyCoop`.
- **actions.js** — `performAction` + verbs (harvest/chop/pet/weed/sprinkler/crate/bin/fish), `routeTo`,
  `resolvePendingRoute`, `findMaintenanceTask`, `selectSlot`/`getSelectedTool` (sole owner of hotbarSlots),
  `renderBuffHud`, `initActions()`.
- **input.js** — `initInput({container, hotbarSlots})`: all listeners + name prompt + cam dock + buttons.
- **gameloop.js** — `startGameLoop()`: the frame loop, `_sysCtx`/`_grandpaCtx`/`_camTmp`, new-day rollover.

`main.js` shrinks to: import state + the 6 modules + engine-init leaves; the order-locked boot
sequence (engine init → starter inventory → `applySave(saved)` → dev-params → first chunk+paint+debug
→ `initActions()`/`initInput()`/overlays/`registerShopHandlers()`) → `startGameLoop()`.

## Extraction order (state ← saveload ← buildmode ← uiwiring ← actions ← {input, gameloop})
1. **state.js + migrate all main.js refs to `G.*`** (zero behavior change; expand save shorthand keys; copy-don't-rewrite the load block).
2. saveload.js
3. buildmode.js
4. uiwiring.js
5. actions.js
6. input.js
7. gameloop.js
8. verify main.js is the thin bootstrap; drop dead imports.

## MUST-FIX items the adversarial critic flagged (fold in while executing)
- **C2/C3 — don't drop boot side-effects.** `applySave` must migrate L247-257 too: `G.season =
  getSeason(G.day)`, `setSeasonGrowth(effectiveGrowth(...))`, `startFestival`, **`initGrandpa()`**,
  `spawnInitialWeeds`/weed restore, fresh-game gameTime default — AND must run `initAnimals(!saved)`
  for fresh games (do NOT early-return when `saved` is null). Otherwise new games boot with no
  Grandpa and no starter animals/weeds.
- **C4/C5 — save integrity.** Expand every save shorthand `{coins}` → `{coins: G.coins}`. Preserve
  every `?? default` and `if (saved.x)` guard byte-identically (just prefix the assignment with `G.`).
- **M2 — put `recalcBarnCapacity` in `state.js`** (it needs only `G` + `getBarnCount`/`BARN_CAP` from
  the barns.js leaf), NOT in buildmode.js — otherwise saveload (step 2) imports it from a module that
  doesn't exist yet (step 3).
- **H1 — one owner for `hotbarSlots`.** actions.js owns it (`initActions()`); input.js calls
  `selectSlot()`/`getSelectedTool()` instead of indexing its own copy.
- **H2/H3 — init-time side effects.** `showNamePrompt` definition lives in input.js (exported, called
  from boot with `onDone` passed in). The Follow-button `setInterval` (pulse) and `setShopHandlers`
  must live inside init functions, never at module top-level.
- **H4 — gameloop.js must import** `sparkle`, `playStore`, `getNearestDrop`, `notify`, `refreshUI`
  (the `_sysCtx` ctx fields) or it throws on frame 1.
- The natural import cycles (saveload↔buildmode↔uiwiring) are **inert** because every cross-edge is a
  hoisted-function call deferred to runtime; just keep them hoisted `function`s and keep the only
  boot-time cross-calls (`registerShopHandlers`, init fns) inside `main.js`'s boot sequence.
