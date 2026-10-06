# Gameplay gallery media

Gameplay previews for `/games/`, with capture recipes and playback verification.
Master recordings, source snapshots and detailed local receipts stay in ignored
`.local/`; the gallery uses the optimized media in `games/media/`.

The expanded gallery has **91 animated cards**: 55 fresh browser recordings,
seven native offscreen captures, and 29 archival previews. Every animated card has a reviewed edit with at least two
shots, including a wide view and a closer crop. 139 additional photography
takes were recorded for this montage pass; rejected takes remain in the archive.
Archives include original gameplay GIFs,
official Demigod trailer gameplay, 2023 Scamper sewer footage, the original
FezCraft animation, and Trent's own YouTube recordings and project-hosted clips.
Demigod remains first. There are 110 WebP posters, including the new ASCIICITY
capture. All 117 project links, descriptions, tags and ordering are preserved.

Total card media: **40,388,791 bytes**, versus 67,404,137 original image bytes.
Every preview is under five seconds and 1 MB (largest: 994,819 bytes).
Originals and game repositories are unchanged. Source footage and the previous
card media remain in ignored `.local/` for further editing and comparison.

## Local review

From the site root, run `node tools/game-media/server.cjs`.

- Gallery: http://127.0.0.1:8965/games/
- Format comparison: http://127.0.0.1:8965/.local/benchmark/review.html

A reused pool allows 12 desktop previews, four on desktops reporting at most
4 GB memory, and two on screens up to 700 CSS pixels. Visible cards autoplay.
Hover and keyboard focus immediately prioritize an available preview; neither
is required. Extra eligible cards rotate in every 6.5 seconds.

Normally 55% of an image must be visible below the navigation. Hover/focus can
start a partly visible image. Offscreen, filtered, paused and hidden-tab sources
are released. Reduced motion and data saver use posters. Pause persists across
reloads. Unsupported/blocked playback keeps the poster. There are no GIF fallback
downloads on the gallery.

## Recording and preparation

Requires Node, FFmpeg/ffprobe, Chrome and Playwright. The default Playwright path
is `C:/trontstack/tmp/card-refresh/tools/node_modules/playwright`; override with
`PLAYWRIGHT_MODULE` if needed.

Run `node tools/game-media/capture.cjs buddy` for one game, or omit slugs for all
configured captures. Then run `python tools/game-media/prepare.py` and
`node tools/game-media/verify.cjs`.

For the current edits, `montages.json` is the edit decision list: original source,
in point, output duration, optional playback speed, framing, crop, and descriptive label for each cut. Crop
coordinates refer to a fitted 1280 x 720 source view. Edit that file, then run:

```powershell
python tools/game-media/montage.py
python tools/game-media/prepare.py
python tools/game-media/audit-montages.py
node tools/game-media/verify.cjs
```

`takes.cjs` records additional footage into `.local/takes/`; for example,
`node tools/game-media/takes.cjs deadends-0 breakmass-bridge`. Each take has
before/after telemetry, error receipts and screenshots. `contact-sheet.py`
generates timestamped sheets for shot selection. `montage.py` reads masters,
never the already-compressed gallery clips. `prepare.py` copies completed edits
without re-encoding and adds content-version queries to video and poster URLs.
For sparse canvas recordings, `accurateTrim` normalizes held frames before
sequential trimming, preserving the intended in-point and duration. The edit
cache includes the recipe, source metadata and encoder script hash.

`refine.cjs` adds closer camera positions and additional map/weapon takes. For
example, `node tools/game-media/refine.cjs breakmass-clear-street biomass-clear-4`.
`audit-takes.py` measures actual encoded frame counts independently of animation
callbacks. The 139 saved takes total 2,164.67 seconds, with encoded rates from
8.56 to 59.45 fps. These include timestamped DOM screencasts; the canvas takes
request 60 fps. The gallery derivatives remain 30 fps or lower.

`variety.cjs` records additional scenes and longer action sequences. SLOPELOOP
now shows a launch, landing and arch approach from its normal replay pilot.
Froxel cuts between all three scenes, and Light Studies includes the After Hours
storefront, rotating car with paint change, and animated polygon reflections.
Send Dudes keeps the large army view before a much closer rupture and titan fight.
Colony uses ordinary mining tasks at daylight, with 34 blocks removed by its AI
in the recorded take. VibeCraft uses an ignored photography copy that exports
its camera and holds daylight; the terrain and meshing remain the original code.

