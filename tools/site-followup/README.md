# Bounded public site follow-up

Test-only preparation for a NEW PR based on main commit `36447f2b50a8cf9703b579216e32d380e76139da`. Publish only `tools/site-followup/` and `.github/workflows/site-followup.yml`. Do not add these to existing PR #10: that PR's full diff can retrigger the earlier full-crawl workflow.

## Exact scope

- Tutorial baseline `cab52f2e322bb478aa13b198a446451604c6dc7b` and one-href candidate `f46659445e27f821f859d5aae9180ace3f415bac`, with exact Git blob and byte-diff checks.
- At 1440px and 390px, intercept only the public `/tutorials/` document with the exact baseline/candidate source. Initial hash remains blank. The target `/tutorials/gemini.html` is fetched from the real public site.
- Measure the Roadmap anchor against viewport, clipping ancestors and hit testing before any click. No forced click or programmatic scrolling. If the existing flex/overflow layout clips it, save evidence and report a blocked interaction. If normally accessible, click, verify actual public HTTP 200/title/canonical, then Back and confirm the candidate href remains.
- Read-only public GETs of `/tutorials/gemini/README.md` and `/tutorials/gemini.md` diagnose the separate hash-loader assumption. Their observed statuses are recorded; the loader is never changed or invoked.
- Verify deployed blog `7f0471eba88b129331ae13404876f621ec62db37`, retaining the SVG controls introduced in `d92540b`. Compare exact inline SVG shapes/attributes and accessible button names in raw public HTML with the pinned topbar source.
- Four actual public mobile Chrome cases: widths 320/390, normal and explicitly blocked Font Awesome font requests. Check visible Menu/Search SVGs, bounded post-FCP samples, Menu open/close, Search results, Cancel, Escape, query clearing and returned focus. Blocked-font cases must demonstrate that font blocking was actually exercised.
- Targeted release checks: `/blog/categories/` returns 200, has one Categories H1 and all seven known category links; the Away3DLite post contains the corrected enlargement href and lacks the old wrong-root href; the corresponding image returns an image response.

## Bounds and safety

Seven explicit public GETs total, each HTML/Markdown body capped at 1 MiB, image probe at 4 KiB, 12-second fetch deadlines and a two-redirect allowance, exact `https://tront.xyz` origin. The explicit GET loop spaces starts by at least 250ms. No crawl or link expansion.

Browser runs use fresh isolated contexts, block service workers, non-GET/HEAD methods and all `demo.js` requests, and allow only the public site and required public asset CDNs. Third-party omissions are recorded. No user credentials/cookies are loaded, forms submitted, tutorial hash route invoked, game code run or site state changed.

The browser command has a 240-second cap; the entire job has a 9-minute cap. Uses existing pinned official actions and Playwright 1.62.0, official Chrome, `contents: read`, no persisted checkout credentials and no custom secrets or deploy permissions. Artifacts expire after three days.

A blocked tutorial interaction, failed marker/control assertion, missing screenshot evidence, or incomplete case count produces a non-clean result. HTTP-only availability is kept separate from browser interaction results. Physical display-frame exhaustiveness is not claimed from bounded rAF samples.

## Validation performed locally

- Nine standard-library Node contract tests pass.
- JavaScript syntax checks pass.
- Exact baseline/candidate tutorial blobs and the single href difference pass.
- SVG marker parser accepts the exact `7f0471e` topbar source.
- No local Chrome attempt or live public follow-up run occurred. Actual visibility, click/Back and mobile behavior remain for the reviewed GitHub runner.

Run offline checks with `node --test tools/site-followup/test.cjs`. The workflow runs `followup.cjs` only when `GITHUB_ACTIONS=true`, then uploads `summary.json`, per-case JSON and focused screenshots. It does not run `tools/route-audit` or alter older workflows.
