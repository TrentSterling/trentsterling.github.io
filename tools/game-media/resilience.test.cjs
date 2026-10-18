'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { normalize, replacements } = require('./games-resilience.cjs');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'games/index.html'), 'utf8');

test('Games becomes readable immediately without reading the Font Loading API', () => {
  const block = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .find(match => match[1].includes("document.getElementById('current-year')"))[1];
  const script = block.match(/\(function\(\)\{([\s\S]*?)\}\)\(\);/)[1];
  let visible = false;
  const year = { textContent: '' };
  const document = {
    get fonts() { throw new Error('Reading font readiness would reintroduce the gate'); },
    body: { classList: { add(value) { assert.equal(value, 'fonts-loaded'); visible = true; } } },
    getElementById(id) { assert.equal(id, 'current-year'); return year; }
  };
  vm.runInNewContext(script, { document, Date });
  assert.equal(visible, true);
  assert.equal(year.textContent, new Date().getFullYear());
});

test('Games preserves the existing no-JavaScript visibility fallback', () => {
  assert.ok(html.includes('<noscript><style>body{opacity:1;visibility:visible}</style></noscript>'));
});

test('Games body is visible before any script or font-dependent animation runs', () => {
  // This fails for the attempted JS-only reveal: WebKit can hold its opacity
  // transition at zero while font requests remain pending.
  const bodyRule = html.match(/\n\s*body\{([^}]+)\}/)[1];
  assert.match(bodyRule, /(?:^|;)opacity:1(?:;|$)/);
  assert.match(bodyRule, /(?:^|;)visibility:visible(?:;|$)/);
});

test('Games bytes outside exact reviewed resilience replacements match the PR base', () => {
  const baseline = process.env.THEME_BASELINE_ROOT;
  assert.ok(baseline, 'THEME_BASELINE_ROOT must identify a checkout of the PR base');
  const before = fs.readFileSync(path.join(baseline, 'games/index.html'), 'utf8');
  for (const [, after] of replacements) assert.equal(html.split(after).length, 2);
  assert.equal(normalize(html, 'games/index.html'), normalize(before, 'games/index.html'));
  assert.equal(normalize(html + 'changed', 'games/index.html'), normalize(html, 'games/index.html') + 'changed');
  assert.equal(normalize(html, 'unrelated/index.html'), html);
});
