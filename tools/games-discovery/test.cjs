'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { browserPaths, multiplayerTitles, normalize, browserProject, matches } = require('../../assets/js/games-discovery.js');
const { readCards } = require('../theme-editor/gallery-content.cjs');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const cards = readCards(read('games/index.html'));

test('all 128 cards, category classes, personal copy, links and media remain byte-identical', () => {
  const base = process.env.THEME_BASELINE_ROOT;
  assert.ok(base, 'THEME_BASELINE_ROOT must identify the PR base');
  const before = fs.readFileSync(path.join(base, 'games/index.html'), 'utf8');
  assert.equal(cards.length, 128);
  assert.deepEqual(cards, readCards(before));
  const grid = html => html.match(/<main class="grid">[\s\S]*?<\/main>/)[0];
  assert.equal(grid(read('games/index.html')), grid(before));
  assert.match(cards[0].titleText, /^Project Demigod/);
  for (const file of ['games/index.html', 'index.html']) {
    const nav = html => html.match(/<nav id="magic-navbar-container"[\s\S]*?<\/nav>/)[0];
    assert.equal(nav(read(file)), nav(fs.readFileSync(path.join(base, file), 'utf8')));
  }
  for (const file of ['sitemap.xml', 'sitemap-pages.xml']) assert.equal(read(file), fs.readFileSync(path.join(base, file), 'utf8'));
});
test('browser capability is an explicit list with one current card per route', () => {
  assert.equal(browserPaths.size, 64);
  const browserCards = cards.filter(c => browserProject(c.href));
  assert.equal(browserCards.length, browserPaths.size);
  for (const slug of browserPaths) assert.equal(browserCards.filter(c => new URL(c.href, 'https://tront.xyz').pathname.replace(/^\/|\/$/g, '') === slug).length, 1, slug);
  for (const href of ['/ducktoy/', '/speedslap/', '/audiobounce/', '/powershellmanager/', '/device-history/', '/spaceview/', '/tronteq/', '/ytdl/', '/blog/posts/magic-archer/', 'https://example.com/craftmine/', 'javascript:void(0);']) assert.equal(browserProject(href), false, href);
});
test('multiplayer claims have explicit evidence in the unchanged descriptions', () => {
  for (const title of multiplayerTitles) {
    const card = cards.find(c => c.titleText.replace(/\s*\([^)]*\)\s*$/, '') === title);
    assert.ok(card, title);
    assert.match(card.blurbText, /multiplayer|co-op|shared jewel board|everyone draws and rides|hot-seat|shared WebRTC room/i, title);
  }
  assert.equal(multiplayerTitles.has('VibePong'), false, 'CPU vs CPU is not multiplayer');
});
test('word order, accents, punctuation, case and whitespace normalize safely', () => {
  assert.equal(normalize("  JENN’S Café: LAST_RUN  "), 'jenns cafe last run');
  const record = { text: normalize('Gems Together 2026 shared jewel board'), categories: ['game'], browser: true, multiplayer: true };
  const state = { query: 'BOARD gems', category: 'all', browser: false, multiplayer: false };
  assert.equal(matches(record, state), true);
  assert.equal(matches(record, { ...state, browser: true, multiplayer: true, category: 'game' }), true);
  assert.equal(matches(record, { ...state, category: 'tool' }), false);
  assert.equal(matches(record, { ...state, query: 'gems missing' }), false);
  assert.equal(matches(record, { ...state, query: '   ' }), true);
  assert.equal(matches({ ...record, browser: false }, { ...state, browser: true }), false);
  assert.equal(matches({ ...record, multiplayer: false }, { ...state, multiplayer: true }), false);
});
test('homepage catalog and itch destinations are separate and unlisted work stays unlisted', () => {
  assert.ok(read('index.html').includes('<a class="game" href="/games/">View All My Games</a>'));
  assert.ok(read('index.html').includes('<a class="game" href="https://trent.itch.io/" target="_blank" rel="noopener">My itch.io Games</a>'));
  assert.ok(!read('index.html').includes('View All My Games on itch.io'));
  for (const file of ['index.html', 'games/index.html', 'sitemap.xml', 'sitemap-pages.xml', 'assets/js/games-discovery.js']) assert.doesNotMatch(read(file), /robot[ -]?life/i, file);
});
test('light/custom palette allowance is exact and never hides unrelated edits', () => {
  const palette = require('./palette.cjs');
  const css = read('assets/css/games-discovery.css');
  assert.equal(css.split(palette.addition).length, 2);
  assert.equal(palette.normalize(css + 'changed'), palette.normalize(css) + 'changed');
  assert.notEqual(palette.normalize(css.replace('#1d1d1f', '#eeeeee')), palette.normalize(css));
});
