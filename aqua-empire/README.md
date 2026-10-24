# Aqua Empire website shell

`index.html`, `intro.css` and `intro.js` provide the introduction at `/aqua-empire/`.
Play opens `?play=1` at the same path and loads `game.html` in a full-viewport,
same-origin frame. The standalone file owns all gameplay, menus, graphics,
settings and save handling. The shell does not read or write aquarium saves.
Other query parameters, including `webgl=1`, are forwarded to the game.

`game.html` is the exact published Aqua Empire 2.5.2 standalone HTML:

- 3,848,758 bytes
- SHA-256: `a5a38c639b2c7f4b9a31228159104fa30d4a70a54439b04f1c6ccc5bc0628755`
- Its existing canonical remains `https://tront.xyz/aqua-empire/`.

The game remains directly playable at `game.html`, including as a local file.
Its origin and `aqua-empire-save-v1` storage key are unchanged on the website.
The shell adds no telemetry, fonts, libraries, or external requests.

`aquarium.png` is an actual 1280 x 800 runtime screenshot of a new Coral Cove
aquarium, taken with the approved build. It is not a mockup or generated art.

## Updating or reverting

For a future approved game release, replace `game.html` with the tested standalone
artifact and update the hash assertion in `tools/seo/aqua-intro.test.cjs`.
Preserve its self-contained runtime and the landing-page canonical. Check the
shell's gameplay and controls copy against any changed mechanics. Do not copy a
new game build over `index.html` unless intentionally removing the introduction.

To remove the shell, restore `game.html` as `index.html` and remove the shell files
and screenshot. This returns the original direct-to-game behavior. The separate
CraftMine sitemap cleanup can remain.

From the repository root:

```text
node tools/seo/check.cjs
node --test tools/seo/aqua-intro.test.cjs
```

The full existing SEO suite also needs `THEME_BASELINE_ROOT` pointing to a base
checkout with committed LF bytes, as in the site-checks workflow.

Browser acceptance includes keyboard entry, desktop and touch feeding, unchanged
viewport dimensions, saved-aquarium continuation, JSON export/import, Back/Forward,
and the WebGL query. An introduction does not make the existing pointer-driven
canvas game fully keyboard-playable; the page states that boundary explicitly.
