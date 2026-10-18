# DungeonGen gallery preview

The existing DungeonGen card (122 of 128) gains a silent preview. Its sharper poster, 2013 label, text, Yuukirus credit, link and position remain unchanged. There are now 99 previews; the existing 12/4/2 decoder limits and pause/accessibility behavior are unchanged.

## Provenance

New capture made on 2026-10-18 from the unmodified archived demo at [DungeonGen commit 478dc725](https://github.com/TrentSterling/DungeonGen/commit/478dc725f3237c6397e32cae90b8f5577d6eeebf). That source commit is dated 2016-11-25; the retained 2013 card label is not a recording date. All ten source/assets matched the Git tree. The demo orbits the camera and moves a light around its exported Collada rooms. This is actual demo motion, not player input or footage of live procedural generation.

The capture uses original timing, raw seconds 2–14, a 960×540 crop at x=160/y=180 from 1280×720, then 640×360. No retiming, interpolation, lighting or color changes. Original light pulses can wash out detail; a brief near-static interval remains around 3.64–4.08 seconds. The 12-second loop is not a seamless full orbit. These are retained capture/source characteristics, not hidden by the preview integration.

Frozen file: `games/media/dungeongen-2013.mp4`, 804,783 bytes, SHA-256 `15e62358f2e2586bffeb1267f6df53c693522ba319f7579498f927807bec9f17`. H.264 High, yuv420p, 640×360, 25 fps, 300 frames, 12 seconds, no audio, faststart. All frames decode. Existing poster SHA-256: `4c188ab336d4b3aba9f333878a16fe61c2bab26eba28326dc7da63c49e1ffb08`.

## Checks

Run `THEME_BASELINE_ROOT=<actual-base-checkout> node --test tools/game-media/dungeongen-preview.test.cjs tools/navigation/contract.test.cjs` and `node tools/theme-editor/preserve.cjs`. The exact reviewed addition also passes with the candidate as its own base; all 98 earlier MP4s remain byte-identical.

`node tools/game-media/dungeongen-preview-browser.cjs` uses the actual page, gallery runtime and media. It compares poster-card pixels/geometry against the actual base at 1440/390/320px, checks decoding, native destination activation (intercepted), pause/reload, filter/offscreen release, reduced motion, data saver, no JavaScript and failed-media fallback. Output goes to `THEME_SCREENSHOTS`. CI uses official Chrome; local WebKit is selected with `GAMES_TEST_BROWSER=webkit` and `GAMES_BROWSER_EXECUTABLE`. Public font assets may be supplied with `GAMES_FONT_CACHE`.

The independent existing gallery performance gate is unchanged. This addition makes no performance-fix claim.
