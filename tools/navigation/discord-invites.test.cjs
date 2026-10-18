'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { invite, landing, changes, normalize, assertDestinations } = require('./discord-invites.cjs');
const html = fs.readFileSync(path.resolve(__dirname, '../../discord/index.html'), 'utf8');
test('both static Join CTAs and widget failure fallback retain the original public invite', () => {
  assertDestinations(html);
  assert.notEqual(invite, landing);
  assert.equal(new URL(invite).hostname, 'discord.gg');
});
test('invite contract rejects each self-loop and any unreviewed invite replacement', () => {
  for (const change of changes) {
    assert.throws(() => assertDestinations(html.replace(change.after, change.before)));
    assert.throws(() => assertDestinations(html.replace(change.after, change.after.replace(invite, 'https://discord.gg/unreviewed'))));
  }
});
test('exact invite normalization never changes navigation or masks other content', () => {
  const plain = normalize(html, 'discord/index.html');
  assert.equal(normalize(html + 'changed', 'discord/index.html'), plain + 'changed');
  assert.equal(normalize(html, 'unrelated.html'), html);
  for (const change of changes) {
    assert.ok(plain.includes(change.before));
    assert.notEqual(normalize(html.replace(change.after, change.after.replace(invite, 'https://discord.gg/unreviewed')), 'discord/index.html'), plain);
    assert.throws(() => normalize(html + change.after, 'discord/index.html'), /duplicate/);
  }
  assert.ok(plain.includes('<a href="/discord/" class="nav-link active" aria-current="page">Discord</a>'));
});
