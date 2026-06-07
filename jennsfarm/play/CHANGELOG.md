# 📜 Jenn's Farm — Changelog

Build-by-build history (oldest → newest), distilled from the 65 commits on `master`.
Each line shipped to https://tront.xyz/jennsfarm with the QA suite green.

## Foundation
- Initial landing page + playable 3D demo build
- Idle + performance pass; crop-queue dedupe fix
- Fence gate (east edge); held tool shown in hand; gender select (default girl)
- Offline roadside buyers (passive sales while away)

## Core farm & life sim
- Pet animals (cozy interaction) + animal feeding & hunger (#23)
- Animals react to Jenn's presence (#23)
- Seasons: Spring / Summer / Autumn / Winter (#28)
- Vineyards — grapes + wine (#29)
- The cottage is a real, enter-able home; sleep to skip the night (#6)
- Living overgrowth + lawn mower (#32)

## Economy & progression
- Factories + employees — auto-production (#30)
- Corporation arc — farm → Shampoo Corporation, ranks + sell bonus (#31)
- Equipment progression — wider tool tiers (#33)
- Crate delivery + exploding open-to-place decor (#36)

## World tech
- Infinite world — terrain chunk streaming (#34)
- Real A* pathfinding — "get there no matter what" (#25)
- Spatial hashing + a swarm of visible skunks (#40)
- Heightmap terrain + vertex painting on the wild (#39)

## Ambiance & polish
- Bag hover tooltips — sell price + heal value (#41)
- Seasonal weather — snow + falling leaves (#42)
- Fireflies at night + butterflies by day (#46)
- Drifting cloud shadows (#43)

## The brainstorm 10 (cozy depth)
- Grandpa's mailbox — daily letters + delivery quests (#45)
- Beehives + honey (#44)
- Wishing fountain — coin → random blessing (#47)
- Pets — a puppy that follows Jenn + fetches drops (#48)
- Fishing at the pond (#49) + rare **Catfish** 🐱 and **Bob** (a fish named Bob)
- Cooking — hearty meals in the Workshop & Kitchen (#50)
- Greenhouse — full-speed crops year-round (#51)
- Seasonal festivals (#52)
- Crop quality — star grades (#53)
- Visitor cats + food bowl (#54)

## Engine modularization
- System registry — the mod-loader core (#9)
- Migrated bees / fountain / crates / pet onto the registry (#9)
- Cloud shadows = first pure self-registering feature

## Fixes & critters
- Fixed camera-glued weather particles + "she doesn't go where I click" (A* fallback)
- Debug overlay + FPS + grass-density cut (#55, #35)
- WAY more skunks + possums (wifey asked 5×)
- Carnivorous flytrap (#58) — eats crows, **NEVER skunks**

## Recent run (depth & systems)
- Shop organized into labeled sections (#56)
- Road traffic variety — trucks / cars / vans (#57)
- Crop quality: watered = premium harvests (#53)
- Market polish — bag value, value sorting, stack totals (#57)
- Unified overlay dismissal — ESC + click-backdrop (#56)
- Consistent panel chrome — corner ✕ + unified titles (#56)
- More Grandpa quests — a "next chapter" chore chain
- Visitor variety — skunks, rabbits, ducks, possums (#54)
- **Meal buffs (#50):** luck → speed → growth, with HUD pills
- Fish sizes + personal-best records (#49)
- **Multiplayer groundwork (#8):** sync protocol + remote-peer interpolation
- Rare ⭐⭐⭐ **golden harvest** completes the quality tiers (#53)
- Adoptable **cat** pet — "owned cats" now reachable (#48)
- **Farm ledger (#18):** lifetime counters + 🏅 milestone celebrations + planted/watered/sold

## Perf + movement pass (#35, #25, #12)
- **Instance/merge everything:** sprinklers → 1 InstancedMesh; cottage / shops / market / barn each bake into 1 draw
- **Instant click-to-move:** Jenn steps off the same frame; A* route resolves the next frame (no input lag)
- **Real fence collision:** the rails are now a solid wall — player & A* respect them, routing through the gate
- **Crossroads gates:** N/S/E/W openings at the farm's centre on each edge
- **Smarter farmhands:** workers claim DISTINCT drops + boids-lite separation steering (no more dogpiling one egg)
- **Sims-style build mode (#36):** buying a beehive/coop opens placement — a green/red ghost follows the cursor, click to place (re-arms for rapid building), ESC / right-click cancels. No more random auto-placement.
- **🔨 Build catalog (#36):** a dedicated Build panel (button + `B` key) listing structures **and 12 new cosmetic decor props** — hay bale, flower bed, signpost, bench, gnome, lamp post, topiary, bird bath, picnic table, stone well, statue, windmill. `R` rotates while placing. Every prop **type is one InstancedMesh** (a hundred of one = a single draw) and decor is saved with your farm.
- **✨ Farm Beauty (#54):** decor now *does something* — each prop adds beauty, and a prettier farm **draws more visitors, faster, and they linger longer** (cap scales 4 → up to 14). Beauty shows in the Build panel and on every placement.
- **📊 Perf HUD overhaul (#35):** frame-time **histogram**, p50/p95/p99/max, **CPU work ms vs real GPU ms** (timer-query), tris/geo/tex counts, a CPU/GPU/vsync-**bound verdict**, and a `no-cull` count — so spikes the EMA hid are finally visible.
- **🌲 Trees are soft obstacles (#25):** A* now routes *through* a couple trees (small cost penalty) instead of taking a giant detour, and Jenn brushes straight through them — fences/buildings/water stay hard blocks.
- **🩹 Shader-churn fix (#35):** chunk leaf/grass now use SHARED materials instead of a new pair per chunk — wandering no longer churns materials or risks shader-program recompiles (a 50ms hitch source). Added a live `prog` (shader count) readout to the HUD.
- **🐦 Crows are real birds now (#62):** added wings + tail to the model and gave them flight — they cruise at altitude with a wing-flap, swoop down to peck, and climb steeply when a skunk spooks them. A flock of ~12 wheels around the farm so skunks finally have something visible to chase.
- **🏭 Factories are visible buildings now (#64):** the Winery / Creamery / Juicery (and new Perfumery) raise a real building in an "industry row" west of the farm when you own them — no more invisible upgrades. Each is one merged draw call and restores from your save.
- **🌸 Perfumery — late-game tier (#63):** a new high-end factory (🪙3500) turning Roses → Perfume (🪙300). First of more late-game content to come.
- **❄️ Snow + seasons beefed (#65):** Winter snow is now ~2.5× denser with varied flake sizes and wind drift, plus a soft **snow blanket** that eases onto the ground around you. Autumn drops more leaves too.
- **🎥 Camera overhaul (#72–74):** **scroll-wheel zoom** (in/out), and right-drag now gives a true **unlocked god-eye camera** that stays put (no auto-snap-back, no bounds). A button dock (top-right): **📍 Follow Jenn** (re-locks; pulses gold while unlocked), **🏡 Go Home** (Jenn walks to farm centre + camera re-locks), and **🌾 / 🛒 POI** quick-views.
- **😊 Mood (#75):** Jenn visibly reflects her heart — lively bounce + upright when happy, sluggish + sagged when tired/low.
- **🏚️ Placeable Barns (#71):** build extra Barns from the Build menu (🪙600) — each adds **+100 depot storage** and raises a real barn (one merged, frozen draw). Stacks with the barn-level upgrade; saved with your farm. Move-mode next.
- **👻 Build-mode ghost = real model (#36 polish):** the placement preview is now a translucent green/red silhouette of the *actual* thing you're placing (hive, crate, decor prop, …) instead of a generic box — you see the true shape + footprint before you commit. (Move-mode + placeable barns next.)
- **🏚️ Barn is a real depot now (#68):** factories pull their inputs from the **bag first, then the barn** — so grapes/milk you stockpile in the barn finally feed production (no more "0 in stock" when the shed is full). The Factories panel "in stock" counts bag + barn.
- **🧺 Wooden Crates + working farmhands (#67):** place **Wooden Crates** (Build menu, holds 50 crops, with a fill bar). Your factory-employee farmhands now run a real labour loop — walk to a **ripe crop → harvest it → carry the armful to the nearest crate → deposit** (and fall back to vacuuming loose drops). They **claim distinct crops** so they never dogpile. Click a full crate to collect it into your bag. The farm finally *looks* worked. All instanced/cheap.
- **🐉 Premium late-game crops (#63):** **Dragonfruit** (slow-growing, re-fruiting, 🪙130×2) and the **Golden Pumpkin** (150s grow, 🪙400 — the new priciest raw crop) give big farms a real money goal. Buy seeds in the shop, plant from the hotbar.
- **🔭 Aggressive culling + tight view (#35):** chunk load radius 2→1, camera far 200→60, fog 12–32 → 8–16. You see ~16 tiles of cozy world instead of the whole valley — far fewer objects for Three.js to matrix-update, cull and draw.
- **🧊 Static-world matrices (#35):** streamed chunk decor freezes its matrices after build (`matrixAutoUpdate=false`), so Three.js stops recomputing thousands of static transforms every frame.
- **🩹 Snow-dome fix:** the winter ground-snow now fades out radially (no more giant white dome at the horizon).
- **♻️ Less GC churn (#35):** the per-frame system/grandpa context objects + camera vector are now reused instead of re-allocated every frame, and static buildings freeze their matrices. Cuts the browser/GC overhead that was pushing frames over 16ms.
- **🔬 HUD `cpu` vs `js` split:** now shows actual game-loop work (`js`) separately from total frame CPU (`cpu`) + a sharper bound verdict (GAME-JS / browser-GC / GPU / vsync-edge) so we can pinpoint the bottleneck. Confirmed: `js` ~5ms (game is fast), the rest is browser GC/paint — so:
- **✂️ Real frustum clip (#35):** camera far-plane pulled to 22 (just past the fog) so the GPU actually discards the far world instead of drawing 16–60m of fog-hidden geometry.
- **🛰️ Simulation distance (#35):** wildlife beyond 24 tiles freezes — no AI, movement, matrix uploads or spatial-hash inserts for the far population (livestock + Grandpa always tick). Entities no longer "active from way too far."
- **♻️ Allocation-free spatial hash (#35/#40):** numeric cell keys instead of string keys — kills hundreds-to-thousands of string allocations per frame (the main GC churn behind the 33ms spikes).
- **🖼️ Throttled UI (#35):** factory/coop/bee production was rebuilding the bag/hotbar DOM many times a second; now coalesced to ~6×/sec — big browser-paint cut.

---

## 🌟 Big session recap — June 2026

A marathon pass. Highlights:

**Performance (was 33–50ms spikes → now locked 60 FPS):** real frustum clipping, tight fog, sim-distance culling, allocation-free spatial hash, throttled UI, frozen static matrices, shared chunk materials. The debug HUD gained a frame-time **histogram + p50/p95/p99 + CPU/GPU/`js` split + bound verdict**.

**The logistics loop (Alice-Greenfingers-ish):** 🧺 Wooden Crates → 👷 farmhand employees that **harvest crops & carry them to crates** (claiming distinct crops, no dogpiling) → 🏚️ **barn depot that now feeds factories** → 🏚️ **placeable barns** (+storage each).

**Build mode:** 🔨 catalog (B), **real translucent model ghosts** (not boxes), `R` rotate, 12 decor props with a ✨beauty score that **draws more visitors**.

**World & content:** 🐦 crows are real flying birds (skunks chase them), 🏭 factories are **visible buildings** + a 🌸 Perfumery tier, 🐉 Dragonfruit + 🎃 Golden Pumpkin crops, ❄️ beefier snow.

**Camera & feel:** 🔍 wheel zoom, 🎥 unlocked god-eye camera, 📍 Follow / 🏡 Home / POI button dock, 😊 Jenn's mood reflects her heart.

**▶ Next up:** task queue (click several plants → harvest in order), haulers (crate → barn), finite bag + cellar perk, move-mode for placed buildings, live entity-count stats, economy rebalance.

---
_For planned work see [BACKLOG.md](BACKLOG.md); for the categorized status see [ROADMAP.md](ROADMAP.md)._
