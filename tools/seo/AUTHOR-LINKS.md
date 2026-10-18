# Canonical authors and project devlogs

The five-file contract adds the canonical `https://tront.xyz/#trent-sterling`
identity to the already-named SoftwareApplication authors on PowerShell Manager,
Trontop and YTDL. It appends one descriptive native footer link each on Colony
and Jenn's Farm. It does not introduce new authors, schema roles or page types.

The targets `/blog/posts/colony/` and `/blog/posts/jenn-s-farm/` were verified in
released blog commit `2ae3d69c7874755a0448032750c3f1267413431d`, both source posts
and generated canonical output. FarmVR is a different project. Existing Play
links, all credits, dates, descriptions, runtime files and media are preserved.

Run from the repository root against a separate checkout of the PR base:

```sh
THEME_BASELINE_ROOT=/path/to/pr-base node --test tools/seo/*.test.cjs tools/navigation/*.test.cjs
THEME_BASELINE_ROOT=/path/to/pr-base node tools/seo/author-links-browser.cjs
```

Browser dependencies and executable configuration match the navigation suite.
`AUTHOR_FONT_CACHE` may point to a JSON mapping of authentic font URLs to
`{file, contentType, sha256}` entries; hashes are checked before use. Otherwise,
the browser harness retrieves the authentic Google Fonts CSS and fonts once for
both sources. `AUTHOR_BLOG_ROOT` may identify the independently verified released
blog artifact containing `assets/img/tront.png`; otherwise that image is read
from the same exact released GitHub commit. No production assets are replaced.

The browser suite checks nine pixel-identical metadata-only viewport pairs at
1440/390/320px, plus both contextual links at 1440/375/320px, 200% CSS zoom at
375/320px, and no JavaScript at 320px. CSS zoom is a reflow stress test, not a
claim about native browser zoom. After instant footer-view setup, native Tab/Enter, visible focus, wrapped text
containment, direct routes, Back and reload are checked. Off-screen smooth
auto-scrolling is not part of this contract. Devlog destinations are
intercepted as inert HTML; that test proves destination wiring, while released
source/artifact review proves that the articles exist. No game or executable is
loaded. Other original page bytes remain covered by exact normalization and the
whole-production-file preservation gate, including all 98 MP4s.
