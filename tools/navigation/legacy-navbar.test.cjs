'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { files, block, buttonBefore, buttonAfter, normalize, assertResponsive } = require('./legacy-navbar.cjs');
const { block: deviceBlock } = require('./device-responsive.cjs');
const root = path.resolve(__dirname, '../..');
const read = (file, source = root) => fs.readFileSync(path.join(source, file), 'utf8');
for (const file of files) test(file + ': only the exact responsive block and action name change', () => {
  const base = process.env.THEME_BASELINE_ROOT;
  assert.ok(base, 'THEME_BASELINE_ROOT identifies the actual PR base');
  const html = read(file), before = read(file, base);
  assertResponsive(html);
  assert.equal(normalize(html, file), normalize(before, file), 'all other HTML/CSS/metadata/copy remains exact');
  assert.equal(normalize(normalize(html, file), file), normalize(html, file), 'already-normalized source is stable');
  const nav = html.match(/<nav id="magic-navbar-container">[\s\S]*?<\/nav>/)[0];
  assert.deepEqual([...nav.matchAll(/<a href="([^"]+)"/g)].map(match => match[1]), ['/discord/', '/blog/', '/games/', '/']);
  assert.equal(nav.split(buttonAfter).length, 2);
  assert.equal(nav.includes(buttonBefore), false);
  assert.ok(html.indexOf(block) < html.indexOf('</style>'), 'override stays inside the existing page stylesheet');
});
test('the page-local geometry uses the reviewed Device History precedent without changing desktop rules', () => {
  assert.equal(block, deviceBlock.replace('Device History: retain', 'Retain').replace('padding: 0 8px', 'padding: 0 6px'));
  assert.ok(block.includes('padding: 0 6px'), 'outer padding also fits Notesdash Purple at 361px');
  assert.equal((block.match(/@media/g) || []).length, 2);
  assert.ok(block.includes('@media (max-width: 600px)'));
  assert.ok(block.includes('@media (max-width: 360px)'));
  assert.ok(block.includes('.theme-label { display: inline; }'), 'do not hide the only visible name with the icons');
  assert.ok(block.includes('flex: 0 0 auto;'));
});
test('the accessible action describes the unchanged five-mode cycle, not an editor', () => {
  assert.ok(buttonAfter.includes('aria-label="Cycle color theme"'));
  const source = read('assets/js/tront-theme.js');
  assert.deepEqual([...source.matchAll(/id: '([^']+)'/g)].map(match => match[1]), ['dark', 'tront-cyan', 'tront-purple', 'tront-ember', 'light']);
  assert.ok(source.includes("btn.addEventListener('click', function ()"));
  assert.ok(source.includes('idx = (idx + 1) % THEMES.length;'));
  assert.doesNotMatch(buttonAfter, /editor|dialog|menu|aria-expanded|aria-pressed/);
});
test('exact normalization rejects duplicate regions and cannot hide CSS, label, destination or copy mutations', () => {
  for (const file of files) {
    const html = read(file), plain = normalize(html, file);
    assert.throws(() => normalize(html + block, file), /duplicate/);
    assert.throws(() => normalize(html + buttonAfter, file), /duplicate/);
    assert.throws(() => assertResponsive(plain));
    for (const changed of [
      html.replace(block, block.replace('gap: 5px', 'gap: 50px')),
      html.replace(buttonAfter, buttonAfter.replace('Cycle color theme', 'Open editor')),
      html.replace('href="/games/"', 'href="/unreviewed/"'),
      html.replace('>Home</span>', '>Start</span>'),
      html + '<p>Unreviewed copy</p>'
    ]) assert.notEqual(normalize(changed, file), plain);
    assert.equal(normalize(html, 'audiobounce/index.html'), html, 'no broader page allowance');
  }
});
test('shared navigation, theme behavior and all original style declarations stay exact', () => {
  const base = process.env.THEME_BASELINE_ROOT;
  assert.ok(base);
  for (const file of ['assets/css/tront-navbar.css', 'assets/css/tront-themes.css', 'assets/js/tront-theme.js', 'assets/js/tront-theme-editor.js', 'assets/js/tront-system.js']) assert.equal(read(file), read(file, base), file);
  const styles = html => [...html.matchAll(/<style\b[\s\S]*?<\/style>/g)].map(match => match[0]);
  for (const file of files) assert.deepEqual(styles(normalize(read(file), file)), styles(normalize(read(file, base), file)), file);
});
test('CI retains all four consumer triggers and runs focused browser proof', () => {
  const workflow = read('.github/workflows/site-checks.yml');
  for (const file of files) assert.ok(workflow.includes('- ' + file));
  assert.ok(workflow.includes('- tools/navigation/**'));
  assert.ok(workflow.includes('node --test tools/navigation/*.test.cjs'));
  assert.ok(workflow.includes('node tools/navigation/legacy-navbar-browser.cjs'));
});