`gameplay-variety.cjs` supplies new Tiny Treads, INKRIDE, Fellswoop and Aqua
Empire takes. Tiny Treads cuts directly to Crater Maker, Laser Battery and
Pineapple impacts. INKRIDE shows jumps and collisions on three original tracks,
ending before the later stationary sections. Fellswoop uses its original sandbox
and camera controls for wide and close axe cuts, tree reactions and flying logs;
the two selected takes felled 296 and 282 trees through the shipping simulation.
Aqua Empire combines actual feeding (22 pellets consumed in the master) with
a Broodship defeat in the kelp aquarium. Its ignored copy changes only HUD text
and hint-box presentation; attack effects, lasers and health indicators remain.
The earlier full-fish feeding take was rejected because no pellets were eaten.

`prototype-retakes.cjs` records Terrain Lab, Megabunk and VibeVoxelProbes using
their original systems. Terrain Lab shows three meteor impacts and a brush-built
bridge; its construction cut runs at 2x. Megabunk uses keyboard movement, jumps,
terrain collision and the original follow camera across ridge, summit and cliff
routes. Cuts exclude late camera occlusions and stationary endpoints. The lighting
demo shows its full moving field and close probe responses; the six-light close
take preserves color better than the rejected twelve-light candidate. Mild gamma
adjustments improve dark-card readability. Export hooks in ignored copies expose
the existing controls; stripping those hooks reproduces the cached source files.
Source and action proofs are in `.local/prototype-retakes-review.json`.

`smear-v16-retakes.cjs` captures the published V16 update through its existing
grab and camera controls. Wide, close and overhead shots follow a dragged dummy
forming a broad blood curl, inspired by the original OG image. The source snapshot
matches both commit `d13769f43c6df21dda9e74ec0c6d7edd1871fb75` and the live build.
The three cuts run at 2 to 2.5x; the original GPU dynamics and paint are unchanged.
Earlier swing and gunfire takes from `interaction-retakes.cjs` remain archived.
That recorder also supplies Pachinko's two generated boards, a close peg bounce and a thousand-point
prize; the close crop retains the sampled ball bounds. Capture drops a new ball
only after the previous one finishes. Sudoku uses the original palette and cell
click handlers to place all 48 missing symbols correctly. Its three 2x cuts show
successive rows filling and exclude the later winning overlay.

`math-retakes.cjs` records the original FRIM and VibePrime interfaces with page
explanations and controls hidden. FRIM retains proportional canvases, both
comparison rows and FPS labels, with cuts around active cycle resets. VibePrime
shows its 300-number sieve progressing to all 62 primes. The take runner supports
DOM screencasts with source timestamps and per-take output directories. Physics,
puzzle, prize, smoothing and sieve evidence is in
`.local/interaction-retakes-review.json`; rejected framing attempts remain saved.

`detail-retakes.cjs` records actual routes through ASCII Wolfenstein, VibeMaze
and ASCIICITY. The two raycasters use their original forward movement and wall
collision with a page-scoped steering pilot. VibeMaze collects items along both
routes. ASCIICITY uses built-in color and paper presets, larger glyph cells and
two street routes; the color cuts have a mild gamma lift. DOM crops preserve
glyph proportions. Wolfenstein's source simulation runs at 20 Hz, independently
of the derivative's encoded frame rate.

Vixels combines the complete island, a masonry block and a woodland material
close-up through its existing camera and material controls. Its selected takes
use frequent mouse input because the renderer updates on demand. The original
slow-input takes and the overly abstract end-grain macro remain unselected.
Spheres combines its built-in color, blinking-eye and radar shaders on different
packing seeds. A proportional crop of the square preview removes side margins
without stretching circles. Source, movement and control receipts are in
`.local/detail-retakes-review.json`.

`arcade-retakes.cjs` records longer VibeCar, VibeDuders and VibePong sessions.
VibeCar uses its original vehicle physics for a crate collision, ramp jump and
steering turn; a photography camera follows the car. VibeDuders shows normal
right-click blasts and crowd flow at two zoom levels. VibePong combines a full
court rally, a half-speed close paddle impact and the original multiball pickup.
The final cuts preserve the visible interactions; action and source receipts are
in `.local/arcade-retakes-review.json`.

