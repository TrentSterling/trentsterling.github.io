# 🌾 Jenn's Farm

A cozy 3D farming game built for Jenn. Plant, harvest, fish, cook, raise animals,
grow a farm into a shampoo empire — with skunks everywhere, because wifey asked.

- **Live:** https://tront.xyz/jennsfarm  (GitHub Pages → `tront.xyz`)
- **Source of truth:** `B:/trontdev/site/jennsfarm/play/`  ← *this folder is the real game*
- ⚠️ The separate `B:/trontdev/jennsfarm` React repo is a **DECOY** — do not edit it.

## What it is
A no-build, static **Three.js 0.160** game (ES modules via CDN importmap). No bundler,
no npm install — just static files served over HTTP. Curved-world shader, instanced
decor, A* pathfinding, deterministic chunk streaming, localStorage saves.

## Run it locally
```bash
cd B:/trontdev/site/jennsfarm/play
python tools/serve.py 8150      # no-cache static server
# open http://localhost:8150
```
Global Node v12 here is too old for Vite — use the Python server.

## Test it (the QA suite)
~96 assertions run headlessly through a screenshot:
```bash
cd B:/trontdev/site/jennsfarm/play
bash tools/shot.sh "tests/suite.html" suite.png 13000
```
Then **always** kill leftover headless Chromes:
```powershell
Get-Process chrome | Stop-Process -Force
```
> RIG RULE: headless = **suite only**. Booting `index.html` headless hangs on the
> Google-font link and leaves zombie Chromes. Run one test at a time, foreground.

## Project map
```
index.html        # importmap + HUD markup + overlay panels
css/style.css     # the unified design system (panels, HUD, pills, ledger)
js/               # 51 ES modules, one concern per file
  main.js         # thin orchestrator: input, game loop, save/load, action handlers
  registry.js     # mod-loader core — systems self-register + tick via updateSystems()
  farm.js world.js terrain.js chunks.js   # land, crops, tiles, streaming
  player.js pathfind.js spatialhash.js    # movement, A*, critter/drop lookup
  animals.js pets.js visitors.js flytrap.js   # critters (skunks!), pets, wildlife
  market.js factories.js corp.js crates.js equipment.js   # economy + progression
  buffs.js quality.js stats.js fishing.js foods.js craft.js   # depth systems
  weather.js fireflies.js cloudshadows.js fountain.js bees.js festivals.js  # ambiance
  netsync.js      # multiplayer sync data layer (groundwork, not yet wired)
  ui.js juice.js renderer.js textures.js   # presentation + game feel
tests/suite.html  # the headless QA suite (~96 assertions)
tools/            # serve.py, shot.sh (headless screenshot)
```

## The docs in this folder
- **[ROADMAP.md](ROADMAP.md)** — every requested feature, by category, with status.
- **[CHANGELOG.md](CHANGELOG.md)** — what shipped, in order.
- **[BACKLOG.md](BACKLOG.md)** — what's next + what needs Trent vs. what an agent can do solo.

## Conventions (for any agent picking this up)
- Each feature = one focused module that **self-registers** with `registry.js` when it can.
- Ship working, suite-tested slices; keep the suite green; commit + push to `master`.
- The wife has a live save — **never break the save format**; new fields load to empty.
- Skunks are sacred. The flytrap eats crows, **never skunks**. 🦨
