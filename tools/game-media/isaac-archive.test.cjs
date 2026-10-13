/* Exact permission boundary for the reviewed archival media, run by its dedicated CI step. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const archive = require('./isaac-archive.cjs');
const root = path.resolve(__dirname, '../..');

test('Isaac normalization permits only the exact reviewed placeholder replacement', () => {
    assert.equal(archive.normalizeForPreservation(archive.approvedCard), archive.originalCard);
    assert.equal(archive.normalizeForPreservation(archive.originalCard), archive.originalCard);
    const unrelated = '<p>Every unrelated byte stays visible to source comparison.</p>';
    assert.equal(archive.normalizeForPreservation(unrelated + archive.approvedCard), unrelated + archive.originalCard);
    for (const [from, to] of [
        ['<span>(2014)</span>', '<span>(2026)</span>'],
        ['Twitch-streamed prototype', 'Changed prototype'],
        ['tag-prototype', 'tag-game'],
        ['javascript:void(0);', '/different-project/'],
        ['898704224836', '000000000000'],
        ['cdb245371a48', '000000000000'],
        ['archive footage', 'generated art'],
        ['width="576"', 'width="640"']
    ]) assert.throws(() => archive.normalizeForPreservation(archive.approvedCard.replace(from, to)), /exact reviewed Isaac/);
    assert.throws(() => archive.normalizeForPreservation(archive.approvedCard + archive.originalCard), /exactly one Isaac/);
});

test('Isaac media exception rejects unknown names, resized bytes and same-size corruption', () => {
    for (const [name] of Object.entries(archive.files)) {
        const bytes = fs.readFileSync(path.join(root, name));
        archive.assertReviewedBytes(name, bytes);
        assert.throws(() => archive.assertReviewedBytes(name, bytes.subarray(1)), /reviewed byte count/);
        const corrupted = Buffer.from(bytes); corrupted[corrupted.length - 1] ^= 1;
        assert.throws(() => archive.assertReviewedBytes(name, corrupted), /exact reviewed content/);
        assert.throws(() => archive.assertReviewedBytes(name + '.other', bytes), /only the two reviewed/);
    }
});

test('Isaac faststart reader rejects malformed atoms', () => {
    assert.throws(() => archive.mp4Atoms(Buffer.from([0, 0, 0, 20, 0, 0, 0, 0])), /valid MP4 atom size/);
    assert.throws(() => archive.mp4Atoms(Buffer.from([0, 0, 0, 8])), /complete MP4 atom header/);
});

test('Reviewed Isaac clip and poster fully decode and meet the exact gallery contract', () => {
    archive.assertMedia(root);
});
