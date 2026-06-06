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

---
_For planned work see [BACKLOG.md](BACKLOG.md); for the categorized status see [ROADMAP.md](ROADMAP.md)._
