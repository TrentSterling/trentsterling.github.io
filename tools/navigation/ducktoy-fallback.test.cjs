'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { file, rule, normalize, assertFixed } = require('./ducktoy-fallback.cjs');
const root = path.resolve(__dirname, '../..');
const read = (p, base = root) => fs.readFileSync(path.join(base, p), 'utf8');
test('DuckToy hides only its inert theme button without script; every other source byte is exact', () => {
  const html = read(file), base = process.env.THEME_BASELINE_ROOT;
  assert.ok(base, 'actual PR baseline required'); assertFixed(html);
  assert.equal(normalize(html, file), normalize(read(file, base), file));
  assert.equal(normalize(normalize(html, file), file), normalize(html, file));
  assert.deepEqual(html.split('</head>')[1], read(file, base).split('</head>')[1], 'entire body unchanged');
});
test('DuckToy allowance rejects duplicate, misplaced, widened, copy and destination changes', () => {
  const html = read(file), plain = normalize(html, file);
  assert.throws(() => normalize(html + rule, file), /duplicate/);
  assert.throws(() => assertFixed(plain.replace('</body>', rule + '</body>')), /head-only/);
  assert.throws(() => assertFixed(html.replace(rule, rule.replace('#tront-theme-btn', 'button'))));
  for (const changed of [html.replace('Not released yet.', 'Released.'), html.replace('href="/games/"', 'href="/changed/"'), html.replace(rule, rule.replace('none', 'block'))]) assert.notEqual(normalize(changed, file), plain);
  assert.equal(normalize(html, 'other/index.html'), html);
});
test('DuckToy gate watches its route and retains shared theme implementation', () => {
  const base = process.env.THEME_BASELINE_ROOT;
  for (const asset of ['assets/js/tront-theme.js', 'assets/css/tront-themes.css', 'ducktoy/flock.png', 'ducktoy/duck.png']) assert.deepEqual(fs.readFileSync(path.join(root, asset)), fs.readFileSync(path.join(base, asset)), asset);
  const workflow = read('.github/workflows/site-checks.yml');
  assert.ok(workflow.includes('- ducktoy/index.html'));
  assert.ok(workflow.includes('node tools/navigation/ducktoy-fallback-browser.cjs'));
});
