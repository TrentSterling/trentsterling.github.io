'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const d = require('./dungeongen-preview.cjs');
const recorded = require('./recorded-previews.cjs');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'games/index.html'), 'utf8');
const base = process.env.THEME_BASELINE_ROOT;

test('only card 122 gains the exact reviewed preview; all other page bytes stay unchanged', () => {
  assert.ok(base);
  assert.equal(d.normalize(html), d.normalize(fs.readFileSync(path.join(base, 'games/index.html'), 'utf8')));
  const cards = [...html.matchAll(/<a\b[^>]*class="item\b[^>]*>[\s\S]*?<\/a>/g)].map(m => m[0]);
  assert.equal(cards.length, 128);
  assert.equal(cards[121], d.approvedCard);
  assert.ok(cards[0].includes('Project Demigod'));
  assert.equal((html.match(/ data-preview=/g) || []).length, 99);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'games/media/dungeongen-2013.webp'))).digest('hex'), '4c188ab336d4b3aba9f333878a16fe61c2bab26eba28326dc7da63c49e1ffb08');
});
test('exact card normalization rejects changed copy, date, credit, destination, poster, attributes and duplicates', () => {
  assert.equal(d.normalize(d.approvedCard), d.originalCard);
  assert.equal(d.normalize(d.originalCard), d.originalCard);
  assert.equal(d.normalize(html, 'other.html'), html);
  for (const from of ['(2013)', 'Yuukirus', 'https://github.com/TrentSterling/DungeonGen', 'dungeongen-2013.webp', '15e62358f2e2', 'tag-tool', 'width="640"']) {
    assert.throws(() => d.normalize(d.approvedCard.replace(from, 'changed')), /exact reviewed/);
  }
  assert.throws(() => d.normalize(d.approvedCard + d.originalCard), /exactly one/);
  assert.throws(() => d.normalize(d.approvedCard.replace('DungeonGen', 'Other').replaceAll('dungeongen-2013', 'other')), /exactly one|exact reviewed/);
  assert.notEqual(d.normalize(html.replace(d.approvedCard, '').replace('</main>', d.approvedCard + '</main>')), d.normalize(html));
});
test('recording manifest is an exact additive allowance, anchored to this card', () => {
  const old = JSON.parse(fs.readFileSync(path.join(base, 'tools/game-media/recorded-previews.json'), 'utf8'));
  assert.deepEqual(recorded.previews.filter(p => p.file !== d.file), old.filter(p => p.file !== d.file));
  const item = recorded.previews.find(p => p.file === d.file);
  assert.ok(item.before.includes('href="https://github.com/TrentSterling/DungeonGen"'));
  assert.equal(recorded.normalizeForPreservation(d.approvedCard), d.originalCard);
  assert.throws(() => recorded.normalizeForPreservation(d.approvedCard + d.approvedCard), /exactly one/);
});
test('exact frozen bytes reject corruption and every recorded clip fully decodes within unchanged limits', () => {
  const bytes = fs.readFileSync(path.join(root, d.file)); d.assertReviewedBytes(d.file, bytes);
  assert.throws(() => d.assertReviewedBytes('other.mp4', bytes), /only the reviewed/);
  assert.throws(() => d.assertReviewedBytes(d.file, bytes.subarray(1)), /byte count/);
  const corrupted = Buffer.from(bytes); corrupted[corrupted.length - 1] ^= 1;
  assert.throws(() => d.assertReviewedBytes(d.file, corrupted), /exact reviewed content/);
  recorded.assertMedia(root);
});
test('CI runs dedicated source and browser gates and watches the manifest', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/site-checks.yml'), 'utf8');
  for (const expected of ['tools/game-media/dungeongen*.cjs', 'tools/game-media/recorded-previews.*', 'node --test tools/game-media/dungeongen-preview.test.cjs', 'node tools/game-media/dungeongen-preview-browser.cjs']) assert.ok(workflow.includes(expected));
});
