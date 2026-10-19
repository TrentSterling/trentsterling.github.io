/* Exact media-only substitutions; all historical fixtures and assets stay frozen. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const release = require('./four-game-refresh-20261019.json');
const files = Object.fromEntries([...release.entries.flatMap(entry => entry.media), release.provenance].map(file => [file.path, file]));
const cards = html => [...html.matchAll(/<a\b[^>]*class="item\b[^>]*>[\s\S]*?<\/a>/g)].map(match => match[0]);
const matches = (html, entry) => cards(html).filter(card => card.includes('id="'+entry.previewId+'"') || card.includes('href="'+entry.href+'"'));
function normalizeForPreservation(html, file = 'games/index.html') {
  if (file !== 'games/index.html') return html;
  for (const entry of release.entries) {
    const found = matches(html, entry);
    assert.ok(found.length <= 1, 'at most one exact reviewed refresh card; historical markup stays exact');
    if (!found.length) continue;
    if (entry.slug === 'tinyzombies' && found[0] === require('./tinyzombies-preview.cjs').originalCard) continue;
    assert.ok(found[0] === entry.before || found[0] === entry.after, 'only the exact reviewed refresh card is normalized; historical markup stays exact');
    html = html.replace(entry.after, entry.before);
  }
  return html;
}
function assertCurrent(html) {
  assert.deepEqual(release.entries.map(entry => entry.slug), ['jetgame','hearthwild','crumplecar','tinyzombies'], 'exact four reviewed media sets');
  for (const entry of release.entries) {
    assert.deepEqual(entry.media.map(file => path.extname(file.path)), ['.mp4','.webp']);
    for (const file of entry.media) {
      assert.equal(file.path, 'games/media/'+entry.slug+'-5070-20261019'+path.extname(file.path));
      assert.ok(entry.after.includes('/'+file.path+'?v='+file.sha256.slice(0,12)+'"'), 'exact hash-qualified media');
    }
  }
  for (const entry of release.entries) assert.deepEqual(matches(html, entry), [entry.after], entry.slug+': one exact current media card');
}
function assertReviewedBytes(name, bytes) {
  assert.ok(Object.hasOwn(files, name), 'only exact reviewed refresh media and provenance');
  // Git text checkouts can use CRLF; only this fixed provenance file is canonicalized.
  if (name === release.provenance.path) bytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
  assert.equal(bytes.length, files[name].bytes, name+': reviewed byte count');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), files[name].sha256, name+': exact reviewed content');
}
function assertMedia(root) {
  assertCurrent(fs.readFileSync(path.join(root, 'games/index.html'), 'utf8'));
  for (const [name] of Object.entries(files)) {
    const file = path.join(root, name), bytes = fs.readFileSync(file);
    assertReviewedBytes(name, bytes);
    if (name === release.provenance.path) continue;
    execFileSync('ffmpeg', ['-v','error','-xerror','-nostdin','-i',file,'-f','null','-'], {stdio:'pipe'});
    const probe = JSON.parse(execFileSync('ffprobe', ['-v','error','-count_frames','-show_streams','-show_format','-of','json',file]));
    assert.equal(probe.streams.length, 1, name+': one silent video/image stream');
    const stream = probe.streams[0], video = name.endsWith('.mp4');
    assert.equal(stream.codec_name, video ? 'h264' : 'webp');
    assert.equal(stream.width, video ? 1280 : 640); assert.equal(stream.height, video ? 720 : 360);
    if (video) {
      assert.equal(stream.pix_fmt, 'yuv420p'); assert.equal(stream.avg_frame_rate, '30/1');
      assert.equal(Number(stream.nb_read_frames), 300); assert.equal(Number(probe.format.duration), 10);
      assert.ok(bytes.length < 2000000, 'reviewed 720p refresh stays under 2 MB');
      assert.ok(bytes.indexOf(Buffer.from('moov')) >= 0 && bytes.indexOf(Buffer.from('moov')) < bytes.indexOf(Buffer.from('mdat')), 'faststart');
    }
  }
}
module.exports = {release, files, normalizeForPreservation, assertCurrent, assertReviewedBytes, assertMedia};
