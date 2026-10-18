'use strict';
const assert = require('node:assert/strict');
const invite = 'https://discord.gg/0hyoWZyM6y7kkFCN';
const landing = 'https://tront.xyz/discord/';
// These three exact existing destinations were changed to self-links in
// 6113180d2fe9b095496ed2a693fe34984381f3ba. Restore their original public invite.
const tails = [
  ' class="cta-button" target="_blank" rel="noopener noreferrer">Join the Discord</a>',
  ' class="cta-button" style="margin: 0 0 2rem 0;" target="_blank" rel="noopener noreferrer">Join the Discord</a>',
  ' target="_blank" rel="noopener noreferrer">join directly</a>'
];
const changes = tails.map(tail => ({ before: '<a href="' + landing + '"' + tail, after: '<a href="' + invite + '"' + tail }));
function normalize(html, file) {
  if (file !== 'discord/index.html') return html;
  for (const change of changes) {
    assert.ok(html.split(change.after).length <= 2, 'duplicate reviewed invite anchor');
    html = html.replace(change.after, change.before);
  }
  return html;
}
function assertDestinations(html) {
  for (const change of changes) {
    assert.equal(html.split(change.after).length, 2, 'one exact intended invite anchor');
    assert.equal(html.includes(change.before), false, 'Join action must never loop to the landing page');
  }
  assert.ok(html.includes('<a href="/discord/" class="nav-link active" aria-current="page">Discord</a>'), 'navigation still targets the landing page');
  assert.equal(html.match(/<link rel="canonical" href="([^"]+)"/)[1], landing, 'canonical remains the landing page');
}
module.exports = { invite, landing, changes, normalize, assertDestinations };
