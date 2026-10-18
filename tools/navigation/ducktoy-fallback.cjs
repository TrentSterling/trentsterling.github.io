'use strict';
const assert = require('node:assert/strict');
const file = 'ducktoy/index.html';
const rule = '    <noscript><style>#tront-theme-btn { display: none; }</style></noscript>\n';
function normalize(html, target) {
  if (target !== file) return html;
  assert.ok(html.split(rule).length <= 2, 'no duplicate DuckToy fallback rule');
  return html.replace(rule, '');
}
function assertFixed(html) {
  assert.equal(html.split(rule).length, 2, 'one exact DuckToy fallback rule');
  assert.ok(html.indexOf(rule) < html.indexOf('</head>'), 'fallback remains head-only');
}
module.exports = { file, rule, normalize, assertFixed };
