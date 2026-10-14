'use strict';

const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('../game-media/server.cjs');

const candidates = [
    { id: 'inkride', asset: '/games/media/inkride-2026.mp4?v=1590f82ebd34' },
    { id: 'tinytreads', asset: '/games/media/tiny-treads-2026.mp4?v=754ee2ee465a' },
    { id: 'tinyrise', asset: '/games/media/tinyrise-2026.mp4?v=7c59e1b5395f' }
];
const craftmineAsset = '/games/media/craftmine-2025.mp4?v=741b400e1a9b';

function waitForListen(server) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
}
function closeServer(server) {
    return new Promise(resolve => server.close(resolve));
}

(async () => {
    const server = createServer();
    let browser;
    try {
        await waitForListen(server);
        const address = server.address();
        const origin = 'http://127.0.0.1:' + address.port;
        browser = await chromium.launch({ channel: 'chrome', headless: true });

        for (const candidate of candidates) {
            const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
            await context.addInitScript(id => {
                sessionStorage.setItem('tront-about-discovery-session-v2', JSON.stringify([id]));
            }, candidate.id);
            const page = await context.newPage();
            const errors = [];
            const mediaRequests = [];
            const mediaResponses = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('request', request => {
                const url = new URL(request.url());
                if (url.pathname.endsWith('.mp4')) mediaRequests.push(url.pathname);
            });
            page.on('response', response => {
                const url = new URL(response.url());
                if (url.pathname.endsWith('.mp4')) mediaResponses.push({ path: url.pathname, status: response.status() });
            });
            await context.route('**/*', route => {
                const url = new URL(route.request().url());
                return url.origin === origin ? route.continue() : route.abort();
            });

            await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
            mediaRequests.length = 0;
            mediaResponses.length = 0;
            const fixture = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
                '<link rel="stylesheet" href="' + origin + '/assets/css/tront-about-discovery.css"></head><body>' +
                '<div style="height:1200px"></div><main class="tront-discovery" data-tront-discovery><div class="tront-discovery__grid" data-tront-discovery-cards></div></main>' +
                '<script src="' + origin + '/assets/js/tront-about-discovery.js"></script></body></html>';
            await page.setContent(fixture, { waitUntil: 'load' });
            await page.waitForTimeout(250);
            assert.deepEqual(mediaRequests, [], candidate.id + ': offscreen cards must not request MP4s');

            await page.locator('[data-tront-discovery]').scrollIntoViewIfNeeded();
            await page.waitForFunction(id => {
                const ready = gameId => {
                    const card = document.querySelector('[data-tront-discovery-game="' + gameId + '"]');
                    const video = card && card.querySelector('video[data-tront-discovery-video]');
                    return !!video && !video.paused && !video.hidden && video.readyState >= 2 &&
                        video.currentTime > 0.15 && video.videoWidth > 0 &&
                        video.getVideoPlaybackQuality().totalVideoFrames > 5;
                };
                return ready('craftmine') && ready(id);
            }, candidate.id, { timeout: 30000 });

            const result = await page.evaluate(() => {
                const cards = [...document.querySelectorAll('[data-tront-discovery-game]')];
                return {
                    ids: cards.map(card => card.getAttribute('data-tront-discovery-game')),
                    videos: cards.map(card => {
                        const video = card.querySelector('video[data-tront-discovery-video]');
                        return video ? {
                            game: card.getAttribute('data-tront-discovery-game'),
                            src: video.getAttribute('src'),
                            paused: video.paused,
                            hidden: video.hidden,
                            currentTime: video.currentTime,
                            readyState: video.readyState,
                            width: video.videoWidth,
                            decodedFrames: video.getVideoPlaybackQuality().totalVideoFrames
                        } : null;
                    }).filter(Boolean),
                    smearHasVideoSource: !!document.querySelector('[data-tront-discovery-game="smear"] video[src]'),
                    posters: cards.map(card => {
                        const image = card.querySelector('img');
                        return { game: card.getAttribute('data-tront-discovery-game'), loaded: !!image && image.complete && image.naturalWidth > 0 };
                    })
                };
            });

            assert.deepEqual(result.ids, ['craftmine', 'smear', candidate.id]);
            assert.equal(result.smearHasVideoSource, false, 'SMEAR stays poster-only');
            assert.equal(result.videos.length, 2, 'only CraftMine and the selected random game have video sources');
            assert.deepEqual(result.videos.map(video => video.game), ['craftmine', candidate.id]);
            assert.ok(result.posters.every(poster => poster.loaded), 'all selected posters decode: ' + JSON.stringify(result.posters));
            assert.ok(result.videos.every(video => !video.paused && !video.hidden && video.readyState >= 2 &&
                video.currentTime > 0.15 && video.width > 0 && video.decodedFrames > 5),
            'both selected MP4s decode and advance: ' + JSON.stringify(result.videos));

            const expected = [craftmineAsset.split('?')[0], candidate.asset.split('?')[0]].sort();
            const requested = [...new Set(mediaRequests)].sort();
            assert.deepEqual(requested, expected, 'only CraftMine and the selected random MP4 may be requested');
            assert.ok(mediaResponses.every(response => response.status >= 200 && response.status < 300),
                'MP4 requests succeed: ' + JSON.stringify(mediaResponses));
            assert.deepEqual(errors, [], candidate.id + ': no browser errors');
            console.log('PASS actual About MP4 decode:', JSON.stringify({ random: candidate.id, videos: result.videos, mediaRequests: requested }));
            await context.close();
        }

        console.log('PASS CraftMine and each eligible random preview decoded in Chrome from repository media bytes; SMEAR stayed poster-only.');
    } finally {
        if (browser) await browser.close();
        if (server.listening) await closeServer(server);
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
