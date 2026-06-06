# 🗺️ Jenn's Farm — Roadmap & Feature Status

Every feature you and Jenn requested, grouped by area, with where it stands.
**Legend:** ✅ done & live · 🟡 in progress · ⬜ planned / needs Trent

_Snapshot: 52 of 58 tracked features done · QA suite at ~96 assertions, all green._

---

## ✅ Your older shortlist — all accounted for
The list you remembered, mapped to what shipped:

| You asked for | Status | Where it lives |
|---|---|---|
| Persistence (saves) | ✅ | localStorage autosave + offline progress while away |
| Multiplayer | 🟡 | sync data layer built (`netsync.js`); PeerJS transport pending (needs you) |
| Animals — skunks chase crows | ✅ | `animals.js` — skunks hunt crows; ~20 skunks roam |
| NPCs like Grandpa | ✅ | Grandpa guide + intro quests + daily mailbox letters |
| Home, not just a market | ✅ | enter-able cottage; sleep to skip night; farm ledger inside |
| Better 3D models | ⬜ | still low-poly primitives — needs art (Kenney/Quaternius) |
| Marketplace like Alice Greenfingers (dynamic pricing) | ✅ | `market.js` — supply/demand, flooding tanks prices, trends |
| "Game too easy, just unlock things" | 🟡 | flagged as **#4 economy rebalance** — wants your tuning calls |
| Decor | ✅ | crate delivery + open-to-place decor |
| Ocelots / roosters | ⬜ | livestock + critter variety shipped; these two species not yet distinct |
| Minecraft-style chicken farm | 🟡 | chickens lay eggs + animal pens/feeding exist; automated farm = backlog |
| Goat milk sells more than cow milk | ✅ | verified by test: goat 52 > cow 34 |
| Cows | ✅ | livestock (cow milk) |
| Different herbs & flowers | ✅ | mint (herb); lavender, rose, tulip, sunflower (flowers) |
| Crafting & potion mixing | ✅ | cheese, jam, perfume, love potion, elixir, wine + cooked meals |
| Square watermelons cost more | ✅ | verified by test: square watermelon = 300, priciest raw crop |

---

