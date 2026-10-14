# About / More by Tront discovery strip

This opt-in component adds a compact game strip to an About area. A page opts in
by including `/assets/css/tront-about-discovery.css`,
`/assets/js/tront-about-discovery.js`, and a host with `data-tront-discovery`
plus a child with `data-tront-discovery-cards`. Pages can set
`data-current-game` to a canonical slug; otherwise the component checks the
canonical link and current path.

The component shows CraftMine and SMEAR plus two distinct, session-stable picks
from INKRIDE, Tiny Treads, and Tinyrise. It excludes the current game and known
route aliases. SMEAR uses its poster until current preview footage is available.
Only selected games create cards and request posters.

Visible video-backed cards autoplay muted previews, with at most three videos
active at once. MP4 sources are assigned only while a card is visible; sources
are released when a card leaves view, the tab is hidden, or its disclosure
closes. Pages can mark animated gameplay regions with
`data-tront-discovery-game-surface`; while any marked region is visible, the
strip switches to a compact poster-only mode. Reduced-motion and Save-Data
preferences also keep posters only. Failed or blocked playback falls back to the
poster without adding status copy to the About area.

When a host sits inside a closed `<details>` disclosure, the component creates
no cards or poster requests until every containing disclosure opens. The
component does not register document-level keyboard or pointer handlers, so it
can sit beside interactive demos without taking over their input. Normal poster
and title links navigate independently of preview playback.

Run `node --test tools/about-discovery/test.cjs` for catalog, alias,
session-choice, media-policy, and poster-only SMEAR checks. The Lerp pilot
vendors the same assets; its source-preservation and Playwright browser suites
cover visible autoplay, media release, active-game lightweight mode, input
accessibility, and responsive layout.
