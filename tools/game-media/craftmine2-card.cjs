/* Exact additive permission boundary: the original 117 cards remain frozen. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const approvedCard = "<a href=\"https://tront.xyz/craftmine2/\" target=\"_blank\" rel=\"noopener\" class=\"item tag-game\" style=\"--highlight-color: #70bdd0;\"><div class=\"image-container\" id=\"preview-craftmine2-2026\" data-preview=\"/games/media/craftmine2-2026.mp4?v=e8e901625625\"><img class=\"bg-image\" src=\"/games/media/craftmine2-2026.webp?v=8ef0e86dbb3e\" alt=\"CraftMine 2 (2026) waterfall and rocket gameplay\" loading=\"lazy\" decoding=\"async\" width=\"640\" height=\"360\"></div><div class=\"card-content\"><h3 class=\"card-title\">CraftMine 2 <span>(2026)</span></h3><p class=\"blurb\">A new browser voxel sandbox with shimmering water, sunlit cliffs, and terrain you can blast apart. Explore the valley, build something, or reach for the rocket launcher.</p><div class=\"tags\"><span class=\"tag\">Game</span></div></div></a>";
const expectedCard = Object.freeze({"href":"https://tront.xyz/craftmine2/","classes":["item","tag-game"],"titleHtml":"CraftMine 2 <span>(2026)</span>","titleText":"CraftMine 2 (2026)","yearSpans":["(2026)"],"blurbHtml":"A new browser voxel sandbox with shimmering water, sunlit cliffs, and terrain you can blast apart. Explore the valley, build something, or reach for the rocket launcher.","blurbText":"A new browser voxel sandbox with shimmering water, sunlit cliffs, and terrain you can blast apart. Explore the valley, build something, or reach for the rocket launcher.","tagsHtml":"<span class=\"tag\">Game</span>","tags":["Game"]});
// Live deployed CraftMine 2 capture, 2026-10-14. Two original-speed cuts:
// waterfall [3.0,4.5), rocket [0.82,4.12). No overlays, generated frames, or speedup.
// Live deployed CraftMine 2 capture, 2026-10-14. Two original-speed cuts:
// waterfall [3.0,4.5), rocket [0.82,4.12). No overlays, generated frames, or speedup.
const files = Object.freeze({
  "games/media/craftmine2-2026.mp4": {
    "bytes": 204542,
    "sha256": "e8e901625625fb3d0d5289a754470408e98b8c8be323496c79b516a59dcadc0b"
  },
  "games/media/craftmine2-2026.webp": {
    "bytes": 33280,
    "sha256": "8ef0e86dbb3e11265e8e8ca8d5680b4d3efcc81663d1cc6ab7edee1a93563fdc"
  },
  "games/og-image.png": {
    "bytes": 462805,
    "sha256": "af2d3e10d1dda4255f4aa4ae136b6f65d47201865a9214613907463a57bb6e9c",
    "previousSha256": "a1678256fc046ca83e502c84212b144ee8c7dca75db6ee9898a040c544836bdf"
  },
  "games/og-image-af2d3e10d1dd.png": {
    "bytes": 462805,
    "sha256": "af2d3e10d1dda4255f4aa4ae136b6f65d47201865a9214613907463a57bb6e9c"
  }
});
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function normalizeForPreservation(html) {
    const cards = [...html.matchAll(/<a\b[^>]*class="item\b[^>]*>[\s\S]*?<\/a>/g)].map(match => match[0]);
    const matches = cards.filter(card => /craftmine2|CraftMine 2/.test(card));
    assert.ok(matches.length <= 1, 'at most one approved CraftMine 2 addition');
    if (!matches.length) return html;
    assert.equal(matches[0], approvedCard, 'only the exact reviewed CraftMine 2 card is normalized');
    return html.replace('            '+approvedCard+'\r\n', '').replace('            '+approvedCard+'\n', '').replace(approvedCard, '');
}
function assertReviewedBytes(name, bytes) {
    assert.ok(Object.hasOwn(files, name), 'only exact reviewed CraftMine 2 media and social image files are exempted');
    assert.equal(bytes.length, files[name].bytes, name+': reviewed byte count');
    assert.equal(digest(bytes), files[name].sha256, name+': exact reviewed content');
}
function assertMedia(root) {
    const html = fs.readFileSync(path.join(root,'games/index.html'),'utf8');
    normalizeForPreservation(html);
    assert.ok(html.includes(approvedCard), 'the new card is present');
    for (const name of Object.keys(files)) assertReviewedBytes(name, fs.readFileSync(path.join(root,name)));
    for (const ext of ['mp4','webp']) {
        const name = 'games/media/craftmine2-2026.'+ext;
        execFileSync('ffmpeg',['-v','error','-xerror','-nostdin','-i',path.join(root,name),'-f','null','-'],{stdio:'pipe'});
        const probe = JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',path.join(root,name)],{encoding:'utf8'}));
        assert.equal(probe.streams.length,1, 'one silent video/image stream');
        const stream = probe.streams[0];
        assert.equal(stream.width,640); assert.equal(stream.height,360);
        assert.equal(stream.codec_name,ext==='mp4'?'h264':'webp');
        if (ext==='mp4') {
            assert.equal(stream.pix_fmt,'yuv420p'); assert.equal(stream.avg_frame_rate,'30/1');
            assert.equal(Number(stream.nb_read_frames),144); assert.equal(Number(probe.format.duration),4.8);
            assert.ok(Number(probe.format.size)<1000000,'preview stays below 1 MB');
            const bytes=fs.readFileSync(path.join(root,name));
            assert.ok(bytes.indexOf(Buffer.from('moov')) < bytes.indexOf(Buffer.from('mdat')), 'faststart video');
        }
    }
}
module.exports = {approvedCard,expectedCard,files,digest,normalizeForPreservation,assertReviewedBytes,assertMedia};
