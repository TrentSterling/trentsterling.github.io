/* PR regression boundary: compare with the separately checked-out base commit. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const isaac = require('../game-media/isaac-archive.cjs');
const { normalizeYearsForPreservation } = require('./gallery-content.cjs');
const normalizeGames = html => normalizeYearsForPreservation(isaac.normalizeForPreservation(html));
const root = path.resolve(__dirname, '../..');
const baseline = process.env.THEME_BASELINE_ROOT;
assert.ok(baseline, 'THEME_BASELINE_ROOT must identify a checkout of the PR base');
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
const blocks = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))].map(match => match[1]);
const copy = html => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
for (const file of ['index.html', 'discord/index.html', 'games/index.html']) {
  const before = read(baseline, file), after = read(root, file);
  const normalize = file === 'games/index.html' ? normalizeGames : value => value;
  assert.equal(copy(normalize(after)), copy(normalize(before)), `${file}: every existing text node is preserved except the exact approved Isaac media placeholder and four verified year additions`);
  assert.deepEqual(blocks(after, 'style'), blocks(before, 'style'), `${file}: inline layout CSS is preserved`);
  const nonTheme = html => blocks(html, 'script').filter(s => s.trim() && !s.includes('localStorage.getItem("tront-theme")'));
  assert.deepEqual(nonTheme(after), nonTheme(before), `${file}: non-theme scripts are preserved`);
}
const gamesBefore = read(baseline, 'games/index.html'), gamesAfter = read(root, 'games/index.html');
const galleryContent = html => normalizeGames(html).slice(html.indexOf('    <input type="radio" name="filter"')).replace(/    <script src="\/assets\/js\/tront-theme.js"><\/script>\n/, '');
assert.equal(galleryContent(gamesAfter), galleryContent(gamesBefore), 'all filters, cards, widgets, other media links, scripts and footer stay byte-identical outside the exact approved Isaac replacement and four verified year additions');
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
assert.deepEqual(afterTree, beforeTree, 'every other gallery media/behavior/shared legacy file stays byte-identical');
console.log(`PASS: all page copy, inline layouts, gallery content and ${beforeTree.size} protected files match the PR base outside the exact reviewed Isaac media addition and four verified year additions.`);
