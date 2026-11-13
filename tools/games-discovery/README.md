# Catalog discovery

The catalog remains the source of truth: 128 static cards, unchanged category radios,
ordering, descriptions, dates, links, images and previews. Search is an additive
progressive enhancement. It is not a second catalog or a repository crawler.

## Capability evidence

`assets/js/games-discovery.js` contains explicit, conservative capability sets.
Never infer browser availability from a hostname, a preview, or the `Game` class.

- The 64 browser paths are existing catalog destinations for browser games, demos,
  or utilities. The runtime/canvas capture specifications in
  `tools/game-media/capture.cjs`, `takes.cjs`, `prototype-retakes.cjs`,
  `four-game-refresh-20261019.json`, `six-game-refresh-20261019.json`, and
  `recorded-previews.json` document the browser implementations. Local published
  pages additionally contain the runtimes or play/demo links. Splitter4GPT is
  explicitly described as a web utility in the existing card.
- Tiny Zombies uses the current `/games/tiny-zombies/` storefront, whose Play
  links launch the existing `/tinyzombies/` browser game.
- Jenn's Farm keeps its `/jennsfarm/` landing and routes both Play buttons to the
  already-published `/farm/` successor. The historical `/jennsfarm/play/` build
  remains available. The successor reads the legacy save without overwriting it.
- Browser landings that lead to a web `play/` or `demo/` page count. Native app
  landing pages, extensions, Unity packages, blog posts, Steam pages, and unverified
  itch builds do not. Browser availability does not mean mobile support: the UI
  notes desktop/WebGPU requirements and preserves specific card requirements.
- The 13 multiplayer projects have explicit support in their current descriptions:
  multiplayer/co-op, shared jewel board, shared WebRTC room, shared drawing/riding,
  or hot-seat/online battles. The test requires that evidence. CPU-vs-CPU VibePong
  does not count. The label says “Multiplayer projects”, not “Online now”.
- The existing Tool category is preserved; it is not equated with browser software.
- No new projects are discovered, fetched, or added at runtime.

## Behavior and tests

Search ANDs whitespace-separated words across names, years, descriptions and tags,
ignoring case, accents, apostrophes and punctuation. It intersects one existing
category and both optional checkboxes. The URL stores `q`, `category`, `browser=1`
and `multiplayer=1`, preserving unrelated parameters/hash without creating an entry
per keystroke. Reload/Back restore filters. Escape clears search, Clear all resets
everything, and a no-results state has a reset action.

Hidden cards leave layout and keyboard order. The existing IntersectionObserver
releases their video slots. No card DOM is replaced. Failure to load the enhancement
or disabling JavaScript retains the original CSS category filters.

Run with a separate PR-base checkout:

```sh
THEME_BASELINE_ROOT=/path/to/base node --test tools/games-discovery/test.cjs
THEME_BROWSER_EXECUTABLE=/path/to/chrome node tools/games-discovery/browser.cjs
```

Browser checks cover 320, 390, 768 and 1440px, light/dark, keyboard, empty results,
search/filter intersections, reload/Back, script failure, no-script categories,
hidden preview release and the homepage catalog/itch links. Screenshots and the
report go to `.local/theme-review` (or `THEME_SCREENSHOTS`). These focused tests
supplement the existing site regression suite.
