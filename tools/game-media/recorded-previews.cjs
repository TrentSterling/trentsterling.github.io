/* Exact additions of recorded gameplay; never normalize posters, copy or ordering. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const previews = require('./recorded-previews.json');
function normalizeForPreservation(html) {
  for (const item of previews) {
    if (!html.includes(item.before)) continue;
    assert.equal(html.split(item.before).length - 1, 1, 'exactly one target container');
    assert.ok(html.includes(item.before + '>') || html.includes(item.after + '>'), 'only reviewed preview attribute allowed');
    html = html.replace(item.after, item.before);
  }
  return html;
}
function assertMedia(root) {
  const html = fs.readFileSync(path.join(root, 'games/index.html'), 'utf8');
  normalizeForPreservation(html);
  for (const item of previews) {
    assert.ok(html.includes(item.after + '>'), 'reviewed preview is attached');
    const file = path.join(root, item.file), bytes = fs.readFileSync(file);
    assert.equal(bytes.length, item.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), item.sha256);
    assert.ok(bytes.indexOf(Buffer.from('moov')) < bytes.indexOf(Buffer.from('mdat')), 'faststart');
    execFileSync('ffmpeg', ['-v','error','-xerror','-nostdin','-i',file,'-f','null','-']);
    const probe = JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file]));
    assert.equal(probe.streams.length, 1);
    const stream = probe.streams[0];
    assert.equal(stream.codec_name, 'h264'); assert.equal(stream.pix_fmt, 'yuv420p');
    assert.equal(stream.width, 640); assert.equal(stream.height, 360);
    assert.equal(stream.avg_frame_rate, '25/1');
    assert.equal(Number(stream.nb_read_frames), item.frames);
    assert.equal(Number(probe.format.duration), item.duration);
    assert.ok(bytes.length < 1000000, 'small gallery preview');
  }
}
module.exports = {previews, normalizeForPreservation, assertMedia};
