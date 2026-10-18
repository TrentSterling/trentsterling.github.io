'use strict';
const assert = require('node:assert/strict');
// Test-only literal boundary for the one reviewed SnapScan grid declaration.
const file = 'snapscan/index.html';
const before = '    .features-grid {\n      display: grid;\n      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));\n      gap: 20px;\n    }';
const after = before.replace('minmax(300px, 1fr)', 'minmax(min(300px, 100%), 1fr)');
function normalize(html, target) {
  if (target !== file) return html;
  assert.ok(html.split(after).length <= 2, 'duplicate reviewed SnapScan grid');
  return html.replace(after, before);
}
function assertFixed(html) {
  assert.equal(html.split(after).length, 2, 'one exact reviewed SnapScan grid');
  assert.equal(html.includes(before), false, 'no duplicate old grid');
}
// Passed directly to page.evaluate; no injected DOM/style changes.
function measure() {
  const grid = document.querySelector('.features-grid');
  const rect = element => { const r = element.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height }; };
  const cards = [...grid.children], textOverflow = [];
  for (const [index, card] of cards.entries()) {
    const box = rect(card), walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(walker.currentNode);
      for (const r of range.getClientRects()) if (r.width) {
        if (r.left < box.left - .1 || r.right > box.right + .1) textOverflow.push(index);
      }
    }
  }
  return { width:innerWidth, zoom:parseFloat(getComputedStyle(document.documentElement).zoom) || 1, rect:rect(grid),
    cards:cards.map(rect), text:cards.map(card => card.textContent), textOverflow,
    otherRight:Math.max(innerWidth, ...[...document.body.querySelectorAll('*')].filter(element => !grid.contains(element)).map(element => element.getBoundingClientRect().right)),
    gap:getComputedStyle(grid).gap, supports:CSS.supports('grid-template-columns', 'repeat(auto-fit,minmax(min(300px,100%),1fr))') };
}
function compare(original, candidate, oldHtml, newHtml, oldState, newState) {
  assertFixed(newHtml);
  const changed = oldHtml.includes(before) && !oldHtml.includes(after);
  assert.equal(candidate.cards.length, 7); assert.deepEqual(candidate.text, original.text);
  assert.ok(candidate.supports); assert.equal(candidate.gap, original.gap);
  assert.equal(candidate.width, original.width); assert.equal(candidate.zoom, original.zoom);
  assert.equal(candidate.otherRight, original.otherRight, 'unrelated horizontal extents remain exact');
  for (const card of candidate.cards) assert.ok(card.left >= candidate.rect.left - .1 && card.right <= candidate.rect.right + .1, 'all seven cards fit the grid');
  if (candidate.zoom === 1) assert.deepEqual(candidate.textOverflow, [], 'normal 320px-and-up feature text remains inside its card');
  if (!changed || original.cards[0].width === candidate.cards[0].width) {
    assert.deepEqual(candidate, original, 'already-fixed or wider grid is exact');
    return { expected:oldState, reflow:0, correctedOverflow:false };
  }
  // Only the formerly forced 300px single column may shrink. Other geometry
  // stays exact; naturally wrapped cards shift lower actions by the grid delta.
  assert.equal(original.cards[0].width, 300 * original.zoom);
  assert.ok(candidate.rect.width < 300 * candidate.zoom);
  const delta = candidate.rect.height - original.rect.height;
  assert.ok(delta >= 0);
  assert.deepEqual(candidate.rect, { ...original.rect, height:original.rect.height + delta, bottom:original.rect.bottom + delta });
  for (const card of candidate.cards) { assert.equal(card.left, candidate.rect.left); assert.equal(card.width, candidate.rect.width); }
  // The normal-width defect is a precise 4px overflow. Raw decorative bounds
  // include intentionally clipped artwork and are not document scroll extents.
  assert.equal(candidate.width, 320, 'only this measured narrow fixture reflows');
  if (candidate.zoom === 1) {
    assert.equal(oldState.scrollWidth, 324); assert.equal(newState.scrollWidth, 320);
  } else {
    // Retain the existing CSS-zoom-2 author stress case (160 effective pixels).
    // Unchanged unbreakable words and other page sections still overflow there;
    // the exact grid change may reduce, but cannot worsen, document overflow.
    assert.equal(candidate.zoom, 2); assert.equal(oldState.scrollWidth, 648);
    assert.ok(newState.scrollWidth >= candidate.width && newState.scrollWidth < oldState.scrollWidth);
  }
  const expected = structuredClone(oldState); expected.scrollWidth = newState.scrollWidth;
  for (const control of expected.primaryControls) {
    if (control.rect ? control.rect.top >= original.rect.bottom : control.y >= original.rect.bottom) {
      if (control.rect) { control.rect.top += delta; control.rect.bottom += delta; }
      else control.y += delta;
    }
  }
  return { expected, reflow:delta, correctedOverflow:true };
}
// The exact narrow reflow changes the themed body behind the unchanged
// translucent navbar. WebKit changes its first raster row; Chrome changes a
// sparse set of one-level RGB values. Actual-base and self-base diagnostics
// distinguish this repeatable reflow from arbitrary capture noise.
function pixelParity(original, candidate, context) {
  assert.equal(candidate.width, original.width); assert.equal(candidate.height, original.height);
  const allowed = context.file === file && context.width === 320 && context.reflow > 0 && candidate.width === 320 && candidate.height === 96;
  let firstRowChangedPixels = 0, sparseChangedPixels = 0, maxChannelDelta = 0;
  for (let pixel = 0; pixel < candidate.width * candidate.height; pixel++) {
    let changed = false;
    const firstRow = pixel < candidate.width;
    for (let channel = 0; channel < 4; channel++) {
      const delta = Math.abs(candidate.data[pixel*4+channel] - original.data[pixel*4+channel]);
      if (!delta) continue;
      assert.ok(allowed && channel < 3 && delta <= (firstRow ? 4 : 1),
        'only the proven SnapScan 320px reflow permits first-row RGB delta four or sparse RGB delta one; alpha stays exact');
      maxChannelDelta = Math.max(maxChannelDelta, delta); changed = true;
    }
    if (changed) {
      if (firstRow) firstRowChangedPixels++;
      else sparseChangedPixels++;
    }
  }
  assert.ok(sparseChangedPixels <= 96, 'at most 96 off-first-row pixels may differ by one RGB level');
  return { pixelIdentical:firstRowChangedPixels + sparseChangedPixels === 0, firstRowChangedPixels, sparseChangedPixels, maxChannelDelta };
}
module.exports = { file, before, after, normalize, assertFixed, measure, compare, pixelParity };
