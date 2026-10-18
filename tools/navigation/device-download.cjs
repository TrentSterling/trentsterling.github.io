'use strict';
const assert = require('node:assert/strict');
const file = 'device-history/index.html';
const release = require('./device-release.json');
const url = release.asset.browser_download_url;
const changes = [
  {
    "before": "<a href=\"https://github.com/TrentSterling/device-history/releases/download/v0.8.3/device-history.exe\" class=\"btn btn-primary\" style=\"background:rgba(168,85,247,0.15);border-color:rgba(168,85,247,0.4);color:#d4b0ff;font-size:1.05rem;\">&#11015; Download Portable .exe</a>",
    "after": "<a href=\"https://github.com/TrentSterling/device-history/releases/download/v0.8.0/device-history.exe\" class=\"btn btn-primary\" style=\"background:rgba(168,85,247,0.15);border-color:rgba(168,85,247,0.4);color:#d4b0ff;font-size:1.05rem;\">&#11015; Download v0.8.0 Portable .exe</a>"
  },
  {
    "before": "<a href=\"https://github.com/TrentSterling/device-history/releases/download/v0.8.3/device-history.exe\" class=\"btn btn-primary\" style=\"display:block;text-align:center;background:rgba(168,85,247,0.1);border-color:rgba(168,85,247,0.3);color:#d4b0ff;margin-bottom:4px;\">&#11015; Portable .exe (~7 MB)</a>",
    "after": "<a href=\"https://github.com/TrentSterling/device-history/releases/download/v0.8.0/device-history.exe\" class=\"btn btn-primary\" style=\"display:block;text-align:center;background:rgba(168,85,247,0.1);border-color:rgba(168,85,247,0.3);color:#d4b0ff;margin-bottom:4px;\">&#11015; Portable .exe v0.8.0 (~7 MB)</a>"
  }
];
function normalize(html, target) {
  if (target !== file) return html;
  for (const change of changes) {
    assert.ok(html.split(change.after).length <= 2, 'duplicate reviewed Device History download');
    html = html.replace(change.after, change.before);
  }
  return html;
}
function assertDownloads(html) {
  assert.equal(release.tag_name, 'v0.8.0'); assert.equal(release.draft, false); assert.equal(release.prerelease, false);
  assert.equal(release.asset.state, 'uploaded'); assert.equal(release.asset.name, 'device-history.exe');
  assert.equal(release.asset.size, 6441472);
  for (const change of changes) {
    assert.equal(html.split(change.after).length, 2, 'exact verified release URL and explicit binary version');
    assert.equal(html.includes(change.before), false, 'no unpublished 0.8.3 download');
  }
  assert.equal((html.match(/releases\/download\/v0\.8\.0\/device-history\.exe/g) || []).length, 2);
  assert.ok(html.includes('<span class="version-tag">v0.8.3 - Tauri v2 + Svelte 5 rewrite</span>'), 'source version retained');
  assert.ok(html.includes('alt="Device History v0.8.3 - Monitor tab with live device tracking"'), 'original screenshot description retained');
}
module.exports = { file, url, changes, release, normalize, assertDownloads };
