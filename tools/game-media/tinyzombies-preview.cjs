/* Exact reviewed gallery addition; no production runtime. */
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const file = 'games/media/tiny-zombies-2026.mp4';
const sha256 = '92b08b1effb89154218c0ee91b291b904da4bee5020dd6e3c53144d0a6b1a932';
const originalCard = "<a id=\"card-tiny-zombies-2026\" href=\"https://tront.xyz/tinyzombies/\" target=\"_blank\" rel=\"noopener\" class=\"item tag-game tag-prototype\" style=\"--highlight-color: #6af0bd;\"><div class=\"image-container\"><img class=\"bg-image\" src=\"/games/media/tiny-zombies-2026.png?v=e7ea5b211d4b\" alt=\"Tiny Zombies: No One Left (2026) voxel horde gameplay\" loading=\"lazy\" decoding=\"async\" width=\"640\" height=\"360\"></div><div class=\"card-content\"><h3 class=\"card-title\">Tiny Zombies: No One Left <span>(2026)</span></h3><p class=\"blurb\">A WebGPU voxel zombie shooter with a tiny squad, destructible walls, flying debris, and a quiet centered HUD. Desktop WebGPU browser required.</p><div class=\"tags\"><span class=\"tag\">Game</span><span class=\"tag\">Prototype</span></div></div></a>";
const approvedCard = "<a id=\"card-tiny-zombies-2026\" href=\"https://tront.xyz/tinyzombies/\" target=\"_blank\" rel=\"noopener\" class=\"item tag-game tag-prototype\" style=\"--highlight-color: #6af0bd;\"><div class=\"image-container\" id=\"preview-tiny-zombies-2026\" data-preview=\"/games/media/tiny-zombies-2026.mp4?v=92b08b1effb8\"><img class=\"bg-image\" src=\"/games/media/tiny-zombies-2026.png?v=e7ea5b211d4b\" alt=\"Tiny Zombies: No One Left (2026) voxel horde gameplay\" loading=\"lazy\" decoding=\"async\" width=\"640\" height=\"360\"></div><div class=\"card-content\"><h3 class=\"card-title\">Tiny Zombies: No One Left <span>(2026)</span></h3><p class=\"blurb\">A WebGPU voxel zombie shooter with a tiny squad, destructible walls, flying debris, and a quiet centered HUD. Desktop WebGPU browser required.</p><div class=\"tags\"><span class=\"tag\">Game</span><span class=\"tag\">Prototype</span></div></div></a>";
function normalize(html, name = 'games/index.html') {
  if (name !== 'games/index.html') return html;
  const targets = [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].filter(m => m[0].includes('card-tiny-zombies-2026') || m[0].includes('tiny-zombies-2026'));
  assert.equal(targets.length, 1, 'exactly one Tiny Zombies card');
  assert.ok([originalCard, approvedCard].includes(targets[0][0]), 'exact reviewed Tiny Zombies card');
  return html.replace(approvedCard, originalCard);
}
function assertReviewedBytes(name, bytes) {
  assert.equal(name, file, 'only the reviewed Tiny Zombies clip');
  assert.equal(bytes.length, 816270, 'reviewed byte count');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), sha256, 'exact reviewed content');
}
module.exports = { file, sha256, originalCard, approvedCard, normalize, assertReviewedBytes };
