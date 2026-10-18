# Tiny Zombies gallery preview

The existing Tiny Zombies: No One Left card (11 of 128) gains a silent preview using its previously published gameplay footage. The existing PNG poster, 2026 label, text, canonical link and position remain unchanged. The separate 2015 Tiny Zombies card is untouched. There are now 99 previews; the existing 12/4/2 decoder limits and pause/accessibility behavior are unchanged.

## Gallery history

The 2026 card was introduced poster-only in [415435c6](https://github.com/TrentSterling/trentsterling.github.io/commit/415435c6f708411db96d0cabcd63798f79c0d862) on 2026-10-14. [2a45468](https://github.com/TrentSterling/trentsterling.github.io/commit/2a45468a60b35d945dc87a7fce9dd8f4a5145b8a) moved that same card to preserve featured order; [422a297](https://github.com/TrentSterling/trentsterling.github.io/commit/422a29710913b4a6804f155e55e6d986a1e7c149) corrected only its destination URL. All ten Games-page commits between its introduction and base `942fd3de` retain a poster-only card. This is a missed gallery video hookup in that released history, not an established removal of an MP4 reference.

## Provenance

The public source `assets/route-gameplay-proof.mp4` was introduced in [TinyZombies commit a6e49307](https://github.com/TrentSterling/tinyzombies/commit/a6e493076c8c0f0f9a95cd5ce304c8567e8009c8), original Git blob `ed6f0853fb9f1145bc35b6922ab220e263aeaa26`. The source documents ordinary-input mission footage. The user approved reuse of this older footage. This integration does not recapture, alter or validate the current game runtime.

The gallery derivative is the first ten seconds of the original recorded timeline. It is scaled to 640×360 with full-to-limited range encoding, without speed or game-state changes. One held frame remains; there are 299 distinct decoded images among 300 frames. No blank, loading or error imagery was found. The original recording's visible gameplay/HUD and motion are retained. The loop is not claimed to be seamless.

Frozen file: `games/media/tiny-zombies-2026.mp4`, 816,270 bytes, SHA-256 `92b08b1effb89154218c0ee91b291b904da4bee5020dd6e3c53144d0a6b1a932`. H.264 High, yuv420p, 640×360, 30 fps, 300 frames, 10 seconds, no audio, faststart. All frames decode. Original poster SHA-256: `e7ea5b211d4b1fad1fbeac1ec843c0e44cf5170291d9aa9ee40222fa75a2d119`.

## Checks

Run `THEME_BASELINE_ROOT=<actual-base-checkout> node --test tools/game-media/tinyzombies-preview.test.cjs tools/navigation/contract.test.cjs` and `node tools/theme-editor/preserve.cjs`. The exact reviewed addition also passes with the committed candidate as its own base; all 98 earlier MP4s remain byte-identical. The recording manifest explicitly requires this clip's native 30 fps; the four earlier recordings still require 25 fps. Size, full-decode, codec, dimensions, frame-count, duration, hash and silence checks remain intact.

`node tools/game-media/tinyzombies-preview-browser.cjs` uses the actual page, gallery runtime and media. It compares poster-card pixels/geometry against the actual base at 1440/390/320px, checks decoding, native destination activation (intercepted without loading the game), pause/reload, filter/offscreen release, reduced motion, data saver, no JavaScript and failed-media fallback. Output goes to `THEME_SCREENSHOTS`. CI uses official Chrome; local WebKit is selected with `GAMES_TEST_BROWSER=webkit` and `GAMES_BROWSER_EXECUTABLE`. Public font assets may be supplied with `GAMES_FONT_CACHE`.

DungeonGen remains parked separately and is not included. The independent existing gallery performance gate is unchanged. This addition makes no performance-fix claim.
