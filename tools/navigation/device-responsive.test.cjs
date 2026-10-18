'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { file, block, before, after, normalize, assertResponsive } = require('./device-responsive.cjs');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, file), 'utf8');
test('Device History restores readable labels and its existing mobile install rule locally', () => {
  assertResponsive(html);
  assert.ok(block.includes('.theme-label { display: inline; }'), 'override legacy hidden label before removing narrow decorative icon');
  assert.ok(block.includes('flex: 0 0 auto'));
  assert.ok(html.includes('@media(max-width:640px) { .install-options { grid-template-columns: 1fr; } }'));
  for (const wrong of [html.replace(block, ''), html.replace(after, before), html.replace('flex: 0 0 auto; justify-content', 'flex: 1 1 auto; justify-content')]) assert.throws(() => assertResponsive(wrong));
});
test('every byte outside the exact responsive block and redundant inline override is preserved', () => {
  assert.ok(process.env.THEME_BASELINE_ROOT);
  const base = fs.readFileSync(path.join(process.env.THEME_BASELINE_ROOT, file), 'utf8');
  assert.equal(normalize(html, file), normalize(base, file));
  assert.equal(normalize(html, 'other.html'), html);
  assert.equal(normalize(html + 'changed', file), normalize(html, file) + 'changed');
  assert.throws(() => normalize(html + block, file), /duplicate/);
  assert.throws(() => normalize(html + after, file), /duplicate/);
  assert.notEqual(normalize(html.replace('Device History</h1>', 'Changed</h1>'), file), normalize(base, file));
});
test('CI runs the bounded responsive browser regression', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/site-checks.yml'), 'utf8');
  assert.ok(workflow.includes('- device-history/index.html'));
  assert.ok(workflow.includes('node tools/navigation/device-responsive-browser.cjs'));
});