`spatial-retakes.cjs` captures continuous Floating Origin travel and VibeBounce
reflections. Floating Origin keeps its original movement, streaming and rebasing;
the flight take crosses fifteen rebases, while the close ground cut includes one.
VibeBounce has a capture-only rendering correction: its original material enables
vertex colors on geometry with no color attribute. Neutral white vertex colors
restore its existing instance colors. The voxel layout, SVO and reflection code
are unchanged. Outside, chamber and shaft views show the original ray paths.
Before/after images are in `.local/review/bounce-*-colors.png`; source, continuity
and reflection evidence is in `.local/spatial-retakes-review.json`.

`build-flow.cjs` captures the requested construction and simulation sequences.
TinyRise builds all 416 cells of a block from an empty plot using the game's
transactions, architecture generation and placement springs; its edit runs at
2x, with a brief empty-plot opening and a final second at normal speed.
Volumetric Light Beam uses its original beam creation and shader code with
2,048 beams, shown from above and inside the field. Its original VibeSand water
reservoir takes remain archived for comparison with the sand-and-water reshoot.
Only ignored photography copies expose the controls used for these recordings.

`sand-water-retakes.cjs` now stages a sand beach, a shallow container filled with
sand, and a raised water tank with a sand bed. The original Paint and Destroy
brushes produce the sand stream and side breach; the original GPU simulation
fills the basin and exposes the bed as the tank drains. Four softer existing
point lights and a higher fill camera make the materials easier to see. The
4.8-second edit uses four cuts, with the long fill and drain sped up to 9x and
12x. Rejected lighting, framing and fixture attempts remain in the take archive.
Source, action and browser evidence for this pass is in
`.local/latest-retakes-review.json`.

CellGen's edit preserves the complete 12.4-second original GIF timeline, including
the full-dungeon opening and the visibility switch at 5.4 seconds. The second
phase has a closer crop around the moving visible-cell region. Both phases are
retimed to fit a 4.8-second preview; the source GIF remains unchanged.

`farm-capture.cjs` replaces Jenn's Farm's empty-plot preview with 48 planted crops
growing through all four stages and Jenn harvesting ten crops through the original
task queue. The staged field uses the original crop, watering and growth APIs;
inventory gains are verified by `audit-farm.py`. The growth master adds six crop
simulation seconds per second and its opening cut runs at 5x. The two harvest
cuts run at normal speed. The photography camera moves the fog band out of view
while retaining the fog object required by the game's day/night system. Source
modules are unchanged; the inspection handle lives in the ignored copy.

`record-audiobounce.ps1` stages the original AudioBounce Unity package in an
isolated project and records its multi-room demo in hidden batch mode using
Direct3D 11 on the RTX 5070 Ti. The original manager, voxelizer, compute shaders,
renderer and source movement remain unchanged. The original HUD/input component
is disabled after scene creation; its bug and pulse updates are invoked directly.
The three existing bug paths are staged 0.6 metres higher to clear the conservative
floor voxels. A listener walks through the rooms independently of the photography
camera, with audio muted. The added light and three camera paths improve framing.
The selected master contains 1,080 unique 1280 x 720 frames across 18 seconds at
a fixed 60 Hz simulation step; this is not a realtime performance measurement.
`audit-audiobounce.py` verifies unchanged package hashes, source movement, occupied
voxels, GPU reflection segments, occlusion results and full video decode.
The 4.83-second card uses 480 x 270 at 24 fps to retain the dense ray detail under
1 MB. The first take and a rejected listener-setup attempt remain in `.local/`.

Dynamite Max now uses Trent's October 29, 2010 Papervision3D gameplay upload
(`KZftmS7gLvA`), replacing the later FlashPunk version. The three cuts retain the
player and moving crates in frame. The fixed debug text is cleaned with FFmpeg's
delogo filter; the image is cropped and its dark recording exposure is lifted.
The untouched original remains in `.local/archive-video/recovered/`.

