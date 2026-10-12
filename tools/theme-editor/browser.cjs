/* Run only in an environment where the installed browser can launch normally.
 * No remote publication, browser security overrides, or new dependency install.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('../game-media/server.cjs');
const server = createServer();
const baselineRoot = process.env.THEME_BASELINE_ROOT;
if (baselineRoot) {
    const original = server.listeners('request')[0];
    server.removeAllListeners('request');
    server.on('request', (req, res) => {
        if (new URL(req.url, 'http://localhost').pathname === '/__baseline-games/') {
            const html = fs.readFileSync(path.join(baselineRoot, 'games/index.html'), 'utf8').replace('<head>', '<head><base href="/games/">');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
        } else original(req, res);
    });
}

const screenshots = process.env.THEME_SCREENSHOTS;
const diagnosticsDir = screenshots || path.resolve('.local/theme-review');

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
async function focusDetails(page) {
    return page.evaluate(() => {
        const active = document.activeElement, dialog = document.querySelector('.te-dialog');
        const describe = element => element ? { tag: element.tagName, id: element.id, name: element.getAttribute('name'), type: element.getAttribute('type'), action: element.getAttribute('data-action') } : null;
        const closedDetails = active?.closest('details:not([open])');
        const inClosedDetailsContent = !!closedDetails && !closedDetails.querySelector('summary')?.contains(active);
        const hiddenAncestor = !!active?.closest('[hidden]');
        const visible = !!active?.getClientRects().length && getComputedStyle(active).visibility === 'visible';
        return { url: location.href, documentHasFocus: document.hasFocus(), dialogOpen: !!dialog?.open,
            insideDialog: !!active?.closest('.te-dialog'), active: describe(active),
            hiddenAncestor, inClosedDetailsContent, visible,
            trace: window.__themeFocusTrace || [] };
    });
}
async function assertFocusInside(page, step) {
    const details = await focusDetails(page);
    assert.equal(details.insideDialog, true, `focus stays within native modal (${step}): ${JSON.stringify(details)}`);
    assert.equal(details.hiddenAncestor, false, `focus skips hidden pegs (${step}): ${JSON.stringify(details)}`);
    assert.equal(details.inClosedDetailsContent, false, `focus skips collapsed controls (${step}): ${JSON.stringify(details)}`);
    assert.equal(details.visible, true, `focused control is visible (${step}): ${JSON.stringify(details)}`);
}
(async () => {
    let browser, page;
    let phase = 'browser startup';
    try {
        if (screenshots) fs.mkdirSync(screenshots, { recursive: true });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const url = `http://127.0.0.1:${server.address().port}`;
        const options = { headless: true };
        if (process.env.THEME_BROWSER_EXECUTABLE) options.executablePath = process.env.THEME_BROWSER_EXECUTABLE;
        browser = await chromium.launch(options);
        if (baselineRoot) {
            const native = await browser.newContext();
            await native.route('**/*', request => request.request().url().startsWith(url) ? request.continue() : request.abort());
            const nativePage = await native.newPage();
            const missing = [];
            nativePage.on('response', response => { if (response.url().startsWith(url) && response.status() >= 400) missing.push({ url: response.url(), status: response.status() }); });
            const snapshot = () => nativePage.evaluate(() => {
                const style = (element, pseudo) => { const s = getComputedStyle(element, pseudo); return Object.fromEntries(['backgroundColor', 'backgroundImage', 'backgroundSize', 'filter', 'opacity', 'width', 'height', 'top', 'left', 'transform', 'zIndex'].map(k => [k, s[k]])); };
                const cards = [...document.querySelectorAll('.grid .item')];
                return { body: { background: getComputedStyle(document.body).backgroundImage, color: getComputedStyle(document.body).backgroundColor },
                    before: style(document.body, '::before'), after: style(document.body, '::after'), grid: style(document.querySelector('.grid-overlay')),
                    navbar: [...document.querySelectorAll('#magic-navbar-container .nav-link')].map(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return { text: el.textContent, x: r.x, y: r.y, width: r.width, height: r.height, font: s.fontSize }; }),
                    cards: cards.map(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return { title: el.querySelector('.card-title').textContent, x: r.x, y: r.y, width: r.width, height: r.height, background: s.backgroundColor, border: s.borderColor }; }) };
            });
            for (const width of [1440, 390]) {
                await nativePage.setViewportSize({ width, height: 1000 });
                for (const legacy of ['dark', 'tront-purple', 'light']) {
                    await nativePage.goto(url + '/__baseline-games/');
                    await nativePage.evaluate(value => { localStorage.setItem('tront-theme', value); localStorage.removeItem('tront-theme-gallery-v1'); }, legacy);
                    await nativePage.reload();
                    await nativePage.locator('body.fonts-loaded').waitFor();
                    const before = await snapshot();
                    await nativePage.goto(url + '/games/');
                    await nativePage.locator('body.fonts-loaded').waitFor();
                    assert.equal(await nativePage.locator('html').getAttribute('data-te-gallery'), 'native');
                    assert.deepEqual(await snapshot(), before, `native gallery geometry/background survives ${legacy} at ${width}px`);
                }
            }
            assert.deepEqual(missing, [], 'baseline and current gallery local dependencies must load successfully');
            await native.close();
        }
        page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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
        for (const route of ['/', '/discord/', '/games/']) {
            phase = route + ' preset and editing checks';
            await page.goto(url + route);
            await page.evaluate(() => {
                window.__themeFocusTrace = [];
                const record = event => {
                    const active = document.activeElement;
                    window.__themeFocusTrace.push({ event: event.type, key: event.key, shift: event.shiftKey,
                        active: active?.id || active?.getAttribute('name') || active?.getAttribute('data-action') || active?.tagName,
                        documentHasFocus: document.hasFocus() });
                    if (window.__themeFocusTrace.length > 40) window.__themeFocusTrace.shift();
                };
                document.addEventListener('focusin', record);
                document.addEventListener('keydown', record);
                window.addEventListener('blur', record);
            });
            await page.locator('#tront-theme-btn').click();
            await page.locator('.te-dialog').waitFor({ state: 'visible' });
            for (const id of ['dark', 'cyan', 'purple', 'ember', 'moss', 'light']) {
                await page.selectOption('[name="preset"]', id);
                await auditText(page);
                if (route === '/') {
                    const grid = await page.evaluate(() => ({ image: getComputedStyle(document.body).backgroundImage, size: getComputedStyle(document.body).backgroundSize }));
                    assert.match(grid.size, /^50px 50px, 50px 50px,/);
                    assert.equal((grid.image.match(/linear-gradient/g) || []).length, 3);
                }
                if (route === '/games/') {
                    const radial = await page.evaluate(() => ({ body: getComputedStyle(document.body).backgroundImage, radius: getComputedStyle(document.body, '::before').borderRadius, blur: getComputedStyle(document.body, '::before').filter }));
                    assert.equal(radial.body, 'none'); assert.equal(radial.radius, '50%'); assert.equal(radial.blur, 'blur(150px)');
                }
                await page.locator('[data-action="close"]').click();
                await auditText(page);
                await page.locator('#tront-theme-btn').click();
            }
            assert.equal(await page.locator('.te-dialog details').count(), 0, 'advanced controls never collapse');
            assert.equal(await page.locator('[data-peg-row]:visible').count(), 4, 'all four pegs are visible');
            assert.equal(await page.locator('[name="count"]').count(), 0, 'there is no peg-count selector');
            await page.locator('[name="position-1"]').focus();
            const before = await page.locator('[name="position-1"]').inputValue();
            await page.keyboard.press('ArrowRight');
            assert.equal(Number(await page.locator('[name="position-1"]').inputValue()), Number(before) + 1);
            await page.locator('[data-action="undo"]').click();
            assert.equal(await page.locator('[name="position-1"]').inputValue(), before);
            await page.locator('[data-action="magic"]').click();
            await page.locator('[name="mode"][value="light"]').check();
            await auditText(page);
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('.te-dialog').isVisible(), false);
            assert.equal(await page.locator('#tront-theme-btn').evaluate(el => el === document.activeElement), true);
            await page.locator('#tront-theme-btn').click();
            phase = route + ' modal focus boundaries';
            await page.locator('[data-action="reset"]').focus();
            await page.keyboard.press('Tab');
            assert.equal(await page.locator('[data-action="close"]').evaluate(el => el === document.activeElement), true, 'last control wraps forward to first');
            await page.keyboard.press('Shift+Tab');
            assert.equal(await page.locator('[data-action="reset"]').evaluate(el => el === document.activeElement), true, 'first control wraps backward to last');
            for (const direction of ['Tab', 'Shift+Tab']) {
                await page.locator('[data-action="close"]').focus();
                for (let n = 0; n < 48; n++) {
                    phase = `${route} always-advanced focus ${direction} ${n + 1}`;
                    await page.keyboard.press(direction);
                    await assertFocusInside(page, phase);
                }
            }
            phase = route + ' outside dismissal, persistence and responsive checks';
            await page.mouse.click(5, 5);
            assert.equal(await page.locator('.te-dialog').isVisible(), false);
            const saved = await page.evaluate(() => localStorage.getItem(window.TrontThemeEditor.key));
            await page.reload();
            assert.equal(await page.evaluate(() => localStorage.getItem(window.TrontThemeEditor.key)), saved);
            const pageName = route === '/' ? 'home' : route === '/games/' ? 'games' : 'discord';
            phase = route + ' dark desktop visual review';
            await page.locator('#tront-theme-btn').click();
            await page.selectOption('[name="preset"]', 'dark');
            await auditText(page);
            if (screenshots) await page.screenshot({ path: path.join(screenshots, `${pageName}-editor-desktop-dark.png`) });
            await page.keyboard.press('Escape');
            await auditText(page);
            if (screenshots) await page.screenshot({ path: path.join(screenshots, `${pageName}-page-desktop-dark.png`), fullPage: route !== '/games/' });
            // Paper/light gives the mobile review a different polarity.
            await page.locator('#tront-theme-btn').click();
            await page.selectOption('[name="preset"]', 'light');
            await page.keyboard.press('Escape');
            phase = route + ' light mobile visual review';
            for (const width of [320, 390, 768]) {
                await page.setViewportSize({ width, height: 844 });
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'page does not scroll horizontally');
                await page.locator('#tront-theme-btn').click();
                assert.equal(await page.locator('.te-dialog').evaluate(el => el.scrollWidth <= el.clientWidth), true, 'editor fits narrow screens');
                await auditText(page);
                if (screenshots && width === 390) await page.screenshot({ path: path.join(screenshots, `${pageName}-editor-mobile-light.png`) });
                await page.keyboard.press('Escape');
                await auditText(page);
                if (screenshots && width === 390) await page.screenshot({ path: path.join(screenshots, `${pageName}-page-mobile-light.png`), fullPage: route !== '/games/' });
            }
            await page.setViewportSize({ width: 1280, height: 900 });
            await page.emulateMedia({ reducedMotion: 'reduce' });
            assert.equal(await page.locator('.nav-link').first().evaluate(el => getComputedStyle(el).animationName), 'none');
            await page.emulateMedia({ reducedMotion: 'no-preference' });
        }
        assert.deepEqual(await page.evaluate(() => [localStorage.getItem('tront-theme'), localStorage.getItem('tront-previews-paused')]), ['tront-purple', 'true']);
        await page.goto(url + '/games/');
        assert.equal(await page.locator('html').getAttribute('data-tront-theme-surface'), 'gallery');
        assert.equal(await page.evaluate(() => window.TrontThemeEditor.key), 'tront-theme-gallery-v1');
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundImage), 'none');
        assert.deepEqual(errors, []);
        console.log('PASS: real-browser theme interactions, computed text contrast, mobile fit and gallery preference isolation.');
    } catch (error) {
        if (page && !page.isClosed()) {
            try {
                fs.mkdirSync(diagnosticsDir, { recursive: true });
                const focus = await focusDetails(page);
                const report = { phase, error: error.message, focus };
                console.error('Theme browser failure diagnostics:', JSON.stringify(report, null, 2));
                fs.writeFileSync(path.join(diagnosticsDir, 'theme-browser-failure.json'), JSON.stringify(report, null, 2));
                await page.screenshot({ path: path.join(diagnosticsDir, 'theme-browser-failure.png'), fullPage: false });
            } catch (diagnosticError) { console.error('Could not capture browser diagnostics:', diagnosticError.message); }
        }
        throw error;
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
