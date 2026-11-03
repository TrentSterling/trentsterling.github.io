'use strict';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function summarize(data) {
  const fcp = data.paints.find(e => e.name === 'first-contentful-paint')?.startTime;
  const frames = data.frames.filter(f => (fcp === undefined || f.t >= fcp) && f.visible);
  const firstFor = key => frames.find(f => f[key] && (!Array.isArray(f[key]) || f[key].length));
  const last = frames.at(-1);
  const deltas = {};
  for (const key of ['theme', 'body', 'nav', 'title', 'main', 'sidebar', 'cardAccents']) {
    const first = firstFor(key);
    if (!first || !last || !last[key]) continue;
    const changes = []; let previous = first[key];
    for (const f of frames.filter(f => f.t > first.t && f[key])) {
      if (!same(previous, f[key])) { if (changes.length < 40) changes.push({at:f.t,before:previous,after:f[key]}); previous=f[key]; }
    }
    if (changes.length) deltas[key] = { firstAt: first.t, lastAt: last.t, before: first[key], after: last[key], changes };

  }
  return {
    status: !last ? 'inconclusive-no-visible-frame' : Object.keys(deltas).length ? 'review-delta' : 'no-observed-delta',
    firstContentfulPaint: fcp ?? null, visibleSamples: frames.length,
    sampleCapReached: data.sampleCapReached, fontsStatus: data.fontsStatus,
    cls: data.shifts.filter(s => !s.hadRecentInput).reduce((n, s) => n + s.value, 0),
    deltas,
    notes: ['A delta is a review signal, not automatically a defect. Native Games/Monke font fades, font swaps, media, and intentional animation are separate from theme flashes.', 'rAF sampling and CDP screencasts can miss compositor frames. No-observed-delta is not proof that every physical display frame was identical.']
  };
}
module.exports = { summarize };
