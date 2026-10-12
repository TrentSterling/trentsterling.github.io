/* PR regression boundary: compare with the separately checked-out base commit. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const baseline = process.env.THEME_BASELINE_ROOT;
assert.ok(baseline, 'THEME_BASELINE_ROOT must identify a checkout of the PR base');
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
const blocks = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))].map(match => match[1]);
const copy = html => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
for (const file of ['index.html', 'discord/index.html', 'games/index.html']) {
  const before = read(baseline, file), after = read(root, file);
  assert.equal(copy(after), copy(before), `${file}: every existing text node is preserved`);
  assert.deepEqual(blocks(after, 'style'), blocks(before, 'style'), `${file}: inline layout CSS is preserved`);
  const nonTheme = html => blocks(html, 'script').filter(s => s.trim() && !s.includes('localStorage.getItem("tront-theme")'));
  assert.deepEqual(nonTheme(after), nonTheme(before), `${file}: non-theme scripts are preserved`);
}
const gamesBefore = read(baseline, 'games/index.html'), gamesAfter = read(root, 'games/index.html');
const galleryContent = html => html.slice(html.indexOf('    <input type="radio" name="filter"')).replace(/    <script src="\/assets\/js\/tront-theme.js"><\/script>\n/, '');
assert.equal(galleryContent(gamesAfter), galleryContent(gamesBefore), 'all filters, cards, widgets, media links, scripts and footer stay byte-identical');
const tree = dir => new Map(execFileSync('git', ['-C', dir, 'ls-tree', '-r', '--full-tree', 'HEAD', '--', 'games', 'assets/css/tront-themes.css', 'assets/js/tront-theme.js', 'assets/js/tront-system.js'], { encoding: 'utf8' }).trim().split('\n').map(line => { const [meta, file] = line.split('\t'); return [file, meta.split(' ')[2]]; }));
const beforeTree = tree(baseline), afterTree = tree(root);
beforeTree.delete('games/index.html'); afterTree.delete('games/index.html');
assert.deepEqual(afterTree, beforeTree, 'every gallery media/behavior/shared legacy file stays byte-identical');
console.log(`PASS: all page copy, inline layouts, gallery content and ${beforeTree.size} protected files match the PR base.`);
