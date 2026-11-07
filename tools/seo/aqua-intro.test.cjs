const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, 'aqua-empire', name), 'utf8');

test('Aqua keeps the approved 2.5.2 standalone runtime byte for byte', () => {
  const data = fs.readFileSync(path.join(root, 'aqua-empire/game.html'));
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),
    'a5a38c639b2c7f4b9a31228159104fa30d4a70a54439b04f1c6ccc5bc0628755');
});

test('Aqua landing and runtime retain the same existing metadata', () => {
  const metadata = text => text.match(/<(?:meta|title|link)[^>]*(?:>[^<]*<\/title>|>)/g)
    .filter(tag => !tag.includes('rel="stylesheet"'));
  assert.deepEqual(metadata(read('index.html')), metadata(read('game.html')));
  assert(!read('index.html').includes('noindex'));
});

test('Aqua introduction stays readable and lightweight without starting the renderer', () => {
  const html = read('index.html');
  assert(html.includes('<main') && html.includes('<h1') && html.includes('<noscript>'));
  assert(html.includes('width="1280" height="800" alt="Coral Cove'));
  assert(!html.includes('<iframe') && !html.includes('<canvas'));
  assert(Buffer.byteLength(html) < 10000);
  const js = read('intro.js');
  assert(!/\.focus\s*\(/.test(js));
  assert(!/https?:\/\//.test(js), 'No new external services');
});
