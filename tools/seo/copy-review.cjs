'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const reviewed = require('./copy-review.json');
const hash = value => createHash('sha256').update(value).digest('hex');
// Reverse only complete, hash-pinned reviewed versions. Other edits remain visible to
// the existing preservation checks, including changes beside an allowed phrase.
function normalize(html, file) {
  const entry = reviewed[file];
  if (!entry) return html;
  const digest = hash(html);
  const replacementCount = digest === entry.afterSha256 ? entry.replacements.length
    : entry.previousVersions?.find(version => version.afterSha256 === digest)?.replacementCount;
  if (replacementCount === undefined) return html;
  for (const { before, after, count } of entry.replacements.slice(0, replacementCount).reverse()) {
    assert.equal(html.split(after).length - 1, count, file + ': unique reviewed copy');
    html = html.split(after).join(before);
  }
  assert.equal(hash(html), entry.beforeSha256, file + ': exact released baseline');
  return html;
}
module.exports = { reviewed, hash, normalize };
