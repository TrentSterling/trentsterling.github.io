# Shared ColorMagic theme editor

`/`, `/discord/`, and `/games/` opt in with `data-tront-theme-editor`. The editor reuses
color conversion and harmony helpers from the unchanged `tront-system.js`.
The legacy gallery theme files and playback preferences remain untouched. Games starts with its existing palette and radial composition; custom choices use a separate `tront-theme-gallery-v1` key, and Reset restores the original gallery theme.

- Six presets, dark/light appearance, ColorMagic harmony generation
- Four always-visible, individually colored, movable gradient stops, including hard stops
- Angle, intensity, panel frost, undo and reset
- Native modal dialog, keyboard controls, outside dismissal, restored focus
- Independent editor storage; read-only migration from `tront-theme`
- Graceful fallback for denied/corrupted storage or unavailable dialog support

## Readability model

The exact user palette appears in a text-free preview. Page and button gradients
are composed toward mode-specific grounds before being sent to CSS. Panel alpha
is constrained to 75–100%; fixed navigation and overlays are opaque because they
can pass over arbitrary avatar images. All CSS gradients explicitly use sRGB.

The engine calculates a conservative component-wise background bound across all
page-gradient stops, button-gradient stops, panel, control and hover fills.
Linear interpolation, blur among those colors, and repeated panel alpha
composition stay within that bound. Each final foreground is checked against
the *same* bound. Normal text targets at least 4.7:1, leaving a margin above
WCAG's 4.5:1 minimum; control and border colors target at least 3.1:1. Color
transitions are disabled on relevant elements to avoid untested intermediate
foreground/background pairings during mode changes.

These calculations depend on the opt-in stylesheet actually winning the cascade.
Pure tests are not a substitute for inspecting the rendered pages or validating
browser-native focus behavior.

## Checks

From the repository root, using Node's built-in test runner (no new dependencies):

    node --check assets/js/tront-theme-editor.js
    node --test tools/theme-editor/test.cjs

The pure/DOM-contract suite checks preset/mode/legacy-count/intensity/frost
combinations plus 240 deterministic stress themes. It samples page and button
ramps, composited and nested panels, all foreground tokens, and border contrast.
It also checks storage migration/failure, opt-in isolation, inaccessible-control
hiding, undo/reset, moveable stops, event handling, and the integration contract.
The DOM fixture does not implement browser layout, native focus trapping or CSS.

### Queued close notifications

The HTML dialog algorithm queues its `close` notification after the dialog is
already closed. A rapid reopen can therefore precede an older notification.
The editor tracks its current dialog session: explicit close/backdrop actions
settle ARIA, focus and pending undo drafts synchronously; later notifications
cannot affect a reopened dialog or repeat an already handled cleanup. A native
close is finalized before immediate reopening. Focus restoration does not scroll
the page. Native Escape handling remains browser-owned.

The DOM fixture can queue close notifications. Five regressions run against
Home/Discord, Games and the Blog surface: immediate close state, reopened focus
and ARIA, continuous-edit undo grouping, focus after a handled close, and native
close followed by immediate reopen. All 15 failed against the previous handler
and pass with session-aware cleanup. Color math, theme state, storage keys,
gallery-native Reset and page presentation are unchanged.

A sixth regression for each consumer models native immediate focus restoration
followed by an external focus choice before the queued notification. It failed
with unconditional delayed focus restoration and passes with state-only cleanup.
Only explicit close/backdrop actions restore opener focus; native notifications
and pre-reopen cleanup never overwrite a later focus choice.

