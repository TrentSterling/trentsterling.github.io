'use strict';
const assert = require('node:assert/strict');
const file = 'device-history/index.html';
const block = "        /* Device History: retain readable primary labels on narrow screens. */\n        @media (max-width: 600px) {\n            #magic-navbar-container { gap: 5px; padding: 0 8px; }\n            #magic-navbar-container .nav-link { flex: 0 0 auto; justify-content: center; padding: 0 9px; font-size: 12px; line-height: 1.2; white-space: nowrap; }\n            #magic-navbar-container .home-link { padding-left: 5px; }\n            #magic-navbar-container .logo-image { width: 24px; height: 24px; margin-right: 5px; flex: 0 0 auto; }\n            #magic-navbar-container .theme-label { display: inline; }\n        }\n        @media (max-width: 360px) {\n            #magic-navbar-container .nav-link { padding-inline: 7px; }\n            #magic-navbar-container .logo-image, #magic-navbar-container .theme-icon { display: none; }\n        }\n\n";
const before = '<div class="install-options" style="grid-template-columns:1fr 1fr;">';
const after = '<div class="install-options">';
function normalize(html, target) {
  if (target !== file) return html;
  assert.ok(html.split(block).length <= 2, 'duplicate reviewed responsive block');
  assert.ok(html.split(after).length <= 2, 'duplicate reviewed install container');
  return html.replace(block, '').replace(after, before);
}
function assertResponsive(html) {
  assert.equal(html.split(block).length, 2, 'exact page-local responsive block');
  assert.equal(html.split(after).length, 2, 'native mobile install rule is not overridden');
  assert.equal(html.includes(before), false);
}
module.exports = { file, block, before, after, normalize, assertResponsive };