Native recordings also stay offscreen. `prepare-ducktoy.py` stages an ignored
source copy with an offscreen entry point and 1024 x 576 GPU readback. Its six
ducks use the original flock, collision, deformation and shader code. The master
has 360 frames at 60 fps and 211 physics impacts; the final close-up uses the
project's existing GPU-rendered brush interaction APNG on a neutral background.
`prepare-native.py` stages those original APNGs and an isolated TrontEQ recorder.
`tronteq-capture.rs` calls the original EQ canvas, FFT analyzer and Scope Trails
renderer using generated stereo samples. It records 210 frames at 30 fps.
Neither recorder starts the app shell, polls OS input, or opens audio devices.
These fixed-step captures are not realtime GPU performance measurements.
`prepare-trontsnap.py` stages the original gallery and annotation editor with
24 public project images. Its 210-frame take scrolls the gallery and draws an
arrow and box using editor-local input; it never saves an annotation or touches
the clipboard. `prepare-spaceview.py` renders the original synthetic showcase
tree with 88,335 files. Its 240-frame take zooms into Unity Projects (2.71x),
then a project (5.93x), before showing extension filtering and the type treemap.
Both run offscreen with isolated settings and no OS input or live disk scanning.
`prepare-powershellmanager.py` uses the original inert preview fixture, GUI and
GPU renderer. Its 330-frame take resizes column and row dividers, disables a slot,
switches to six slots, pins a sample window, and drags the original window list
to reorder it. All titles are illustrative and native actions remain disabled.
`prepare-downloader.py` stages the original YouTube Downloader UI, engine and
GPU test renderer. `downloader-transfer.cjs` serves the actual Dynamite Max card
over throttled loopback and runs the original engine with verified local helpers.
The saved file is checked byte for byte. `downloader-capture.rs` replays those
real progress events in the original UI, then shows completion and preferences.
The 270-frame master uses an edited event timeline; it is not a realtime screen
recording. No native window, cookies, user settings or external transfer is used.
`audit-native.py` fully decodes all six masters and checks frame counts, timing and
completion logs. Source hashes and capture receipts are in `.local/native/`.

`device-history-capture.cjs` runs the original compiled Svelte frontend in
headless Chrome. An in-memory IPC fixture supplies nine sample USB devices and
connect/disconnect events. The actual frontend handles event scrolling, USB
search, drive details and theme changes. No Tauri backend or personal inventory
is used. Original compiled asset hashes and interaction timestamps are saved in
`.local/device-history/capture.json`; the 10.56-second master is fully decoded.

`speedslap-capture.cjs` runs the unchanged SpeedSlap content script over the local
DuckToy video, with isolated extension-storage fixtures and captions disabled.
It verifies real playback-rate changes (1x, 3x, 3.5x, 4x), reset and overlay drag.
`splitter-capture.cjs` runs the original public Splitter4GPT HTML with public
README input, records changing chunk sizes and copy feedback, and keeps the
clipboard destination in page memory. Promotional sections are hidden for
framing. Both retain source hashes, action timing and error receipts.
`audit-tool-captures.py` decodes both browser masters, checks source hashes and
recorded actions, and verifies the downloader's real saved output.

DEAD ENDS uses its shipping squad autopilot, queued hordes and invulnerability.
BIOMASS now cuts between Chicane, Funnel and Islands with fresh attacking hordes,
crossfire and accumulated blood, using existing autoplay and stress controls.
BREAKMASS takes run long enough to select real structural collapse and aftermath.
Its four cuts show the street tower collapsing, the water tower falling, the
chimney tipping and the street rubble afterward, with destruction in frame.
TUNNELRAT's local pilot follows actual tunnel waypoints and drives the original
flight/collision update; recordings use existing debug invulnerability. The
rejected wandering flight take is retained but excluded from the montage. The
selected tunnel approach ends before the later drift; the reactor shot leaves
enough room around the reactor to see the fight.
Craftmine's ignored public HTML copy exports an inspection handle to the game;
its normal creative-flight and weapon systems provide a daylight terrain pass
and close rocket/BFG impacts in open desert. `action-retakes.cjs` scouts the
original seeded terrain and places a 65-degree photography camera with a clear
firing line. The accepted takes modified 1,075 and 2,518 blocks through the
original weapons. Foliage-obscured flight, snow-covered treetop targets, distant
impacts and top-down water placement takes were rejected.
The same recorder gives Buddy Bonk three original sandbox tool sequences:
freeze/air launch, rocket impacts and balloon lift. The selected moments end
before prolonged floor-rest or the large stunt-completion banner. Original
ragdoll physics remain unchanged; the isolated session has no connected peers.
BUTTLOADS 2 and Voxel Heroes use existing gameplay hooks to stage surface,
cave, outdoor and boss-room views. These photography controls are not shipped.

