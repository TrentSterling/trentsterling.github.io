'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { reviewed, hash, normalize } = require('./copy-review.cjs');
for (const [file, entry] of Object.entries(reviewed)) test(file + ': copy exception is exact and rejects unrelated edits', () => {
  const current = fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');
  assert.equal(hash(current), entry.afterSha256);
  assert.equal(hash(normalize(current, file)), entry.beforeSha256);
  for (const changed of [current + '<p>Extra copy</p>', current.replace('Trent Sterling', 'Someone Else'), current.replace('https://tront.xyz/', 'https://example.com/'), current.replace('<style>', '<style>body{display:none}')]) {
    assert.notEqual(hash(changed), entry.afterSha256);
    assert.equal(normalize(changed, file), changed);
  }
  assert.equal(normalize(current, 'unrelated.html'), current);
  for (const version of entry.previousVersions || []) {
    let previous = current;
    for (const { before, after } of entry.replacements.slice(version.replacementCount).reverse()) {
      previous = previous.split(after).join(before);
    }
    assert.equal(hash(previous), version.afterSha256);
    assert.equal(hash(normalize(previous, file)), entry.beforeSha256);
    assert.equal(normalize(previous + '<p>Extra copy</p>', file), previous + '<p>Extra copy</p>');
  }
});
