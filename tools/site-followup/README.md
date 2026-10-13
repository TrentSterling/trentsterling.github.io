# Bounded public site follow-up

Test-only PR #13, originally based on main `36447f2b50a8cf9703b579216e32d380e76139da`. Change only these follow-up files and `.github/workflows/site-followup.yml`; no old workflow or full-crawl modification.

## Exact source and browser scope

Tutorial baseline is `cab52f2e322bb478aa13b198a446451604c6dc7b`; candidate is `279510283f8519f7fa4a36adf2ebf02151075616`, exact index blob `7daa337d20726f51aede9f90de1704c0951ad05b`. The byte contract permits exactly the static href repair, gemini-only root Markdown fetch, and gemini-only return before demo fetching. No other tutorial source change is accepted.

At desktop 1440px and mobile 390px, only the `/tutorials/` document is intercepted with the exact baseline/candidate source. Ordinary visible static-anchor click goes to actual public `gemini.html`; HTTP 200, title/canonical and Back are checked. Candidate sidebar activation, blank-hash Back/Forward, same-hash repeat and direct `#gemini` load must render authentic Markdown with the expected H1/Roadmap heading, active navigation and hidden demo wrapper. The existing blank-hash handler is a no-op; the test does not demand blank content there. Other tutorial hashes and demos are untouched.

Pointer targeting uses `getClientRects()` and `elementFromPoint()` on actual visible text fragments or uncovered mask regions. No forced click, hidden-anchor click or programmatic scrolling is used for tutorial navigation. Diagnostics record every candidate point and actual hit target. A fully covered element remains blocked. This fixes two initial harness false negatives: the center gap between wrapped Roadmap text lines and the blog mask center beneath its sidebar.

Four actual public mobile blog cases cover widths 320/390, normally and with Font Awesome fonts explicitly blocked. They compare exact raw SVG markers against deployed blog `7f0471eba88b129331ae13404876f621ec62db37`, then verify visible Menu/Search SVGs, bounded post-FCP samples, normal Menu dismissal, Search results, Cancel/Escape, query clearing and focus return. Font-block experiments must demonstrate actual failed font requests.

One additional public Games context at 390px verifies the exact reviewed HTML, all 117 year/range labels, Isaac's unchanged full blurb and 2014 label, decoded 576×324 poster, and genuinely advancing muted/looping inline video after normal scrolling to that card. No game is entered, other videos are blocked, and no gallery crawl or broad preservation suite is repeated.

## Ten explicit public GETs

1. `/tutorials/gemini/README.md` — diagnostic status only
2. `/tutorials/gemini.md` — HTTP 200 Markdown matching verified SHA-256
3. `/blog/` — exact SVG markers
4. `/blog/posts/trontop/` — exact SVG markers
5. `/blog/categories/` — HTTP 200, Categories H1, all seven known links
6. `/blog/posts/away3dlite-and-new-recording-software/` — corrected image anchor, old wrong-root anchor absent
7. `/blog/assets/img/better_performance_lower_memory_shits_working.jpg` — 4 KiB image availability probe
8. `/games/` — complete HTML SHA-256 `f2c528e17ad3347d60f604d88e436a49449fa1fcb07c38d28511c0f18d15dbf5`
9. `/games/media/binding-of-isaac-clone-2014.mp4?v=898704224836` — all 325,535 bytes and SHA-256
10. `/games/media/binding-of-isaac-clone-2014.webp?v=cdb245371a48` — all 20,240 bytes and SHA-256

The two complete Isaac assets match the reviewed hashes embedded in `contract.cjs`. The separately labeled image probe does not claim full binary integrity.

## Bounds, permission and evidence

Explicit GETs share a 1 MiB per-response cap (4 KiB for the image probe), 12-second deadlines, a two-redirect allowance, exact HTTPS public origin and at least 250ms between starts. Browser requests are normal loads for the seven bounded cases (nine isolated browser contexts including tutorial baselines), not link expansion. Contexts are fresh and isolated; service workers, non-GET/HEAD methods, every `demo.js` request and unneeded third-party hosts are blocked. No user credentials/cookies are loaded or forms submitted. Gemini itself must not even attempt a demo request.

The browser command is capped at 240 seconds; the job at nine minutes. Existing official actions are pinned; tooling is Playwright 1.62.0 and official Chrome. Permissions are `contents: read`, no persisted checkout credentials, no custom secrets and no deploy permissions. Artifacts expire after three days.

The first run verified live blog release markers/categories/image repair, all 390px blog interactions with and without icon fonts, desktop tutorial click/Back, and genuine public raw roadmap Markdown. Baseline/candidate tutorial screenshots were byte-identical at both widths. Its center-point targeting errors are corrected here; all original accessibility, navigation and interaction assertions remain.

Local validation: fourteen Node contract tests pass, syntax checks pass, exact revised tutorial source diff passes, and the reviewed Games source passes the new marker contract. No local Chrome run was attempted. Actual results of the revised seven-case suite still require the reviewed GitHub runner.