Source mounts are in `server.cjs`. Public build copies and dependencies are cached
under ignored `.local/sources/` and `.local/dependencies/`. `local-builds.cjs`
allows read-only requests to known asset hosts. Sessions have isolated saves,
block multiplayer WebSockets, and never use the owner's browser profile. Gems
Together uses `#solo=1`. OS pointer lock is disabled before navigation. Older FPS
games receive a page-local lock-state fixture so their controls can run without
taking over the desktop cursor.

Canvas capture requests 60 fps at 1280 x 720 or native canvas dimensions. That is
not a claim of achieved fps. Receipts identify the NVIDIA Blackwell adapter,
source hash, setup/ending telemetry and page errors. `rafFrames` counts callbacks,
not unique game frames. HTML/SVG demos use timestamped Chrome screencast frames;
these can have a lower encoded cadence. Master frame counts are stored where
measured. Browser canvas recordings use real elapsed time, not a simulated capture clock.

Derivatives are silent H.264/yuv420p MP4 with faststart, under five seconds and
at most 640 pixels wide. Most are 30 fps at CRF 23 or 24; noisy particle clips and
some low-resolution GIF archives use higher compression or 24 fps/480 pixels.
Per-clip settings are explicit in `montages.json`. Shorter archives remain
shorter than five seconds.

Actual gameplay actions, existing harness controls and clean-view modes drive
the recordings. Canvas capture omits separate HTML overlays. Aqua Empire crops
to the aquarium; Tiny Treads removes unused canvas space while framing both
tanks. Pachinko fits inside 16:9; Spheres uses a proportional 16:9 crop. Introductory copy is hidden for HTML
demos while their real interfaces run. Megabunk's current edit replaces the older
orbiting overview with original player traversal and its normal follow camera.
No generated artwork or fabricated gameplay is used.

`prepare.py` preserves `.local/games-original.html`, caches derivative signatures,
and changes card media and preview controls. It can download missing original
artwork. Masters, capture screenshots, source copies, before/after telemetry and
source hashes stay in ignored `.local/`. The manifest is
`.local/media-manifest.json`; full triage of all 117 cards is
`.local/capture-triage.json`.

Remaining entries retain their stills or placeholders. They include native app
and VR captures, libraries/static tools, and old projects without selected
recordable footage. Source identities and next steps are recorded in the triage.
Trent explicitly deferred BoostMelon, 2D AI Racer, Bookworm Clone and Marble Game
until he locates their builds or recordings. Their existing cards remain intact.

