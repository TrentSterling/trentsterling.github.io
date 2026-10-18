# Wide-gallery frame accounting

This test-only instrumentation corrects the old endpoint-array subtraction. The
original 2-second warmup plus 5-second sample crosses the gallery's 6.5-second
rotation. Reused videos reset their lifetime counters during load, so subtracting
unrelated endpoint entries can undercount or lose retiring clips entirely.

`frame-sampler.cjs` records the actual video object (WeakMap ID) and each explicit
load/src-assignment generation. Every possible reset gets an immediate pre-native
snapshot; the new generation requires an observed zero baseline. Removing `src`
is metadata only, not a reset. Detached objects remain tracked through the final
snapshot. Polls, media/visibility events and source snapshots are retained in raw
form, including the warmup, and monotonic deltas are summed within one generation.
An ordinary loop does not reset the generation. The native methods run once and
keep their return/throw behavior; the test does not add playback operations.

Unexpected resets, missing zero/retirement/final snapshots, missing element census
coverage, counter inconsistencies, visibility loss, instrumentation failures and
long observation gaps make the measurement **invalid**, never green. Observation
gaps limit visibility/census evidence; they do not by themselves prove lost frame
counter coverage. Newborn frames count after their actual zero record. Counters
are browser-reported delivery loss, not a decoder-only or real-user benchmark.

The retained performance gate is `frames > 300 && drops / frames < .10`. All twelve
players, viewport, media bytes, runtime, rotation, quality, warmup and sample
length remain unchanged. The former positional ratio is saved only as an
explicitly invalid diagnostic comparison. A bookkeeping correction does not
explain away the previously observed high CI frame drops.

## Same-runner comparison

Run `node --test tools/game-media/frame-*.test.cjs`, then
`node tools/game-media/frame-comparison.cjs` with the existing Playwright/Chrome
setup. The two sequential child processes use the same checkout and runner:

1. Original full gallery suite, including its earlier scrolling, preference and
   poster-decoding checks, then the instrumented wide case in that same browser.
2. The same wide case in a new browser process (`verify.cjs --wide-only`).

The second case runs even when the first fails. Either failure keeps the command
red. A timeout or missing report is explicitly incomplete, and the comparison
cannot be called valid when the commit differs or process cleanup is uncertain.
Both reports must exist; CI also checks the exact PR-head identity. This bounded
A/B distinguishes prior-browser effects from a repeatable workload on that runner,
without proving causality or performance on other hardware.

Reports are written before assertions and in `finally`. The artifact contains
raw source/event snapshots, per-generation totals, census/visibility history,
actual monotonic elapsed time, decoder/media events, browser/version and GPU
feature/compositor evidence from CDP, CPU models/times/load, memory and available
cgroup quota/throttling evidence. Unsupported evidence is marked unavailable.
`SystemInfo` describes available GPU/feature state; it is not a GPU-time profiler.
No screenshots or host/CDP environment polling run during the 5-second sample.
Small polling/hook overhead remains a limitation of the instrumented experiment.

Outputs: `.local/gallery-frame-comparison.json` and per-case files under
`.local/gallery-frame-comparison/`. Top-level legacy report names remain for
existing artifact consumers. `GALLERY_BROWSER_EXECUTABLE` permits an explicitly
identified local browser for debugging; CI continues to use official Chrome.
