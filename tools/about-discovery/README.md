# About / More by Tront discovery strip

This is an opt-in, static component. A page opts in by including
`/assets/css/tront-about-discovery.css`, `/assets/js/tront-about-discovery.js`,
and a host element with `data-tront-discovery`, a child with
`data-tront-discovery-cards`, and a status element with
`data-tront-discovery-status`. Pages can set `data-current-game` to a canonical
slug; otherwise the component checks the canonical link and current path.

The component shows CraftMine and SMEAR plus one session-stable choice from
INKRIDE, Tiny Treads, and Tinyrise. It excludes the current game, including the
known route aliases. Only the selected cards get lazy poster images in the DOM.
There is no video element or MP4 source until a visible card is hovered or keyboard-focused. One video element is shared by all cards and its source is removed on release, tab hiding, or when it leaves view. Reduced-motion and Save-Data preferences keep the poster-only view.

When a host sits inside a closed `<details>` disclosure, the component creates
no cards or poster requests until every containing disclosure opens. Closing a
disclosure releases an active preview. The component does not register
document-level keyboard or pointer handlers, so it can sit inside full-screen
apps without taking over their input.

CraftMine and SMEAR use short, activity-first descriptions. SMEAR currently has a static poster and no preview video.

The page heading appears once, and normal poster and title links navigate independently of preview playback.

The Lerp footer pilot vendors the same two assets locally so it remains usable
before this shared source is published. Lerp's `tests/discovery.test.cjs` checks
the mounted markup and pinned asset hashes; its existing Playwright browser
suite checks deferred preview requests, input modes, source release, and responsive layout.

Run `node --test tools/about-discovery/test.cjs` for the component's deterministic
catalog, alias, session-choice, motion preference, and poster-only SMEAR checks.
