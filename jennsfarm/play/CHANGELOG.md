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

---
_For planned work see [BACKLOG.md](BACKLOG.md); for the categorized status see [ROADMAP.md](ROADMAP.md)._
