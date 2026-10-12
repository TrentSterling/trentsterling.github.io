# Home and Discord theme editor

Only `/` and `/discord/` opt in with `data-tront-theme-editor`. The editor reuses
color conversion and harmony helpers from the unchanged `tront-system.js`.
Neither the legacy gallery theme files nor gallery preferences are modified.

- Six presets, dark/light appearance, ColorMagic harmony generation
- One to four individually colored, movable gradient stops, including hard stops
- Angle, intensity, panel frost, undo and reset
- Native modal dialog, keyboard controls, outside dismissal, restored focus
- Independent `tront-theme-editor-v1` storage; read-only migration from `tront-theme`
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

The browser suite tests both pages, every preset, computed foreground contrast,
keyboard editing, forward/reverse focus containment and restoration, hidden-peg
and collapsed-control exclusion with one/four pegs, Escape/outside dismissal,
responsive overflow, saved-choice restoration, reduced motion and gallery
preference isolation. Manually review desktop/mobile appearance and native color
pickers as well. If browser execution is blocked, report those stages as unrun.
