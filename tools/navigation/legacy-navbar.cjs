'use strict';
const assert = require('node:assert/strict');
const snapscanGrid = require('./snapscan-grid.cjs');
// Exact page-local Device History geometry with 6px outer padding for wider labels.
// This helper is test-only; production keeps native static links and its theme cycle.
const files = ["runtimecsg/index.html", "toaster/index.html", "notesdash/index.html", "snapscan/index.html", "megabunk/index.html", "trontcloud/index.html"];
const navigation = Object.fromEntries(files.map(file => [file, {
  labels: ['Discord', 'Blog', 'Games', ['megabunk/index.html', 'trontcloud/index.html'].includes(file) ? 'Tront' : 'Home'],
  hrefs: ['/discord/', '/blog/', '/games/', '/'].map(href => file === 'megabunk/index.html' ? 'https://tront.xyz' + href : href)
}]));
const block = "        /* Retain readable primary labels on narrow screens. */\n        @media (max-width: 600px) {\n            #magic-navbar-container { gap: 5px; padding: 0 6px; }\n            #magic-navbar-container .nav-link { flex: 0 0 auto; justify-content: center; padding: 0 9px; font-size: 12px; line-height: 1.2; white-space: nowrap; }\n            #magic-navbar-container .home-link { padding-left: 5px; }\n            #magic-navbar-container .logo-image { width: 24px; height: 24px; margin-right: 5px; flex: 0 0 auto; }\n            #magic-navbar-container .theme-label { display: inline; }\n        }\n        @media (max-width: 360px) {\n            #magic-navbar-container .nav-link { padding-inline: 7px; }\n            #magic-navbar-container .logo-image, #magic-navbar-container .theme-icon { display: none; }\n        }\n\n";
const buttonBefore = "<button id=\"tront-theme-btn\" class=\"nav-link\">";
const buttonAfter = "<button id=\"tront-theme-btn\" class=\"nav-link\" aria-label=\"Cycle color theme\">";
function normalize(html, file) {
  if (!files.includes(file)) return html;
  assert.ok(html.split(block).length <= 2, 'duplicate reviewed legacy navbar block');
  assert.ok(html.split(buttonAfter).length <= 2, 'duplicate reviewed cycle button');
  return snapscanGrid.normalize(html.replace(block, '').replace(buttonAfter, buttonBefore), file);
}
function assertResponsive(html) {
  assert.equal(html.split(block).length, 2, 'one exact page-local responsive block');
  assert.equal(html.split(buttonAfter).length, 2, 'one explicitly named theme-cycle button');
  assert.equal(html.includes(buttonBefore), false, 'no unnamed duplicate cycle button');
}
module.exports = { files, navigation, block, buttonBefore, buttonAfter, normalize, assertResponsive };
