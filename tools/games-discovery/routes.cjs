'use strict';
const assert = require('node:assert/strict');

// Exact reviewed route repairs. Keep every other production byte protected.
const changes = [
  {
    file: 'assets/js/games-discovery.js',
    before: "    'vectorrush', 'hearthwild', 'machinelearning', 'tinyzombies', 'crumplecar',",
    after: "    'vectorrush', 'hearthwild', 'machinelearning', 'games/tiny-zombies', 'crumplecar',"
  },
  {
    file: 'jennsfarm/index.html',
    before: '<a href="play/" class="btn btn-play">Play Now</a>',
    after: '<a href="/farm/" class="btn btn-play">Play Now</a>'
  },
  {
    file: 'jennsfarm/index.html',
    before: '<a href="play/" class="btn btn-play">Play Jenn\'s Farm</a>',
    after: '<a href="/farm/" class="btn btn-play">Play Jenn\'s Farm</a>'
  }
];
function normalize(content, file) {
  for (const change of changes.filter(change => change.file === file)) {
    const count = content.split(change.after).length - 1;
    assert.ok(count <= 1, file + ': duplicate reviewed route');
    if (count) content = content.replace(change.after, change.before);
  }
  return content;
}
module.exports = { changes, normalize };