The earlier YouTube download failure was resolved for the requested footage by
using the Rust downloader's bundled yt-dlp and QuickJS, with the options in
`C:/trontstack/youtube_downloader/src/engine.rs`. No browser cookies were used.
Scamper is from A Wolf in VR's [August 24, 2023 sewer gameplay](https://www.youtube.com/watch?v=843XG0DoJuE);
the 2026 island trailer is excluded. Dynamite Max is from Trent Sterling's
[October 29, 2010 Papervision3D recording](https://www.youtube.com/watch?v=KZftmS7gLvA).
Source attribution and dates are also saved with the montage recipes.

The archive recovery pass added ConfigJoint Climbing, FarmVR, HackerPunk VR,
Magic Archer, 3 Day RPG, That Dummy, VaultScript, MonkePortals, Guys, Girls, and
Guns, Super Turbo Ship Puncher 3, and Voxel Bomberman. Dash Till Dawn now uses
Trent's full gameplay recording. The combined Punchin' Duders/HackerPunk post
links a video explicitly titled HackerPunk VR; it is assigned only to that card.
FarmVR uses farm and greenhouse interaction from its intro-area recording.
The LD31 platform shooter uses two cropped gameplay shots from the final clean
interval of Trent's December 13, 2014 development recording (`Cwgr0tiM3OQ`).
The 3.2-second edit excludes the editor, menus and stats overlay. Its accelerated
source runs at 0.375x of the uploaded timelapse, so it is archival motion rather
than a realtime frame-rate demonstration. A frame-by-frame contact sheet is
saved in `.local/review/ld31-all-source-frames.jpg`.
The original BUTTLOADS recording remains unselected: tighter inspection around
116-118 and 128-130 seconds shows gameplay broken up by menus and code windows.
Magic Archer now crops away chat, disconnect, version and network overlays in
all three shots, with a closer crowd shot. New Years Game Jam and 7DaySpaceJam
also crop out their peripheral debug panels. Original source media is retained.

Voxel Helicopter Shooter uses river combat, voxel debris and close explosions
from Trent's September 30, 2014 Vlog 1 (`qFx_cJcXj34`). Don't Touch the Red Stuff
shows jumps through three levels from his October 15, 2014 Vlog 2 (`qHfz6rU4GYA`).
Both edits have three cuts in 4.8 seconds, with desktop/editor chrome cropped
away. Source frames were matched to the original project posts before selection.
Blocky Dungeon remains a still: the recovered RPG GIFs contain heavy captions,
debug symbols or isolated model previews. Earlier engine-post animations show
the Bomberman revival and are not substituted for the RPG.

`recover-archives.py` uses the Rust downloader's bundled yt-dlp and QuickJS.
It verifies the uploader before downloads, keeps per-source receipts, and accepts
`--metadata-only name=VIDEO_ID` for inspection before retrieval. It uses no
browser cookies or profile. Original footage remains under ignored
`.local/archive-video/`; selected sources, dates, crops and cuts are in
`montages.json`. Unknown dates for directly hosted clips remain null.

## GIF versus video measurements

`benchmark.cjs` compares eleven original GIFs, their MP4 derivatives, and GIFs
made from those exact MP4 frames at matching size/cadence. Each case gets a fresh
headless Chrome instance, 1920 x 1080, six seconds warmup and sixteen seconds
sampling. Animated cases ran twice on this Windows/RTX 5070 Ti machine.

| Format | CPU cores, average | Chrome private memory | File bytes |
| --- | ---: | ---: | ---: |
| Original GIFs | 0.20 | 667 MiB | 29.75 MB |
| Matched GIFs | 0.28 | 706 MiB | 65.19 MB |
| MP4 | 0.28 | 423 MiB | 4.27 MB |

These results do **not** show a universal CPU advantage for video. Original GIFs
have different timing/resolution. Matched GIFs and MP4 had comparable CPU use;
video used less memory and bandwidth. CPU includes browser/renderer/GPU-process
CPU time, not GPU execution time. Headless animation-frame callbacks ran around
30 Hz for video and 60 Hz for GIFs. That is callback cadence, not GIF frame rate.
Video delivered about 30 fps with about 1% dropped frames in this comparison.
Other hardware and browsers can behave differently. The ignored comparison page
allows direct review in the owner's ordinary browser.

Raw measurements: `.local/playback-benchmark.json`.

## Verification

**COMPLETE all 27 gallery checks passed.** Checks cover autoplay, desktop/mobile
and low-memory limits, hover and keyboard priority, bounded rapid scrolling,
filtering, pause persistence, visibility handling, motion/data preferences,
blocked autoplay, all 110 poster decodes, JavaScript errors, no-JavaScript access,
ordering, and expanded desktop frame delivery. The stable wide-view sample played
ten visible previews using D3D11VideoDecoder. Frame delivery measurements are
recorded per run in `.local/gallery-playback-load.json`. Rapid scrolling
reached 12 simultaneous sources and never exceeded the limit.

Hidden-tab behavior uses visibility-event emulation. Mobile uses Chrome device
emulation, not a physical phone. Results, screenshots and decoder properties are
saved in `.local/gallery-verification.json`, `.local/gallery-playback-load.json`,
and `.local/gallery-*.png`. A separate content/media audit verified every card's
link, text, order and tags, and that all 201 media files match the manifest.
`audit-montages.py` fully decoded all 91 clips, verified their duration/size,
silent H.264 streams, faststart, multiple cuts and matching content-version URLs.
The final audit is `.local/montage-audit.json`.
