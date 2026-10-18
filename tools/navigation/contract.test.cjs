'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { changes, pages, normalize: normalizeNavigation, links, assertPrimary } = require('./contract.cjs');
const { normalize: normalizeInvites } = require('./discord-invites.cjs');
const { file: deviceFile, normalize: normalizeDevice } = require('./device-download.cjs');
const { normalize: normalizeResponsive } = require('./device-responsive.cjs');
const { normalize: normalizeAuthors, changes: authorChanges } = require('../seo/author-links.cjs');
const { normalize: normalizeMinecraft, file: minecraftFile } = require('./minecraft-initial.cjs');
const tinyzombies = require('../game-media/tinyzombies-preview.cjs');
const { files: legacyNavbarFiles, normalize: normalizeLegacyNavbar } = require('./legacy-navbar.cjs');
const { file: gamesMdFile, normalize: normalizeGamesMd } = require('./games-md.cjs');
const normalizeExisting = (html, file) => normalizeLegacyNavbar(tinyzombies.normalize(normalizeMinecraft(normalizeAuthors(normalizeResponsive(normalizeDevice(normalizeInvites(normalizeNavigation(html, file), file), file), file), file), file), file), file);
const normalize = (html, file) => normalizeGamesMd(normalizeExisting(html, file), file);
const root = path.resolve(__dirname, '../..');
const read = (file, dir = root) => fs.readFileSync(path.join(dir, file), 'utf8');
const context = { window: {} };
vm.runInNewContext(read('assets/js/tront-system.js'), context);
const Tront = context.window.Tront;
const hub = JSON.parse(JSON.stringify(Tront.HUB));

for (const page of pages) test(page.file + ': static navigation agrees with central registry and current route', () => {
  assertPrimary(read(page.file), page, hub);
});

test('current-link contracts reject dummy destinations, false current states, label drift and changed order', () => {
  for (const page of pages) {
    const html = read(page.file);
    assert.throws(() => assertPrimary(html.replace('href="/blog/" class="nav-link"', 'href="#" class="nav-link"'), page, hub));
    assert.throws(() => assertPrimary(html.replace('class="nav-link">Blog', 'class="nav-link" aria-current="page">Blog'), page, hub));
    assert.throws(() => assertPrimary(html.replace('class="nav-link">Blog', 'class="nav-link">News'), page, hub));
  }
  const games = read('games/index.html');
  assert.throws(() => assertPrimary(games.replace(' aria-current="page"', ''), pages[1], hub));
  assert.throws(() => assertPrimary(games.replace('href="/games/" class="nav-link active"', 'href="javascript:void(0);" class="nav-link active"'), pages[1], hub));
});

test('generated hub nav and static style primary nav share the existing registry', () => {
  for (const entry of hub) {
    const rendered = links(Tront.nav({ active: entry.label, crosslink: false }));
    assert.deepEqual(rendered.map(({ label, href }) => ({ label, href })), hub);
    assert.deepEqual(rendered.filter(link => link.current).map(link => [link.label, link.current]), [[entry.label, 'page']]);
  }
  const style = links(read('style/index.html').match(/<nav class="t-nav t-nav--hub">([\s\S]*?)<\/nav>/)[1]);
  assert.deepEqual(style.slice(0, 4).map(({ label, href }) => ({ label, href: new URL(href, 'https://tront.xyz').href })), hub);
  assert.deepEqual(style.filter(link => link.current).map(link => [link.label, link.href, link.current]), [['Style', '/style/', 'page']]);
  assert.match(read('minecraft-modding/index.html'), /<nav id="nav" class="t-nav t-nav--product" aria-label="Page">/);
  assert.equal(links(Tront.nav({ variant: 'product', links: [{ label: 'Start', href: '#lesson-0' }], crosslink: false })).filter(link => link.current).length, 0);
});

test('every existing production file is unchanged outside the exact reviewed anchors and page-local responsive changes', () => {
  const base = process.env.THEME_BASELINE_ROOT;
  assert.ok(base, 'THEME_BASELINE_ROOT must identify the PR base checkout');
  const files = execFileSync('git', ['-C', base, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const production = files.filter(file => !file.startsWith('tools/') && !file.startsWith('.github/') && !file.startsWith('.local/'));
  for (const file of production) {
    const before = fs.readFileSync(path.join(base, file));
    const after = fs.readFileSync(path.join(root, file));
    if (changes.some(change => change.file === file) || file === deviceFile || file === minecraftFile || file === gamesMdFile || legacyNavbarFiles.includes(file) || authorChanges.some(change => change.file === file)) assert.equal(normalize(after.toString(), file), normalize(before.toString(), file), file + ': exact allowed anchor only');
    else assert.deepEqual(after, before, file + ': byte-identical');
  }
  const candidateFiles = execFileSync('git', ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const newProduction = candidateFiles.filter(file => !files.includes(file) && !file.startsWith('tools/') && !file.startsWith('.github/') && !file.startsWith('.local/'));
  assert.deepEqual(newProduction, files.includes(tinyzombies.file) ? [] : [tinyzombies.file], 'only the exact reviewed clip may be new');
  tinyzombies.assertReviewedBytes(tinyzombies.file, fs.readFileSync(path.join(root, tinyzombies.file)));
  assert.equal(production.filter(file => file.endsWith('.mp4') && file !== tinyzombies.file).length, 98, 'retain all 98 earlier MP4 files');
});

test('exact anchor normalization does not hide unreviewed changes', () => {
  for (const change of changes) {
    const html = read(change.file), plain = normalize(html, change.file);
    assert.equal(html.split(change.after).length, 2);
    assert.equal(normalize(html + 'changed', change.file), plain + 'changed');
    assert.notEqual(normalize(html.replace(change.after, change.after.replace('aria-current="page"', 'aria-current="step"')), change.file), plain);
    assert.notEqual(normalize(html.replace(change.after, change.after.replace('href="/', 'href="/changed/')), change.file), plain);
    assert.throws(() => normalize(html + change.after, change.file), /duplicate/);
    assert.equal(normalize(html, 'unrelated.html'), html);
  }
});

test('CI covers shared CSS, both current consumers and independent navigation gates', () => {
  const workflow = read('.github/workflows/site-checks.yml');
  for (const trigger of ['assets/css/tront-system.css', 'style/**', 'minecraft-modding/**', 'tools/navigation/**']) assert.ok(workflow.includes('- ' + trigger), trigger);
  assert.ok(workflow.includes('node --test tools/navigation/*.test.cjs'));
  assert.ok(workflow.includes('node tools/navigation/browser.cjs'));
  assert.ok(workflow.includes('6c930487e3fd2c723017d3780ff62ee4436ff44a'));
  assert.ok(workflow.includes('7f0471eba88b129331ae13404876f621ec62db37'));
  assert.ok(workflow.includes('pngjs@7.0.0'));
  assert.ok(workflow.includes('BLOG_SHARED_ROOT: ${{ github.workspace }}'), 'current heading tests read candidate shared assets');
  assert.ok(workflow.includes('node tools/theme-review/sidebar-focus.cjs'));
  assert.ok(workflow.includes('bundle exec ruby tools/author-profiles/test.rb'));
  assert.ok(workflow.includes('bundle exec ruby tools/author-profiles/check_built.rb _site/blog _site/blog'));
});
