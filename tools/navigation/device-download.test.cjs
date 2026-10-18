'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { file, url, changes, release, normalize: normalizeDownloads, assertDownloads } = require('./device-download.cjs');
const { normalize: normalizeResponsive } = require('./device-responsive.cjs');
const normalize = (html, file) => normalizeResponsive(normalizeDownloads(html, file), file);
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, file), 'utf8');
test('both downloads identify the actual published portable binary and explicit version', () => {
  assertDownloads(html);
  assert.equal(url, 'https://github.com/TrentSterling/device-history/releases/download/v0.8.0/device-history.exe');
  assert.equal(release.id, 291773427); assert.equal(release.asset.id, 364581235);
});
test('unpublished destinations and ambiguous binary labels are rejected', () => {
  for (const change of changes) {
    assert.throws(() => assertDownloads(html.replace(change.after, change.before)));
    assert.throws(() => assertDownloads(html.replace(change.after, change.after.replace('v0.8.0 Portable', 'Portable').replace('Portable .exe v0.8.0', 'Portable .exe'))));
    assert.throws(() => assertDownloads(html.replace(change.after, change.after.replace('/v0.8.0/', '/v0.8.3/'))));
  }
});
test('every byte outside reviewed download anchors and page-local responsive changes matches the PR base', () => {
  assert.ok(process.env.THEME_BASELINE_ROOT);
  const before = fs.readFileSync(path.join(process.env.THEME_BASELINE_ROOT, file), 'utf8');
  assert.equal(normalize(html, file), normalize(before, file));
  assert.equal(normalize(html + 'changed', file), normalize(html, file) + 'changed');
  assert.equal(normalize(html, 'other/index.html'), html);
  assert.throws(() => normalize(html + changes[0].after, file), /duplicate/);
  for (const image of ['device-history/screenshot.png', 'device-history/og-image-20261001.png']) {
    assert.deepEqual(fs.readFileSync(path.join(root, image)), fs.readFileSync(path.join(process.env.THEME_BASELINE_ROOT, image)));
  }
});
test('CI covers this legacy landing page and its separate download browser checks', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/site-checks.yml'), 'utf8');
  assert.ok(workflow.includes('- device-history/index.html'));
  assert.ok(workflow.includes('node tools/navigation/device-download-browser.cjs'));
});
