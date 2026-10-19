/* Authorized Isaac archive addition. All other gallery content/media stays protected. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { assertSource, recovered } = require('../theme-editor/gallery-content.cjs');

// Original user-supplied recording is retained outside the public repository.
// Two chronological cuts at original speed: [0.7, 1.9), [2.5, 6.1).
// Exact half scale 1136x632 -> 568x316, then 4px padding on all sides.
// No crop, stretched geometry, color changes, interpolation or fabricated imagery.
const source = Object.freeze({ filename: '2014-09-03_02-10-32.mp4', bytes: 2319837,
    sha256: '8d993d4838f2c6f7bd42ec0cc1453239551e83389965c1e7da7495f6ee4eefc7',
    width: 1136, height: 632, duration: 7, frames: 140, fps: '20/1' });
const files = Object.freeze({
    'games/media/binding-of-isaac-clone-2014.mp4': { bytes: 325535, sha256: '898704224836c8e1ea4c39048de153acba6ae93586987a8026237d9cab5d6c4b' },
    'games/media/binding-of-isaac-clone-2014.webp': { bytes: 20240, sha256: 'cdb245371a4877dd5d406293428cce52623a2c2cc3a713e3e4e39d8130ae8879' }
});
const originalCard = "<a href=\"javascript:void(0);\" class=\"item tag-prototype\" style=\"--highlight-color: #2ee6d7;\"><div class=\"image-container\"><div class=\"placeholder-content\">Isaac Clone</div></div><div class=\"card-content\"><h3 class=\"card-title\">Binding of Isaac Clone <span>(2014)</span></h3><p class=\"blurb\">Twitch-streamed prototype of a Binding of Isaac-like dungeon crawler with procedural generation.</p><div class=\"tags\"><span class=\"tag\">Prototype</span></div></div></a>";
const approvedCard = "<a href=\"javascript:void(0);\" class=\"item tag-prototype\" style=\"--highlight-color: #2ee6d7;\"><div class=\"image-container\" id=\"preview-binding-of-isaac-clone-2014\" data-preview=\"/games/media/binding-of-isaac-clone-2014.mp4?v=898704224836\"><img class=\"bg-image\" src=\"/games/media/binding-of-isaac-clone-2014.webp?v=cdb245371a48\" alt=\"Binding of Isaac Clone (2014) archive footage\" loading=\"lazy\" decoding=\"async\" width=\"576\" height=\"324\"></div><div class=\"card-content\"><h3 class=\"card-title\">Binding of Isaac Clone <span>(2014)</span></h3><p class=\"blurb\">Twitch-streamed prototype of a Binding of Isaac-like dungeon crawler with procedural generation.</p><div class=\"tags\"><span class=\"tag\">Prototype</span></div></div></a>";
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function normalizeForPreservation(html) {
    const cards = [...html.matchAll(/<a\b[^>]*class="item\b[^>]*>[\s\S]*?<\/a>/g)].map(match => match[0]);
    const isaac = cards.filter(card => card.includes('<h3 class="card-title">Binding of Isaac Clone '));
    assert.equal(isaac.length, 1, 'exactly one Isaac card is present');
    assert.ok(isaac[0] === originalCard || isaac[0] === approvedCard,
        'only the exact reviewed Isaac placeholder-to-media replacement is allowed');
    return html.replace(approvedCard, originalCard);
}
function probe(file) {
    return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }));
}
function decode(file) {
    execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-nostdin', '-i', file, '-f', 'null', '-'], { stdio: 'pipe' });
}
function mp4Atoms(bytes) {
    const atoms = []; let offset = 0;
    while (offset < bytes.length) {
        assert.ok(offset + 8 <= bytes.length, 'complete MP4 atom header');
        let size = bytes.readUInt32BE(offset), header = 8;
        const type = bytes.toString('ascii', offset + 4, offset + 8);
        if (size === 1) { assert.ok(offset + 16 <= bytes.length); size = Number(bytes.readBigUInt64BE(offset + 8)); header = 16; }
        if (size === 0) size = bytes.length - offset;
        assert.ok(Number.isSafeInteger(size) && size >= header && offset + size <= bytes.length, 'valid MP4 atom size');
        atoms.push(type); offset += size;
    }
    return atoms;
}
function assertReviewedBytes(name, bytes) {
    assert.ok(Object.hasOwn(files, name), 'only the two reviewed Isaac files are exempted');
    const expected = files[name];
    assert.equal(bytes.length, expected.bytes, `${name}: reviewed byte count`);
    assert.equal(digest(bytes), expected.sha256, `${name}: exact reviewed content`);
}
function assertMedia(root) {
    const html = require('./six-game-refresh.cjs').normalizeForPreservation(fs.readFileSync(path.join(root, 'games/index.html'), 'utf8'));
    normalizeForPreservation(html);
    assert.ok(html.includes(approvedCard), 'the approved Isaac preview is integrated');
    assertSource(html); // Frozen card-content contract plus the independently reviewed year overlay.
    assert.equal((html.match(/data-preview=/g) || []).length, 94 + require('./recorded-previews.json').length, 'existing previews plus exact reviewed recordings');
    assert.equal((html.match(/<img[^>]*class="bg-image"/g) || []).length, 116 + recovered.cards.length, 'fallback posters include all retained recovered cards');
    for (const [name, expected] of Object.entries(files)) {
        const bytes = fs.readFileSync(path.join(root, name));
        assertReviewedBytes(name, bytes);
        assert.ok(html.includes(`/${name}?v=${expected.sha256.slice(0, 12)}`), `${name}: matching content-version URL`);
        decode(path.join(root, name));
    }
    const videoName = Object.keys(files)[0], video = probe(path.join(root, videoName));
    assert.equal(video.streams.length, 1, 'silent single-stream video');
    const stream = video.streams[0];
    assert.equal(stream.codec_type, 'video'); assert.equal(stream.codec_name, 'h264');
    assert.equal(stream.pix_fmt, 'yuv420p'); assert.equal(stream.width, 576); assert.equal(stream.height, 324);
    assert.equal(stream.sample_aspect_ratio, '1:1'); assert.equal(stream.display_aspect_ratio, '16:9');
    assert.equal(stream.avg_frame_rate, '20/1'); assert.equal(Number(stream.nb_read_frames), 96);
    assert.equal(Number(video.format.duration), 4.8);
    assert.ok(Number(video.format.duration) <= 4.833333 && stream.width <= 640 && Number(video.format.size) < 1000000);
    const atoms = mp4Atoms(fs.readFileSync(path.join(root, videoName)));
    assert.ok(atoms.includes('moov') && atoms.includes('mdat') && atoms.indexOf('moov') < atoms.indexOf('mdat'), 'MP4 faststart');
    const poster = probe(path.join(root, Object.keys(files)[1]));
    assert.equal(poster.streams.length, 1); assert.equal(poster.streams[0].codec_name, 'webp');
    assert.equal(poster.streams[0].width, 576); assert.equal(poster.streams[0].height, 324);
    console.log('PASS: exact Isaac source-derived media, full decode, silent H.264/yuv420p, faststart, 4.8 seconds/96 frames/20fps, 576x324, reviewed preview count and fallback posters.');
}
function assertOriginal(file) {
    const bytes = fs.readFileSync(file); assert.equal(bytes.length, source.bytes); assert.equal(digest(bytes), source.sha256);
    decode(file); const original = probe(file), stream = original.streams.find(s => s.codec_type === 'video');
    assert.equal(stream.width, source.width); assert.equal(stream.height, source.height);
    assert.equal(stream.avg_frame_rate, source.fps); assert.equal(Number(stream.nb_read_frames), source.frames);
    assert.equal(Number(original.format.duration), source.duration);
    console.log('PASS: original archival source identity, complete decode, dimensions, duration and native frame cadence.');
}
if (require.main === module) {
    assertMedia(path.resolve(__dirname, '../..'));
    if (process.argv[2]) assertOriginal(path.resolve(process.argv[2]));
}
module.exports = { source, files, originalCard, approvedCard, digest, normalizeForPreservation, assertReviewedBytes, assertMedia, assertOriginal, mp4Atoms };
