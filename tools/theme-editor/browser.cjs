/* Run only in an environment where the installed browser can launch normally.
 * No remote publication, browser security overrides, or new dependency install.
 */
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createServer } = require('../game-media/server.cjs');
const server = createServer();
const screenshots = process.env.THEME_SCREENSHOTS;

async function auditText(page) {
    const failures = await page.evaluate(() => {
        const api = window.TrontThemeEditor;
        const state = JSON.parse(localStorage.getItem(api.key) || 'null') || api.fromLegacy(localStorage.getItem('tront-theme'));
        const tokens = api.buildTokens(state), failures = [];
        const parse = value => {
            const values = value.match(/[\d.]+/g);
            return values ? values.slice(0, 3).map(Number) : null;
        };
        for (const element of document.body.querySelectorAll('*')) {
            if (['SCRIPT', 'STYLE', 'OPTION'].includes(element.tagName)) continue;
            if (![...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) continue;
            const css = getComputedStyle(element), box = element.getBoundingClientRect();
            if (!box.width || !box.height || css.visibility === 'hidden' || Number(css.opacity) === 0) continue;
            const color = parse(css.color);
            const ratio = color && api.contrast(color, tokens.bound);
            if (ratio < 4.5) failures.push({ element: element.className || element.tagName, text: element.textContent.trim().slice(0, 60), color: css.color, ratio });
        }
        return failures;
    });
    assert.deepEqual(failures, [], 'rendered foregrounds meet the shared whole-background bound');
}
(async () => {
    let browser;
    try {
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const url = `http://127.0.0.1:${server.address().port}`;
        const options = { headless: true };
        if (process.env.THEME_BROWSER_EXECUTABLE) options.executablePath = process.env.THEME_BROWSER_EXECUTABLE;
        browser = await chromium.launch(options);
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            const request = route.request().url();
            if (request.includes('discord.com/api/')) return route.fulfill({ json: { name: 'TrontDev', presence_count: 3, instant_invite: 'https://discord.gg/example', members: [{ id: '1', username: 'Test member', status: 'online', avatar_url: url + '/favicon.png', game: { name: 'Unity' } }] } });
            if (!request.startsWith(url)) return route.abort();
            return route.continue();
        });
        await page.goto(url);
        await page.evaluate(() => { localStorage.setItem('tront-theme', 'tront-purple'); localStorage.setItem('tront-previews-paused', 'true'); });
        await page.reload();
        for (const route of ['/', '/discord/']) {
            await page.goto(url + route);
            await page.locator('#tront-theme-btn').click();
            await page.locator('.te-dialog').waitFor({ state: 'visible' });
            for (const id of ['dark', 'cyan', 'purple', 'ember', 'moss', 'light']) {
                await page.selectOption('[name="preset"]', id);
                await auditText(page);
                await page.locator('[data-action="close"]').click();
                await auditText(page);
                await page.locator('#tront-theme-btn').click();
            }
            await page.locator('summary').click();
            await page.locator('[name="position-1"]').focus();
            const before = await page.locator('[name="position-1"]').inputValue();
            await page.keyboard.press('ArrowRight');
            assert.equal(Number(await page.locator('[name="position-1"]').inputValue()), Number(before) + 1);
            await page.locator('[data-action="undo"]').click();
            assert.equal(await page.locator('[name="position-1"]').inputValue(), before);
            await page.selectOption('[name="count"]', '1');
            assert.equal(await page.locator('[data-peg-row="1"]').isVisible(), false);
            await page.selectOption('[name="count"]', '4');
            await page.locator('[data-action="magic"]').click();
            await page.locator('[name="mode"][value="light"]').check();
            await auditText(page);
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('.te-dialog').isVisible(), false);
            assert.equal(await page.locator('#tront-theme-btn').evaluate(el => el === document.activeElement), true);
            await page.locator('#tront-theme-btn').click();
            for (let n = 0; n < 24; n++) {
                await page.keyboard.press('Tab');
                assert.equal(await page.evaluate(() => document.activeElement.closest('dialog') !== null), true, 'focus stays within native modal');
            }
            await page.mouse.click(5, 5);
            assert.equal(await page.locator('.te-dialog').isVisible(), false);
            const saved = await page.evaluate(() => localStorage.getItem('tront-theme-editor-v1'));
            await page.reload();
            assert.equal(await page.evaluate(() => localStorage.getItem('tront-theme-editor-v1')), saved);
            for (const width of [320, 390, 768]) {
                await page.setViewportSize({ width, height: 844 });
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'page does not scroll horizontally');
                await page.locator('#tront-theme-btn').click();
                assert.equal(await page.locator('.te-dialog').evaluate(el => el.scrollWidth <= el.clientWidth), true, 'editor fits narrow screens');
                await auditText(page);
                if (screenshots && width === 390) await page.screenshot({ path: `${screenshots}/${route === '/' ? 'home' : 'discord'}-theme-mobile.png` });
                await page.keyboard.press('Escape');
            }
            await page.setViewportSize({ width: 1280, height: 900 });
            await page.emulateMedia({ reducedMotion: 'reduce' });
            assert.equal(await page.locator('.nav-link').first().evaluate(el => getComputedStyle(el).animationName), 'none');
            await page.emulateMedia({ reducedMotion: 'no-preference' });
        }
        assert.deepEqual(await page.evaluate(() => [localStorage.getItem('tront-theme'), localStorage.getItem('tront-previews-paused')]), ['tront-purple', 'true']);
        await page.goto(url + '/games/');
        assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-tront-theme-editor')), false);
        assert.equal(await page.evaluate(() => window.TrontThemeEditor === undefined), true);
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'tront-purple');
        assert.deepEqual(errors, []);
        console.log('PASS: real-browser theme interactions, computed text contrast, mobile fit and gallery preference isolation.');
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
