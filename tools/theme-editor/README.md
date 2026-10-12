# Home and Discord theme editor

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

The pure/DOM-contract suite checks 288 preset/mode/count/intensity/frost
combinations plus 240 deterministic stress themes. It samples page and button
ramps, composited and nested panels, all foreground tokens, and border contrast.
It also checks storage migration/failure, opt-in isolation, inaccessible-control
hiding, undo/reset, moveable stops, event handling, and the integration contract.
The DOM fixture does not implement browser layout, native focus trapping or CSS.

With Playwright and its browser already installed, run the separate browser suite:

    node tools/theme-editor/browser.cjs

For an existing supported browser installation, `THEME_BROWSER_EXECUTABLE` can
select its executable. `THEME_SCREENSHOTS` selects the review artifact directory
(created if needed). The suite saves eight review screenshots: the editor and
closed page for both Home and Discord, each at desktop/Midnight-dark and
mobile/Paper-light sizes. Closed-page captures include the full page. A failure
also saves a diagnostic screenshot and JSON report with the current test phase,
focused element, document focus state, and recent focus events. Without
`THEME_SCREENSHOTS`, failure diagnostics go to `.local/theme-review`.

This is a localhost-only check; it does not publish or deploy the site. Do not
bypass execution or browser access denials.

The browser suite tests all three pages, every preset, computed foreground contrast,
keyboard editing, forward/reverse focus containment and restoration, hidden-peg
and collapsed-control exclusion with one/four pegs, Escape/outside dismissal,
responsive overflow, saved-choice restoration, reduced motion and gallery
preference isolation. Manually review desktop/mobile appearance and native color
pickers as well. If browser execution is blocked, report those stages as unrun.

## Page-specific composition and regression boundary

Home retains its original 50px grid with opaque, peg-derived line colors inside the checked background bound. Games retains its two 80vmax blurred circles, positions, radius, blur, and fixed grid. Custom palettes recolor those circles instead of replacing them with a full-page linear gradient. Circle alpha is bounded so their overlapping colors stay within the contrast model.

The editor is always expanded and normalizes older one-to-three-peg settings to all four stored colors. No copy, game cards, filtering, playback code, media, or inline page layout is rewritten. `tront-navbar.css` shares only the primary navbar geometry, never the blog sidebar.

CI checks out the PR base separately. `THEME_BASELINE_ROOT=... node tools/theme-editor/preserve.cjs` checks text, inline layouts, gallery markup and protected Git blobs. Browser checks compare original gallery card geometry and background composition at desktop/mobile widths across legacy dark, purple and light before testing custom themes. The unchanged 27-case gallery playback suite still runs separately.
