# Public first-paint diagnostic

Read-only browser and HTTP checks for the existing site. No runtime or deployment changes.

Run pure classifier tests with `node --test tools/paint-audit/test.cjs`. Browser capture and HTTP checks run only in the PR-only `paint-audit.yml` workflow with official Chrome and pinned Playwright. The workflow has contents:read permission, no secrets/deployment and no persisted checkout credentials.

## Coverage

- Home, Discord, Games, blog index/post and Monke: clean/saved preferences, desktop/mobile, cold/warm cache.
- Separate delayed CSS/editor/deferred-script/font experiments, plus Back/Forward, responsive widths and Games ColorMagic/Reset state preservation.
- HTTP status/body checks for source-backed main child routes; exact static-byte comparison against main 6afc1a3c367a59e52ec97cbb6aaa98ed20938d9e and Monke f1d810c384c4a4a83f416bcbdd197ef920378fff.
- Generated blog HTML is not compared to raw source. Enumerate a production build for complete post/taxonomy/pagination smoke coverage; the sitemap alone omits some routes.
- `representative-routes.json` provides a second bounded child-route shard.

## Evidence and limits

Timed CDP filmstrips, per-frame DOM/style samples, FCP/CLS, screenshots, resource failures and source hashes are retained as CI artifacts for seven days. Review `summary.json` and individual reports before assigning causes. A delta is a review signal, not automatically a bug; native fades, animation, font swaps and media startup remain distinct.

Normal cases avoid request interception so warm-cache observations remain meaningful. Delay experiments intentionally disable cache and make no warm-cache claim. Service workers are blocked and contexts contain no authenticated user state. Theme changes affect only disposable test-context local storage.

Critical first-party dependency errors, known intermediary pages, missing visible samples and unsettled fonts prevent a clean verdict. Sampling is capped at 100 screencast images and 1,200 rAF observations per navigation; cap flags are retained. CDP/rAF samples may perturb timing or miss physical display frames, so no-observed-delta is not proof that every frame was identical.
