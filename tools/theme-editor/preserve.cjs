/* PR regression boundary: compare with the separately checked-out base commit. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const isaac = require('../game-media/isaac-archive.cjs');
const recorded = require('../game-media/recorded-previews.cjs');
const { withoutAddition: withoutBreadcrumbAddition } = require('../seo/breadcrumbs.cjs');
const craftmine2 = require('../game-media/craftmine2-card.cjs');
const { normalizeYearsForPreservation, normalizeReleasedForPreservation, recovered } = require('./gallery-content.cjs');
const normalizeGames = html => normalizeYearsForPreservation(normalizeReleasedForPreservation(craftmine2.normalizeForPreservation(isaac.normalizeForPreservation(html))));
const root = path.resolve(__dirname, '../..');
const baseline = process.env.THEME_BASELINE_ROOT;
assert.ok(baseline, 'THEME_BASELINE_ROOT must identify a checkout of the PR base');
const read = (dir, file) => withoutBreadcrumbAddition(fs.readFileSync(path.join(dir, file), 'utf8'), file);
const blocks = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))].map(match => match[1]);
const copy = html => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
for (const file of ['index.html', 'discord/index.html', 'games/index.html']) {
  const before = read(baseline, file), after = read(root, file);
  const normalize = file === 'games/index.html' ? normalizeGames : value => value;
  assert.equal(copy(normalize(after)), copy(normalize(before)), `${file}: every existing text node is preserved except the exact approved Isaac media placeholder and four verified year additions and one exact CraftMine 2 card`);
  assert.deepEqual(blocks(after, 'style'), blocks(before, 'style'), `${file}: inline layout CSS is preserved`);
  const nonTheme = html => blocks(html, 'script').filter(s => s.trim() && !s.includes('localStorage.getItem("tront-theme")'));
  assert.deepEqual(nonTheme(after), nonTheme(before), `${file}: non-theme scripts are preserved`);
}
const gamesBefore = read(baseline, 'games/index.html'), gamesAfter = read(root, 'games/index.html');
const galleryContent = html => normalizeGames(html).slice(html.indexOf('    <input type="radio" name="filter"')).replace(/    <script src="\/assets\/js\/tront-theme.js"><\/script>\n/, '');
assert.equal(galleryContent(gamesAfter), galleryContent(gamesBefore), 'all filters, cards, widgets, other media links, scripts and footer stay byte-identical outside the exact approved Isaac replacement and four verified year additions and one exact CraftMine 2 card');
// Include working bytes and untracked additions, not only committed blob IDs.
const tree = dir => new Map(execFileSync('git', ['-C', dir, 'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'games', 'assets/css/tront-themes.css', 'assets/js/tront-theme.js', 'assets/js/tront-system.js'], { encoding: 'utf8' })
  .split('\0').filter(Boolean).sort().map(file => [file, isaac.digest(fs.readFileSync(path.join(dir, file)))]));
const beforeTree = tree(baseline), afterTree = tree(root);
beforeTree.delete('games/index.html'); afterTree.delete('games/index.html');
isaac.assertMedia(root);
for (const [file, expected] of Object.entries(isaac.files)) {
  // Remove only these two reviewed hashes after verifying them individually.
  if (beforeTree.has(file)) assert.equal(beforeTree.get(file), expected.sha256, `${file}: approved baseline media`);
  assert.equal(afterTree.get(file), expected.sha256, `${file}: approved new media`);
  beforeTree.delete(file); afterTree.delete(file);
}
craftmine2.assertMedia(root);
for (const [file, expected] of Object.entries(craftmine2.files)) {
  if (beforeTree.has(file)) assert.ok([expected.sha256, expected.previousSha256].filter(Boolean).includes(beforeTree.get(file)), file+': reviewed baseline bytes');
  assert.equal(afterTree.get(file), expected.sha256, file+': approved new media');
  beforeTree.delete(file); afterTree.delete(file);
}
for (const [file, expected] of Object.entries(recovered.media)) {
  if (beforeTree.has(file)) assert.equal(beforeTree.get(file), expected.sha256, file+': reviewed recovered baseline media');
  assert.equal(afterTree.get(file), expected.sha256, file+': reviewed recovered release screenshot');
  beforeTree.delete(file); afterTree.delete(file);
}
recorded.assertMedia(root);
for (const item of recorded.previews) {
  if (beforeTree.has(item.file)) assert.equal(beforeTree.get(item.file), item.sha256, item.file+': reviewed baseline recording');
  assert.equal(afterTree.get(item.file), item.sha256, item.file+': reviewed new recording');
  beforeTree.delete(item.file); afterTree.delete(item.file);
}
assert.deepEqual(afterTree, beforeTree, 'every other gallery media/behavior/shared legacy file stays byte-identical');
console.log(`PASS: all page copy, inline layouts, gallery content and ${beforeTree.size} protected files match the PR base outside the exact reviewed Isaac media addition and four verified year additions and one exact CraftMine 2 card.`);
