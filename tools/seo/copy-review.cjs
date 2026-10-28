'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const reviewed = require('./copy-review.json');
const hash = value => createHash('sha256').update(value).digest('hex');
// Reverse only the complete, reviewed candidate. Other edits remain visible to
// the existing preservation checks, including changes beside an allowed phrase.
function normalize(html, file) {
  const entry = reviewed[file];
  if (!entry || hash(html) !== entry.afterSha256) return html;
  for (const { before, after, count } of [...entry.replacements].reverse()) {
    assert.equal(html.split(after).length - 1, count, file + ': unique reviewed copy');
    html = html.split(after).join(before);
  }
  assert.equal(hash(html), entry.beforeSha256, file + ': exact released baseline');
  return html;
}
module.exports = { reviewed, hash, normalize };
