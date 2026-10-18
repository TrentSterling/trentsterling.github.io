/* Exact reviewed gallery addition; no production runtime. */
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const file = 'games/media/dungeongen-2013.mp4';
const sha256 = '15e62358f2e2586bffeb1267f6df53c693522ba319f7579498f927807bec9f17';
const originalCard = "<a href=\"https://github.com/TrentSterling/DungeonGen\" target=\"_blank\" class=\"item tag-tool\" style=\"--highlight-color: #F23F43;\"><div class=\"image-container\"><img class=\"bg-image\" src=\"/games/media/dungeongen-2013.webp?v=4c188ab336d4\" alt=\"DungeonGen\" loading=\"lazy\" decoding=\"async\" width=\"640\" height=\"360\"></div><div class=\"card-content\"><h3 class=\"card-title\">DungeonGen <span>(2013)</span></h3><p class=\"blurb\">A procedural dungeon generator built with three.js. Voxel tileset art by Yuukirus.</p><div class=\"tags\"><span class=\"tag\">Tool</span></div></div></a>";
const approvedCard = "<a href=\"https://github.com/TrentSterling/DungeonGen\" target=\"_blank\" class=\"item tag-tool\" style=\"--highlight-color: #F23F43;\"><div class=\"image-container\" id=\"preview-dungeongen-2013\" data-preview=\"/games/media/dungeongen-2013.mp4?v=15e62358f2e2\"><img class=\"bg-image\" src=\"/games/media/dungeongen-2013.webp?v=4c188ab336d4\" alt=\"DungeonGen\" loading=\"lazy\" decoding=\"async\" width=\"640\" height=\"360\"></div><div class=\"card-content\"><h3 class=\"card-title\">DungeonGen <span>(2013)</span></h3><p class=\"blurb\">A procedural dungeon generator built with three.js. Voxel tileset art by Yuukirus.</p><div class=\"tags\"><span class=\"tag\">Tool</span></div></div></a>";
function normalize(html, name = 'games/index.html') {
  if (name !== 'games/index.html') return html;
  const targets = [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].filter(m => m[0].includes('DungeonGen') || m[0].includes('dungeongen-2013'));
  assert.equal(targets.length, 1, 'exactly one DungeonGen card');
  assert.ok([originalCard, approvedCard].includes(targets[0][0]), 'exact reviewed DungeonGen card');
  return html.replace(approvedCard, originalCard);
}
function assertReviewedBytes(name, bytes) {
  assert.equal(name, file, 'only the reviewed DungeonGen clip');
  assert.equal(bytes.length, 804783, 'reviewed byte count');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), sha256, 'exact reviewed content');
}
module.exports = { file, sha256, originalCard, approvedCard, normalize, assertReviewedBytes };
