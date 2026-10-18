# Navigation contracts

The main navbar remains static HTML and retains its existing visual design,
reverse-flex order, and no-script links. Its four labels and routes are checked
against the existing `Tront.HUB` registry, rather than generating a second
runtime navbar or replacing legacy page templates.

`contract.test.cjs` checks Home, Games, Discord, and 404; the style guide's static
hub; and the registry's generated hub/product semantics. Only actual Home,
Games, and Discord pages mark their matching primary link `aria-current="page"`.
404 has no current primary link. Style has its own current Style link, and the
Minecraft product navigation retains in-page lesson links without claiming a
current page. Other page families retain their own navigation. The Games Markdown view
has a separate bounded usability contract below; blog markup and vendored
project forks are intentionally not rewritten.

Run from the repository root with a clean checkout of the PR base:

```
THEME_BASELINE_ROOT=/path/to/pr-base node --test tools/navigation/*.test.cjs
THEME_BASELINE_ROOT=/path/to/pr-base node tools/navigation/browser.cjs
```

Browser checks use installed Playwright and Chrome (`THEME_BROWSER_EXECUTABLE`
may select the executable). `NAV_BROWSER=webkit` and `NAV_BROWSER_EXECUTABLE`
support an already-installed WebKit. `NAV_FONT_CACHE` optionally accepts an
existing URL-to-`{file, contentType}` manifest of authentic font assets.

The browser harness renders exact source at the intended routes, compares
before/after geometry and colors at 1440/390/320px, verifies real keyboard focus,
current links, direct navigation and refresh, and exercises 404 recovery/Back.
External Discord status is an explicit fixture; game runtimes and public
invitation actions are never executed. Local evidence is written to
`THEME_SCREENSHOTS` or `.local/theme-review`, and CI retains it as artifacts.
These checks do not claim public deployment availability or an exhaustive site
audit.

## Discord Join links

The two Join CTAs and widget-error fallback restore the exact public invite that
existed before commit `6113180d2fe9b095496ed2a693fe34984381f3ba`. The primary
Discord nav link and canonical still point to `/discord/`. Contracts reject
self-links and unreviewed invites; browser cases cover widget success, failure,
and JavaScript disabled. Every invite click is intercepted locally before any
external request. Current server invite acceptance is not claimed.

## Device History portable download

`device-release.json` records the public GitHub release and portable-asset
metadata verified for this repair. The two download CTAs identify v0.8.0, the
published binary, while the v0.8.3 source badge and screenshots stay unchanged.
Negative controls reject the nonexistent v0.8.3 binary URL and unlabeled binary
versions. Exact-anchor normalization cannot conceal other production changes.

`device-download-browser.cjs` compares desktop/mobile layouts, keyboard focus,
direct routes, reload and Back, with JavaScript enabled and disabled. Both link
clicks are intercepted as inert HTML before leaving the local fixture: no binary
is downloaded or executed. Run with the same baseline/browser/output variables
as the navigation browser harness above.

## Device History narrow-screen layout

The responsive repair is local to this legacy page. It removes a redundant
inline two-column declaration that overrode the page's existing 640px stacking
rule. A bounded 600px/360px navbar block retains readable Home/Games/Blog/Discord
and theme text; only decorative icons are removed at the narrowest breakpoint.
Shared styles and runtime remain unchanged.

`device-responsive-browser.cjs` checks every breakpoint edge, all five legacy
themes, uncut text ranges, 40px-high native controls, direct reload/Back, keyboard
focus/activation, and no-script links. The baseline must reproduce clipping and
the failed stacking rule. At 641/768/1440px, both header and install screenshots
must be pixel-identical to the baseline in all five themes. The harness waits
for existing finite navbar hover transitions to finish before strict stable-state
measurements; it makes no first-paint claim.

## Legacy project navbar labels

RuntimeCSG, Toaster, Notesdash and SnapScan retain their native legacy nav and
page-specific styling. `legacy-navbar.cjs` permits only the exact Device History-derived
responsive nav block and `aria-label="Cycle color theme"` on their existing
five-mode buttons. It never normalizes another page or a changed rule/label.
The focused browser gate checks mobile text containment, keyboard navigation,
theme cycling, no-script links and exact desktop parity. Existing author-link
checks retain strict non-nav and desktop comparisons; only these reviewed mobile
nav-control dimensions are handled by the new responsive contract.

## SnapScan feature-grid containment

SnapScan's existing 300px feature-column minimum exceeded its 272px content area
at a 320px viewport. The single local declaration now caps that minimum at 100%
of the grid. `snapscan-grid.cjs` reverse-normalizes only the exact reviewed block
on this page; source guards reject copy, selector, gap, minimum and duplicate
mutations. Shared assets remain byte-identical.

The existing navbar and author-link browser gates prove all seven cards and
text fit at normal 320px-and-up widths, preserve heading/nav/control styles, and keep wider or already-fixed
base states exact. With the old narrow grid, only its measured overflow and the
natural grid-height shift of actions below it may differ. The real PR baseline
is always retained, including self-base mode. Native keyboard/link checks and
all theme, no-script and desktop pixel assertions remain in place.

The retained CSS-zoom-2 author stress case has only 160 effective layout pixels
at 320px: existing unbreakable feature words and navbar controls can still
overflow there. This repair does not claim to resolve that separate extreme
zoom limitation; its measured remaining extent is recorded and footer focus,
link activation, unchanged styles and exact below-grid reflow stay checked.

Two actual-base WebKit repeats show a consistent first raster-row difference
under the unchanged translucent navbar after the 320px themed body reflows:
320 pixels, RGB delta at most 4, with every remaining pixel exact. The targeted
Chrome diagnostic (run 39130125336) collected all five themes without hiding
failed pixel gates: Dark/Cyan were exact, while Purple/Ember/Light changed
69/78/10 pixels by one RGB level (68/73/10 below the first row). Candidate-as-base
was exact in every theme. This is measured reflow, not assumed capture noise.

Only that proven SnapScan 320px grid transition in the exact 320×96 navbar crop
permits the original first-row RGB delta of at most 4 plus at most 96 changed
pixels below it, each differing by at most one RGB level. Alpha remains exact.
The report separates first-row and sparse counts. Desktop, wider mobile,
candidate-as-base, source, styles, text bounds and all geometry remain exact.
Fixtures reject excess pixel counts, channel deltas, alpha changes, wrong image
dimensions and absent/wrong-page reflow. The diagnostic-only workflow and reduced
case runner are not part of the release branch; its complete browser gates stay.

## Legacy portfolio fallback and mode controls

`games-md.cjs` permits only the exact no-script visibility override, raw-text
URL wrapping, page-local six-control phone navbar and mode-focus transfer in
`games/md/index.html`. Its raw 55-record portfolio is hash-locked, while the
rest of the page is compared exactly with the real PR base. Main Games, media,
shared assets, metadata, labels and destinations remain unchanged.

`games-md-browser.cjs` checks direct/reload views with and without JavaScript,
320/390px and the 700/701px boundary, every legacy theme, native keyboard mode
and theme actions, full label bounds and settled 1440px desktop pixel parity.
The original source is retained as a negative control even for an already-fixed
base. External requests and navigation are intercepted; no runtime is executed.
Run with the same baseline/browser/font/output variables as the other gates.
`NAV_BLOG_LOGO` may point at the already-verified released blog logo; otherwise
the harness serves the identical repo logo after checking the expected digest.
