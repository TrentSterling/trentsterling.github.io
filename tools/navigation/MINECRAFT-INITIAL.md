# Minecraft initial rendering

This page-local repair keeps the tutorial's deliberate fixed dark emerald theme
and existing product navigation. The 19 static color tokens are checked against
`Tront.applyTheme('#17dd62', true)`. Static nav markup is checked byte-for-byte and
as parsed DOM against `Tront.nav` with the existing product links and More menu.
The redundant page-local `mountNav` call is removed so delayed shared JavaScript
does not replace a focused link or reset an open native details menu.

Only three exact source regions are allowed to differ: the initial token block,
the populated nav element, and the removed mount call. Shared CSS/JS, fonts,
tutorial copy, dates, metadata, media, and the rest of the page script are unchanged.
Saved site theme keys are neither restored nor changed by this fixed-theme page.
Its separate `mcmod-exercises` progress storage remains functional and preserved.

Run with a separate checkout of the PR base:

```sh
THEME_BASELINE_ROOT=/path/to/base node --test tools/navigation/*.test.cjs
THEME_BASELINE_ROOT=/path/to/base node tools/navigation/minecraft-initial-browser.cjs
```

The browser tooling matches the other navigation suites. Install Playwright's
ffmpeg component for the independent video recordings. Local WebKit runs may set
`PLAYWRIGHT_BROWSERS_PATH` to their existing browser installation directory.
Authentic font responses can be supplied through the existing `NAV_FONT_CACHE`.

Checks cover pixel-identical settled viewports at 320/390/1440px; delayed shared
script, failed script, no JavaScript, held fonts and failed fonts at 320/1440px;
native keyboard anchors/More; saved site themes and actual exercise progress;
and preserved focused-node identity/open More state when delayed JS arrives.
The explicit pre-fix control must still exhibit its missing nav/fallback palette.
If the actual PR base already contains the repair, it remains compared and
photographed, while a separate fixture reverses only the three exact reviewed
regions. Original fixed-base initial states remain equal, and the constructed
control must reproduce both defects. Its additional videos are clearly labeled.
No download or Minecraft runtime is launched.

Held-script video is recorded without screenshot, computed-style, or geometry
observations during loading. Screenshots alone can perturb WebKit rendering and
cannot establish a real-user flash duration. The suite therefore makes no exact
real-user first-paint timing claim. Native font swapping and its existing wrapping
changes are deliberately retained, with real held/released font requests and readiness checks at both widths.
The measured wrapping delta must match the actual baseline; it may be zero in
Chrome even though the recorded WebKit320px case rewraps.
This patch is not a claim of zero layout shift or a font-loading redesign.
