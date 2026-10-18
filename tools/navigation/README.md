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
current page. Legacy landing pages, Games Markdown view, blog markup, and
vendored project forks are intentionally not rewritten.

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
