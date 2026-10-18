'use strict';
const assert = require('node:assert/strict');
const file = 'games/md/index.html';
// Reverse only these four exact, page-local changes. All other bytes stay guarded.
const changes = [
  {
    "before": "",
    "after": "        /* Keep this six-control navbar readable without changing its visual order. */\n        @media (max-width: 700px) {\n            body.js-active { padding-top: 102px; }\n            #magic-navbar-container { height: 102px; flex-wrap: wrap-reverse; align-content: center; gap: 6px 5px; padding: 8px 6px; }\n            #magic-navbar-container .nav-link { flex: 0 0 auto; justify-content: center; padding: 0 8px; font-size: 12px; line-height: 1.2; white-space: nowrap; }\n            #magic-navbar-container .logo-image { width: 24px; height: 24px; margin-right: 5px; flex: 0 0 auto; }\n            #magic-navbar-container .theme-label { display: inline; }\n            #magic-navbar-container #js-toggle-button-nav { flex-basis: 100%; }\n        }\n        @media (max-width: 360px) {\n            #magic-navbar-container .nav-link { padding-inline: 7px; }\n            #magic-navbar-container .logo-image, #magic-navbar-container .theme-icon { display: none; }\n        }\n\n"
  },
  {
    "before": "white-space:pre-wrap; font-family:monospace;",
    "after": "white-space:pre-wrap; overflow-wrap:anywhere; font-family:monospace;"
  },
  {
    "before": "",
    "after": "    <noscript><style>body { opacity: 1; } #js-toggle-button { display: none; }</style></noscript>\n"
  },
  {
    "before": "",
    "after": "                const visibleToggle = isInterfaceActive\n                    ? document.getElementById('js-toggle-button-nav')\n                    : toggleButton;\n                visibleToggle.focus();\n"
  }
];
const rawSha256 = 'e8df7a7e9c1ff12e37caed2e4e1ea4967ccdf074760d7587bc45229418dae87f';
function rawPortfolio(html) {
  const records = [...html.matchAll(/<pre id="portfolio-data">([\s\S]*?)<\/pre>/g)];
  assert.equal(records.length, 1, 'one unchanged raw portfolio');
  return records[0][1];
}
function normalize(html, target) {
  if (target !== file) return html;
  for (const { before, after } of changes) {
    assert.ok(html.split(after).length <= 2, 'duplicate reviewed portfolio change');
    html = html.replace(after, before);
  }
  return html;
}
function assertFixed(html) {
  for (const { before, after } of changes) {
    assert.equal(html.split(after).length, 2, 'exact reviewed portfolio change');
    if (before) assert.equal(html.includes(before), false, 'no stale declaration');
  }
}
module.exports = { file, changes, rawSha256, rawPortfolio, normalize, assertFixed };