## 🌱 Farming core
- ✅ Plant / water / harvest with growth stages
- ✅ Regrowing multi-harvest crops (tomatoes re-ripen; carrots one-shot) — Alice Greenfingers style
- ✅ Watering matters: watered crops grow faster **and** harvest at higher quality
- ✅ Watering can + **sprinklers** (auto-water a 3×3, even offline)
- ✅ **Crop quality (#53):** watered = ⭐ premium (+1), ⭐⭐ bumper (+2), rare **🌟 golden** (⭐⭐⭐, +3)
- ✅ Fruit-bearing trees (drop fruit) + choppable trees with regrowing stumps
- ✅ Vineyards — grapes → wine
- ✅ **Greenhouse (#51)** — full-speed growing year-round
- ✅ Starting weeds/debris to clear

## 🐄 Animals & critters
- ✅ Skunks (lots — wifey asked 5×), they chase/scare crows
- ✅ Possums, honey badgers, crows (pests)
- ✅ Livestock: cows (milk), goats (milk, sells more), chickens (eggs)
- ✅ Pens, feeding + hunger, petting (hearts), animals react to Jenn
- ✅ **Pets (#48):** adopt a 🐕 dog **or** 🐈 cat — follows you, fetches drops
- ✅ **Visitor wildlife (#54):** stray cats, skunks, rabbits, ducks, possums wander in; a **food bowl** draws more
- ✅ **Carnivorous flytrap (#58):** eats crows — *never skunks* 🦨
- ⬜ Distinct roosters / ocelots; automated chicken farm (backlog)

## 🎣🍲 Activities & depth
- ✅ **Fishing (#49):** cast at the pond — incl. a Catfish 🐱 (it has a cat face) and **Bob** (a fish named Bob)
- ✅ Fish **sizes + personal-best records** (Bob is always 4 lb)
- ✅ **Cooking / Kitchen (#50):** hearty meals from crops, fish, honey, eggs
- ✅ **Meal buffs (#50):** eating special meals grants timed buffs — 🍀 luck (better quality), 👟 speed, 🌱 growth — shown as HUD pills
- ✅ Crafting & potions (cheese, jam, perfume, love potion, grand elixir, wine)

## 💰 Economy & progression
- ✅ **Dynamic market (#26):** supply/demand pricing, flooding tanks prices, hot/glut trends
- ✅ Market polish — bag value, value sorting, per-stack totals, "Sell All"
- ✅ Drive-by buyers + road (passive sales); offline buyers while away
- ✅ **Factories + employees (#30):** auto-production
- ✅ **Corporation arc (#31):** farm → Shampoo Corporation, ranks + sell bonus
- ✅ **Equipment tiers (#33):** mower → tiller → wider rigs
- ✅ **Crate delivery + place (#36):** build/decor system
- ✅ Idle/incremental loop: offline progress, AFK auto-farm (maintenance only)
- 🟡 **#4 Economy rebalance** — you flagged "too easy"; needs your difficulty calls (risky to tune blind on a live save)

## 🌍 World & tech
- ✅ Infinite world via **chunk streaming (#34)** (deterministic, seeded)
- ✅ Heightmap terrain + vertex painting; instanced grass/flowers
- ✅ **A* pathfinding (#25)** — "get there no matter what"
- ✅ Collision (player vs buildings/water/trees)
- ✅ Spatial hashing for critters/drops; staggered ticks; frustum/perf pass
- ✅ Seasons (Spring→Summer→Autumn→Winter) with growth modifiers
- ✅ **System registry / mod-loader (#9):** systems self-register + tick via `updateSystems()` — lets agents add features in parallel; also the multiplayer sync surface
- 🟡 **#35 Performance** — ongoing (grass density cut, instancing, culling)
- ⬜ **#38 Floating origin** — far-travel jitter fix (low priority/risk)

## ✨ Ambiance & juice
- ✅ Seasonal **weather** — snow + falling leaves
- ✅ **Fireflies** at night + butterflies by day
- ✅ Drifting **cloud shadows**
- ✅ **Wishing fountain (#47)** — toss a coin for a random blessing
- ✅ **Beehives + honey (#44)**
- ✅ **Seasonal festivals (#52)** — bunting + gifts on season change
- ✅ FRIM "juice" pass — squash/stretch, pops, shake, particles, sounds

## 🧑‍🌾 NPC, quests & personal touches
- ✅ **Grandpa** (Alice Greenfingers-style guide)
- ✅ Intro chore chain **+ a "next chapter"** of bigger milestone chores
- ✅ **Grandpa's mailbox (#45):** daily letters + delivery requests
- ✅ Player is **Jenn** (nameable); gender select
- ✅ Easter eggs + personal touches for Jenn
- ✅ **Farm ledger (#18):** lifetime counters (crops, goldens, fish, trees, cooking, planted, watered, sold) + **🏅 milestone** celebrations

## 🎛️ UI / UX
- ✅ UI mega-polish pass; clickable highlighting + click feel
- ✅ Bag hover tooltips (sell price + heal value)
- ✅ Shop organized into labeled sections
- ✅ **Unified overlays (#56):** every menu closes by ESC / click-backdrop / corner ✕; consistent titles
- ✅ **Debug overlay (#55):** pathfinding cubes + lines + FPS (backtick to toggle)
- 🟡 **#56** remaining: on-screen HUD-overlap pass (best done with a live look)

## 🌐 Multiplayer (#8 — in progress)
- ✅ **Sync protocol (data layer):** world is procedural from a shared seed, so peers sync only player-caused **tile deltas** + tiny **transform packets** (`netsync.js`)
- ✅ **Remote-peer interpolation:** smooth avatars between sparse packets
- ⬜ **PeerJS transport + host/join UI** — needs you (a live second peer to test against)
- ⬜ Wire delta recording into live edits; sync buildings via registry serialize

## 🔊 Audio (#19 — needs assets)
- ⬜ Music tracks (incl. the honey-badger song) — drop the files on `B:` and they'll be wired

---

See **[BACKLOG.md](BACKLOG.md)** for the prioritized "what's next" and **[CHANGELOG.md](CHANGELOG.md)** for the build-by-build history.