These deterministic tests complement real-browser modal and gallery checks;
they do not replace native focus, Escape, layout or playback verification.
See the [HTML dialog closing algorithm](https://html.spec.whatwg.org/multipage/interactive-elements.html#close-the-dialog).

With Playwright and its browser already installed, run the separate browser suite:

    node tools/theme-editor/browser.cjs

For an existing supported browser installation, `THEME_BROWSER_EXECUTABLE` can
select its executable. `THEME_SCREENSHOTS` selects the review artifact directory
(created if needed). The suite saves twelve review screenshots: the editor and closed page for
Home, Discord and Games, each at desktop/Midnight-dark and mobile/Paper-light
sizes. Home/Discord closed-page captures include the full page; Games captures
use the viewport so review files stay practical. A failure
also saves a diagnostic screenshot and JSON report with the current test phase,
focused element, document focus state, and recent focus events. Without
`THEME_SCREENSHOTS`, failure diagnostics go to `.local/theme-review`.

This is a localhost-only check; it does not publish or deploy the site. Do not
bypass execution or browser access denials.

The browser suite tests all three pages, every preset, computed foreground contrast,
keyboard editing, forward/reverse focus containment and restoration, always-visible four-peg controls, Escape/outside dismissal,
responsive overflow, saved-choice restoration, reduced motion and gallery
preference isolation. Manually review desktop/mobile appearance and native color
pickers as well. If browser execution is blocked, report those stages as unrun.

## Page-specific composition and regression boundary

Home retains its original 50px grid with opaque, peg-derived line colors inside the checked background bound. Games retains its two 80vmax blurred circles, positions, radius, blur, and fixed grid. Custom palettes recolor those circles instead of replacing them with a full-page linear gradient. Circle alpha is bounded so their overlapping colors stay within the contrast model.

The editor is always expanded and normalizes older one-to-three-peg settings to all four stored colors. No copy, game cards, filtering, playback code, media, or inline page layout is rewritten. `tront-navbar.css` shares only the primary navbar geometry, never the blog sidebar.

CI checks out the PR base separately. `THEME_BASELINE_ROOT=... node tools/theme-editor/preserve.cjs` checks text, inline layouts, gallery markup and protected Git blobs. Browser checks compare original gallery card geometry and background composition exactly at 1440, 390, 360 and 320px across legacy dark, purple and light before testing custom themes. The complete baseline runs on its own HTTP server with its own committed assets; candidate and baseline origins receive identical legacy settings. Browser checks reject any missing local dependency on either origin.

Games names its editor action `Theme` in native and custom modes. The native gallery previously hid the label below 480px and the icon at 360px and below, leaving an empty button at narrow widths. A gallery-native-only rule keeps the action label visible and hides the decorative icon. The accessible name and tooltip describe the current palette and dark/light appearance independently. No initialization, palette, storage, gallery content or playback behavior changes.

The intentional native navbar difference is limited to the opener's text/width and the resulting half-width-delta shift of the centered row. Browser comparisons require every other link size, font, padding, gap, navbar height and background to remain exact, with only 1/64px tolerance for the calculated centering shift. No runtime measurement or legacy-label mirroring is used. Before/after screenshots for all twelve native cases and `games-native-theme-control.json` record the actual geometry. The tests also require the Theme label to be unclipped, all controls to fit the viewport, and Enter/Escape to open the four-peg editor and restore focus. Shared navbar geometry still opts in only after a custom gallery palette is chosen.

A separate custom-theme playback check measures desktop/mobile frames and drops, enforces 12/2 preview caps, and exercises filtering and persistent pause after editing a peg. The unchanged 27-case gallery playback suite still runs separately.


## Preserve each page's design language

ColorMagic supplies colors and contrast bounds, not a replacement layout or one universal background. Before adding a page, inspect its original background layers, materials, typography and accent roles. Home and Discord both had two-direction 50px grids before the editor (Discord source: `7a3a635:discord/index.html`, body CSS); Games has two blurred circular glows and a separate fixed grid. Keep those compositions and recolor their existing roles. The blog uses Chirpy reading surfaces, sidebar and syntax accents, not the gallery or homepage background.

Browser checks require the grid on both Home and Discord in every preset and save real scrolled-viewport captures at their middle/bottom. Full-page Chromium captures omit off-viewport fixed backgrounds, so they cannot alone verify that behavior. Button-style links are checked in hover and keyboard focus states; prose links keep their own link affordances. For a new integration, record and compare its own before/after composition instead of accepting readability alone as visual preservation.


## Released blog consumer check

The read-only PR workflow checks out released blog commit `fcf3292f6f7fa3c062a9820ccea50259a0974394` and builds its unchanged Chirpy 7.2.4 pages. The same build is served once with PR-head shared assets and once with PR-base assets. The blog’s existing child-route, responsive, contrast, search and sidebar suite runs unchanged, followed by `tools/theme-editor/blog-close.cjs` for queued close/reopen, native Escape, later focus, Reset/Undo and persistence on the blog home and a real post. No blog source is edited or deployed by this job.

From the built blog checkout, with supported Chrome and Playwright installed:

```sh
CI=true THEME_BROWSER_EXECUTABLE=/opt/google/chrome/chrome \
  BLOG_SITE_ROOT=_site BLOG_SCREENSHOTS=.local/blog-review \
  node /path/to/site/tools/theme-editor/blog-close.cjs
```
