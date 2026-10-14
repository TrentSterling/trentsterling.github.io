/* Run only in an environment where the installed browser can launch normally.
 * No remote publication, browser security overrides, or new dependency install.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('../game-media/server.cjs');
const { assertRendered: assertGalleryContent, baseline: galleryBaseline, normalizeYearsForPreservation, normalizeReleasedForPreservation } = require('./gallery-content.cjs');
const isaacArchive = require('../game-media/isaac-archive.cjs');
const craftmine2 = require('../game-media/craftmine2-card.cjs');
const normalizeComparison = html => normalizeYearsForPreservation(normalizeReleasedForPreservation(craftmine2.normalizeForPreservation(isaacArchive.normalizeForPreservation(html))));
const server = createServer();
const baselineRoot = process.env.THEME_BASELINE_ROOT;
// The complete original checkout supplies its own unchanged server and assets.
const baselineServer = baselineRoot ? require(path.join(path.resolve(baselineRoot), 'tools/game-media/server.cjs')).createServer() : null;

const screenshots = process.env.THEME_SCREENSHOTS;
const diagnosticsDir = screenshots || path.resolve('.local/theme-review');

const closeLifecycle = [];
const nativeGalleryReview = [];
const approvedGalleryReview = [];
const comparisonNormalization = 'Comparison-only HTML restores exactly the CraftMine 2 addition, four already-published master cards, four approved year spans and the reviewed Isaac media container to historical markup. Raw candidate audits and screenshots remain unchanged and require all 122 years.';

// Native close is queued. Normal flows await the event; rapid flows deliberately do not.
async function installCloseTrace(page) {
    await page.evaluate(() => {
        if (window.__themeCloseTrace) return;
        window.__themeCloseTrace = []; window.__themeCloseEvents = 0;
        const dialog = document.querySelector('.te-dialog');
        dialog.addEventListener('close', () => { window.__themeCloseEvents++; });
        const record = (event, stage) => {
            const active = document.activeElement, target = event.target;
            window.__themeCloseTrace.push({ event: event.type, stage, time: performance.now(),
                target: target?.id || target?.getAttribute?.('name') || target?.tagName,
                action: target?.closest?.('[data-action]')?.getAttribute('data-action') || null,
                open: dialog.open, expanded: document.querySelector('#tront-theme-btn').getAttribute('aria-expanded'),
                active: active?.id || active?.getAttribute('name') || active?.getAttribute('data-action') || active?.tagName,
                preset: dialog.querySelector('[name="preset"]').value,
                gallery: document.documentElement.getAttribute('data-te-gallery'), mode: document.documentElement.getAttribute('data-te-mode') });
            if (window.__themeCloseTrace.length > 300) window.__themeCloseTrace.shift();
        };
        for (const type of ['pointerdown', 'click', 'input', 'change', 'cancel', 'close', 'focusin']) {
            document.addEventListener(type, event => {
                if (event.target === dialog || event.target?.closest?.('.te-dialog, #tront-theme-btn')) {
                    record(event, 'capture'); queueMicrotask(() => record(event, 'settled'));
                }
            }, true);
        }
    });
}
async function closeDetails(page) {
    return page.evaluate(() => {
        const dialog = document.querySelector('.te-dialog'), active = document.activeElement;
        return { url: location.href, open: dialog.open, expanded: document.querySelector('#tront-theme-btn').getAttribute('aria-expanded'),
            active: { tag: active?.tagName, href: active?.getAttribute('href'), id: active?.id, name: active?.getAttribute('name'), action: active?.getAttribute('data-action') },
            key: TrontThemeEditor.key, state: JSON.parse(localStorage.getItem(TrontThemeEditor.key) || 'null'),
            preset: dialog.querySelector('[name="preset"]').value, gallery: document.documentElement.getAttribute('data-te-gallery'),
            legacy: localStorage.getItem('tront-theme'), htmlMode: document.documentElement.getAttribute('data-te-mode'),
            blogMode: document.documentElement.getAttribute('data-mode'), closeEvents: window.__themeCloseEvents || 0,
            trace: window.__themeCloseTrace || [] };
    });
}
async function openEditor(page) {
    await installCloseTrace(page);
    if (!await page.locator('.te-dialog').evaluate(el => el.open)) {
        await page.waitForFunction(() => document.querySelector('#tront-theme-btn').getAttribute('aria-expanded') === 'false');
        await page.locator('#tront-theme-btn').click();
    }
    await page.waitForFunction(() => document.querySelector('.te-dialog').open && document.querySelector('#tront-theme-btn').getAttribute('aria-expanded') === 'true');
}
async function dismissEditor(page, method = 'button') {
    await installCloseTrace(page);
    const events = await page.evaluate(() => window.__themeCloseEvents);
    assert.equal(await page.locator('.te-dialog').evaluate(el => el.open), true, 'dismissal begins with an open dialog');
    if (method === 'escape') await page.keyboard.press('Escape');
    else if (method === 'outside') await page.mouse.click(5, 5);
    else await page.locator('[data-action="close"]').click();
    await page.waitForFunction(events => window.__themeCloseEvents > events && !document.querySelector('.te-dialog').open &&
        document.querySelector('#tront-theme-btn').getAttribute('aria-expanded') === 'false' && document.activeElement === document.querySelector('#tront-theme-btn'), events, { timeout: 5000 });
}
async function verifyQueuedCloseLifecycle(page, route) {
    await installCloseTrace(page);
    const untouched = await page.evaluate(() => Object.fromEntries(['tront-theme', 'tront-previews-paused', 'tront-theme-editor-v1', 'tront-theme-gallery-v1']
        .filter(key => key !== TrontThemeEditor.key).map(key => [key, localStorage.getItem(key)])));
    const result = { route, rapid: [] };
    for (const method of ['button', 'native-close']) {
        await openEditor(page);
        const events = await page.evaluate(() => window.__themeCloseEvents);
        // Both calls happen in one JS task, before the browser can deliver close.
        await page.evaluate(method => {
            const dialog = document.querySelector('.te-dialog');
            if (method === 'button') dialog.querySelector('[data-action="close"]').click(); else dialog.close();
            document.querySelector('#tront-theme-btn').click();
        }, method);
        await page.waitForFunction(events => window.__themeCloseEvents > events, events, { timeout: 5000 });
        const detail = await closeDetails(page); result.rapid.push({ method, detail });
        assert.equal(detail.open, true, 'queued old close leaves reopened dialog open: ' + method);
        assert.equal(detail.expanded, 'true', 'queued old close cannot collapse aria-expanded: ' + method);
        assert.equal(detail.active.action, 'close', 'queued old close cannot steal focus from reopened modal: ' + method);
        await dismissEditor(page);
    }
    await openEditor(page);
    const nativeFocusEvents = await page.evaluate(() => window.__themeCloseEvents);
    await page.evaluate(() => { document.querySelector('.te-dialog').close(); document.querySelector('#magic-navbar-container a').focus(); });
    await page.waitForFunction(events => window.__themeCloseEvents > events, nativeFocusEvents, { timeout: 5000 });
    result.nativeCloseLaterFocus = await closeDetails(page);
    assert.equal(result.nativeCloseLaterFocus.open, false); assert.equal(result.nativeCloseLaterFocus.expanded, 'false');
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('#magic-navbar-container a')), true, 'queued native close preserves a later deliberate navigation focus');
    await openEditor(page);
    const escapeEvents = await page.evaluate(() => window.__themeCloseEvents);
    // This is a real browser Escape action, immediately followed by reopen.
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelector('#tront-theme-btn').click());
    await page.waitForFunction(events => window.__themeCloseEvents > events, escapeEvents, { timeout: 5000 });
    result.escapeReopen = await closeDetails(page);
    assert.equal(result.escapeReopen.open, true); assert.equal(result.escapeReopen.expanded, 'true');
    assert.equal(result.escapeReopen.active.action, 'close', 'native Escape/reopen retains modal focus');
    await dismissEditor(page, 'escape');
    await openEditor(page);
    await page.selectOption('[name="preset"]', 'light');
    await page.locator('[name="position-1"]').focus();
    await page.keyboard.press('ArrowRight');
    const beforeReset = await closeDetails(page);
    await page.locator('[data-action="reset"]').click();
    result.reset = await closeDetails(page);
    const gallery = route === '/games/';
    assert.equal(result.reset.preset, gallery ? 'gallery-original' : 'dark');
    assert.equal(result.reset.state.preset, gallery ? 'gallery-original' : 'dark');
    assert.equal(result.reset.open, true); assert.equal(result.reset.expanded, 'true');
    assert.equal(await page.locator('[data-action="reset"]').evaluate(el => el === document.activeElement), true, 'Reset retains focus on the activated control');
    if (gallery) assert.equal(result.reset.gallery, 'native');
    else assert.deepEqual(result.reset.state, await page.evaluate(() => TrontThemeEditor.preset('dark')), 'Reset restores exact shared Midnight state');
    if (route.startsWith('/blog/')) await page.waitForFunction(() => document.documentElement.getAttribute('data-mode') === 'dark' && sessionStorage.getItem('mode') === 'dark');
    await page.locator('[data-action="undo"]').click();
    result.undo = await closeDetails(page);
    assert.deepEqual(result.undo.state, beforeReset.state, 'Undo restores all four edited pegs and prior mode');
    assert.equal(result.undo.active.action, 'undo', 'Undo retains focus');
    if (gallery) assert.equal(result.undo.gallery, 'custom');
    if (route.startsWith('/blog/')) await page.waitForFunction(() => document.documentElement.getAttribute('data-mode') === 'light' && sessionStorage.getItem('mode') === 'light');
    await dismissEditor(page);
    const saved = await page.evaluate(() => localStorage.getItem(TrontThemeEditor.key));
    result.closed = await closeDetails(page);
    await page.reload();
    assert.equal(await page.evaluate(() => localStorage.getItem(TrontThemeEditor.key)), saved, 'restored custom state persists');
    assert.deepEqual(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(untouched)), untouched, 'unrelated and legacy storage stays untouched');
    result.persistence = 'passed';
    return result;
}

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
async function reviewScrolledGrid(page, pageName, label) {
    for (const [position, fraction] of [['middle', .5], ['bottom', 1]]) {
        await page.evaluate(f => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), fraction);
        await page.waitForTimeout(120);
        const grid = await page.evaluate(() => ({ y: scrollY, image: getComputedStyle(document.body).backgroundImage, size: getComputedStyle(document.body).backgroundSize }));
        assert.ok(grid.y > 0, 'grid review actually scrolls below the initial viewport');
        assert.equal((grid.image.match(/linear-gradient/g) || []).length, 3);
        assert.match(grid.size, /^50px 50px, 50px 50px,/);
        if (screenshots) await page.screenshot({ path: path.join(screenshots, `${pageName}-grid-${label}-${position}.png`) });
    }
    await page.evaluate(() => scrollTo(0, 0));
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
            trace: window.__themeFocusTrace || [], closeEvents: window.__themeCloseEvents || 0,
            ariaExpanded: document.querySelector('#tront-theme-btn')?.getAttribute('aria-expanded'),
            closeTrace: window.__themeCloseTrace || [] };
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
        if (baselineServer) await new Promise(resolve => baselineServer.listen(0, '127.0.0.1', resolve));
        const baselineUrl = baselineServer ? `http://127.0.0.1:${baselineServer.address().port}` : null;
        const options = { headless: true };
        if (process.env.THEME_BROWSER_EXECUTABLE) options.executablePath = process.env.THEME_BROWSER_EXECUTABLE;
        browser = await chromium.launch(options);
        if (baselineRoot) {
            const native = await browser.newContext();
            await native.route('**/*', async route => {
                const requestUrl = route.request().url();
                if (![url, baselineUrl].some(origin => requestUrl.startsWith(origin + '/'))) return route.abort();
                if (route.request().resourceType() === 'document' && new URL(requestUrl).pathname === '/games/') {
                    // This context compares unchanged native rendering only. Raw
                    // current content is audited separately below and in all 27 gallery checks.
                    const response = await route.fetch();
                    return route.fulfill({ response, body: normalizeComparison(await response.text()) });
                }
                return route.continue();
            });
            const nativePage = await native.newPage();
            const missing = [];
            nativePage.on('response', response => { if ([url, baselineUrl].some(origin => response.url().startsWith(origin + '/')) && response.status() >= 400) missing.push({ url: response.url(), status: response.status() }); });
            const snapshot = () => nativePage.evaluate(() => {
                const style = (element, pseudo) => { const s = getComputedStyle(element, pseudo); return Object.fromEntries(['backgroundColor', 'backgroundImage', 'backgroundSize', 'filter', 'opacity', 'width', 'height', 'top', 'left', 'transform', 'zIndex'].map(k => [k, s[k]])); };
                const cards = [...document.querySelectorAll('.grid .item')];
                return { body: { background: getComputedStyle(document.body).backgroundImage, color: getComputedStyle(document.body).backgroundColor },
                    before: style(document.body, '::before'), after: style(document.body, '::after'), grid: style(document.querySelector('.grid-overlay')),
                    navbar: { container: style(document.querySelector('#magic-navbar-container')),
                        layout: ['gap', 'padding', 'justifyContent', 'flexDirection'].map(key => [key, getComputedStyle(document.querySelector('#magic-navbar-container'))[key]]),
                        links: [...document.querySelectorAll('#magic-navbar-container .nav-link')].map(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return { id: el.id, text: el.innerText.trim(), x: r.x, y: r.y, width: r.width, height: r.height, font: s.font, padding: s.padding }; }) },
                    cards: cards.map(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return { title: el.querySelector('.card-title').textContent, x: r.x, y: r.y, width: r.width, height: r.height, background: s.backgroundColor, border: s.borderColor }; }) };
            });
            for (const width of [1440, 390, 360, 320]) {
                await nativePage.setViewportSize({ width, height: 1000 });
                for (const legacy of ['dark', 'tront-purple', 'light']) {
                    await nativePage.goto(baselineUrl + '/games/');
                    await nativePage.evaluate(value => { localStorage.setItem('tront-theme', value); localStorage.removeItem('tront-theme-gallery-v1'); }, legacy);
                    await nativePage.reload();
                    await nativePage.locator('body.fonts-loaded').waitFor();
                    // The class starts the native 400ms entrance fade; wait for
                    // its final frame before comparing or capturing appearance.
                    await nativePage.waitForFunction(() => getComputedStyle(document.body).opacity === '1');
                    const beforeContent = await assertGalleryContent(nativePage, { historical: true });
                    const before = await snapshot();
                    if (screenshots) await nativePage.screenshot({ path: path.join(screenshots, `games-native-${width}-${legacy}-normalized-comparison-before.png`) });
                    await nativePage.goto(url + '/games/');
                    await nativePage.evaluate(value => { localStorage.setItem('tront-theme', value); localStorage.removeItem('tront-theme-gallery-v1'); }, legacy);
                    await nativePage.reload();
                    await nativePage.locator('body.fonts-loaded').waitFor();
                    await nativePage.waitForFunction(() => getComputedStyle(document.body).opacity === '1');
                    assert.equal(await nativePage.locator('html').getAttribute('data-te-gallery'), 'native');
                    const { textColors, ...contentContract } = await assertGalleryContent(nativePage, { historical: true });
                    assert.deepEqual(textColors, beforeContent.textColors, 'native title, year, description and tag colors stay exact');
                    const after = await snapshot();
                    const { navbar: oldNav, ...oldGallery } = before, { navbar: newNav, ...newGallery } = after;
                    assert.deepEqual(newGallery, oldGallery, `exact native gallery geometry/background survives ${legacy} at ${width}px`);
                    assert.deepEqual(newNav.container, oldNav.container, 'native navbar surface and dimensions are unchanged');
                    assert.deepEqual(newNav.layout, oldNav.layout, 'native navbar gaps, padding and alignment are unchanged');
                    assert.equal(newNav.links.length, oldNav.links.length);
                    const oldOpener = oldNav.links.find(link => link.id === 'tront-theme-btn');
                    const newOpener = newNav.links.find(link => link.id === 'tront-theme-btn');
                    assert.equal(newOpener.text, 'Theme', 'the editor action remains visible at every native width');
                    // Only the action's label/width changes. The centered row shifts
                    // by half that width delta, with no other geometry exemption.
                    const centeringDelta = (oldOpener.width - newOpener.width) / 2;
                    newNav.links.forEach((link, index) => {
                        const { x, ...actual } = link, { x: oldX, ...expected } = oldNav.links[index];
                        if (link.id === 'tront-theme-btn') { expected.text = 'Theme'; expected.width = newOpener.width; }
                        assert.deepEqual(actual, expected, 'all other native navigation geometry and copy stay exact');
                        assert.ok(Math.abs(x - oldX - centeringDelta) <= 1 / 64, 'nav moves only by the intended label-width centering delta');
                        assert.ok(x >= 0 && x + link.width <= width, 'each native navigation control stays within the viewport');
                    });
                    const opener = nativePage.locator('#tront-theme-btn');
                    const legacyName = ({ dark: 'Dark', 'tront-purple': 'Purple', light: 'Light' })[legacy];
                    const appearance = legacy === 'light' ? 'Light' : 'Dark';
                    const description = `Theme editor. Current palette: Original gallery (${legacyName}). Appearance: ${appearance}.`;
                    assert.equal(await opener.getAttribute('aria-label'), description);
                    assert.equal(await opener.getAttribute('title'), description);
                    assert.equal(await opener.locator('.theme-icon').getAttribute('aria-hidden'), 'true');
                    assert.equal(await opener.locator('.theme-label').isVisible(), true);
                    assert.equal(await opener.locator('.theme-label').evaluate(label => {
                        const r = label.getBoundingClientRect(), b = label.parentElement.getBoundingClientRect();
                        return r.width > 0 && r.left >= b.left && r.right <= b.right;
                    }), true, 'Theme label is visible and unclipped');
                    if (screenshots) await nativePage.screenshot({ path: path.join(screenshots, `games-native-${width}-${legacy}-normalized-comparison-after.png`) });
                    await opener.focus();
                    await nativePage.keyboard.press('Enter');
                    assert.equal(await nativePage.locator('.te-dialog').evaluate(dialog => dialog.open), true);
                    assert.equal(await nativePage.locator('[data-peg-row]:visible').count(), 4);
                    await dismissEditor(nativePage, 'escape');
                    assert.equal(await opener.evaluate(el => el === document.activeElement), true);
                    assert.equal(await opener.getAttribute('aria-label'), description);
                    nativeGalleryReview.push({ width, legacy, comparisonNormalization, before: oldNav, after: newNav, centeringDelta, exactGalleryGeometryAndBackground: true, keyboardOpenAndReturn: true, contentContract });
                    fs.mkdirSync(diagnosticsDir, { recursive: true });
                    fs.writeFileSync(path.join(diagnosticsDir, 'games-native-theme-control.json'), JSON.stringify(nativeGalleryReview, null, 2));
                }
            }
            assert.deepEqual(missing, [], 'baseline and current gallery local dependencies must load successfully');
            await native.close();
        }
        // Real, unnormalized candidate coverage. These captures are final page
        // appearance, unlike the explicitly labeled historical comparisons above.
        for (const width of [1440, 390]) {
            phase = 'raw year and Isaac review at ' + width;
            const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, isMobile: width === 390, hasTouch: width === 390 });
            await context.route('**/*', route => route.request().url().startsWith(url + '/') ? route.continue() : route.fulfill({ json: {} }));
            const raw = await context.newPage();
            try {
                for (const legacy of ['dark', 'tront-purple', 'light']) {
                    phase = 'raw verified year labels ' + legacy + ' at ' + width;
                    await raw.goto(url + '/games/');
                    await raw.evaluate(value => { localStorage.setItem('tront-theme', value); localStorage.removeItem('tront-theme-gallery-v1'); }, legacy);
                    await raw.reload(); await raw.locator('body.fonts-loaded').waitFor();
                    await raw.waitForFunction(() => getComputedStyle(document.body).opacity === '1');
                    const { textColors, ...contentContract } = await assertGalleryContent(raw);
                    assert.equal(contentContract.yearSpans, 122); assert.deepEqual(contentContract.knownMissingYearHrefs, []);
                    const yearStyles = await raw.evaluate(corrections => {
                        const results = [], allCards = [...document.querySelectorAll('.grid .item')];
                        const existingYear = allCards.find(card => !Object.hasOwn(corrections, card.getAttribute('href')) && card.querySelector('.card-title span')).querySelector('.card-title span');
                        const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
                        const luminance = color => rgb(color).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
                        const contrast = (a, b) => { a = luminance(a); b = luminance(b); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
                        const styles = element => { const css = getComputedStyle(element); return { color: css.color, font: css.font, textShadow: css.textShadow }; };
                        for (const [href, correction] of Object.entries(corrections)) {
                            const card = allCards.find(card => card.getAttribute('href') === href), heading = card.querySelector('.card-title'), year = heading.querySelector('span');
                            const reference = existingYear.cloneNode(true); reference.textContent = `(${correction.year})`; reference.style.position = 'absolute'; reference.style.visibility = 'hidden';
                            heading.append(reference); const expected = styles(reference); reference.remove();
                            const actual = styles(year), background = getComputedStyle(card).backgroundColor;
                            results.push({ href, text: year.textContent, actual, expected, contrast: contrast(actual.color, background), referenceContrast: contrast(expected.color, background) });
                        }
                        return results;
                    }, galleryBaseline.approvedYearCorrections);
                    for (const item of yearStyles) {
                        assert.equal(item.text, '(2026)'); assert.deepEqual(item.actual, item.expected, 'new years use the existing year style in the same card context');
                        assert.equal(item.contrast, item.referenceContrast, 'new year contrast matches established neighboring-year styling');
                    }
                    for (const href of Object.keys(galleryBaseline.approvedYearCorrections)) {
                        const card = raw.locator(`.grid .item[href="${href}"]`);
                        await card.scrollIntoViewIfNeeded();
                        await card.locator('img').evaluate(img => img.decode());
                        if (screenshots) await raw.screenshot({ path: path.join(screenshots, `games-years-${width}-${legacy}-${href.replaceAll('/', '')}-actual.png`) });
                    }
                    approvedGalleryReview.push({ width, legacy, presentation: 'raw actual candidate, no normalization', contentContract, yearStyles });
                }
                phase = 'Isaac playback, pause, poster and filter flow at ' + width;
                await raw.evaluate(() => { localStorage.setItem('tront-theme', 'dark'); localStorage.removeItem('tront-theme-gallery-v1'); localStorage.removeItem('tront-previews-paused'); });
                await raw.goto(url + '/games/#preview-binding-of-isaac-clone-2014');
                const card = raw.locator('#preview-binding-of-isaac-clone-2014');
                const playing = async () => {
                    await card.scrollIntoViewIfNeeded();
                    await raw.waitForFunction(() => { const v = document.querySelector('#preview-binding-of-isaac-clone-2014 video'); return v && !v.paused && v.currentTime > .1 && v.getVideoPlaybackQuality().totalVideoFrames > 2; });
                };
                await playing();
                const media = await card.locator('video').evaluate(v => ({ src: v.getAttribute('src'), duration: v.duration, width: v.videoWidth, height: v.videoHeight, muted: v.muted, loop: v.loop, playsInline: v.playsInline }));
                assert.equal(media.src, '/games/media/binding-of-isaac-clone-2014.mp4?v=898704224836');
                assert.ok(Math.abs(media.duration - 4.8) < .001); assert.equal(media.width, 576); assert.equal(media.height, 324);
                assert.ok(media.muted && media.loop && media.playsInline);
                assert.equal(await card.locator('img').evaluate(async img => { await img.decode(); return img.naturalWidth; }), 576);
                if (screenshots) await raw.screenshot({ path: path.join(screenshots, `games-isaac-${width}-playback-actual.png`) });
                await raw.evaluate(() => document.getElementById('preview-toggle').click());
                await raw.waitForFunction(() => document.querySelectorAll('.gameplay-preview[src]').length === 0);
                assert.equal(await card.locator('img').isVisible(), true);
                if (screenshots) await raw.screenshot({ path: path.join(screenshots, `games-isaac-${width}-paused-poster-actual.png`) });
                await raw.reload(); await card.scrollIntoViewIfNeeded();
                assert.equal(await card.locator('video[src]').count(), 0, 'Isaac pause survives reload');
                await raw.evaluate(() => document.getElementById('preview-toggle').click()); await playing();
                await raw.evaluate(() => document.getElementById('filter-tool').click());
                await raw.waitForFunction(() => !document.querySelector('#preview-binding-of-isaac-clone-2014 video[src]'));
                assert.equal(await card.isVisible(), false, 'tool filtering hides the prototype and releases its source');
                await raw.evaluate(() => document.getElementById('filter-prototype').click()); await playing();
                approvedGalleryReview.push({ width, isaac: media, decodedPlayback: true, posterDecoded: true, pauseAndReload: true, filteringAndResume: true, presentation: 'raw actual candidate, no normalization' });
                fs.mkdirSync(diagnosticsDir, { recursive: true });
                fs.writeFileSync(path.join(diagnosticsDir, 'games-approved-additions.json'), JSON.stringify(approvedGalleryReview, null, 2));
            } catch (error) {
                fs.mkdirSync(diagnosticsDir, { recursive: true });
                fs.writeFileSync(path.join(diagnosticsDir, 'games-additions-failure.json'), JSON.stringify({ width, phase, message: error.message, completed: approvedGalleryReview }, null, 2));
                try { await raw.screenshot({ path: path.join(diagnosticsDir, `games-additions-failure-${width}-actual.png`) }); } catch {}
                throw error;
            } finally { await context.close(); }
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
            phase = route + ' queued-close, Escape/reopen and Reset/Undo';
            closeLifecycle.push(await verifyQueuedCloseLifecycle(page, route));
            fs.mkdirSync(diagnosticsDir, { recursive: true });
            fs.writeFileSync(path.join(diagnosticsDir, 'theme-close-lifecycle.json'), JSON.stringify(closeLifecycle, null, 2));
            phase = route + ' preset and editing checks';
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
                if (route === '/games/') {
                    assert.equal(await page.locator('html').getAttribute('data-te-gallery'), 'custom');
                    assert.equal(await page.locator('html').getAttribute('data-theme'), null);
                    const palette = await page.locator('[name="preset"] option:checked').innerText();
                    const appearance = id === 'light' ? 'Light' : 'Dark';
                    const description = `Theme editor. Current palette: ${palette}. Appearance: ${appearance}.`;
                    assert.equal((await page.locator('#tront-theme-btn .theme-label').innerText()).trim(), 'Theme');
                    assert.equal(await page.locator('#tront-theme-btn').getAttribute('aria-label'), description);
                    assert.equal(await page.locator('#tront-theme-btn').getAttribute('title'), description);
                }
                await auditText(page);
                if (route === '/' || route === '/discord/') {
                    const grid = await page.evaluate(() => ({ image: getComputedStyle(document.body).backgroundImage, size: getComputedStyle(document.body).backgroundSize }));
                    assert.match(grid.size, /^50px 50px, 50px 50px,/);
                    assert.equal((grid.image.match(/linear-gradient/g) || []).length, 3);
                }
                if (route === '/games/') {
                    const radial = await page.evaluate(() => ({ body: getComputedStyle(document.body).backgroundImage, radius: getComputedStyle(document.body, '::before').borderRadius, blur: getComputedStyle(document.body, '::before').filter }));
                    assert.equal(radial.body, 'none'); assert.equal(radial.radius, '50%'); assert.equal(radial.blur, 'blur(150px)');
                }
                await dismissEditor(page);
                await auditText(page);
                if (route === '/games/') await assertGalleryContent(page);
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
            await dismissEditor(page, 'escape');
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
            await dismissEditor(page, 'outside');
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
            await dismissEditor(page, 'escape');
            await auditText(page);
            if (screenshots) await page.screenshot({ path: path.join(screenshots, `${pageName}-page-desktop-dark.png`), fullPage: route !== '/games/' });
            if (route === '/' || route === '/discord/') await reviewScrolledGrid(page, pageName, 'desktop-dark');
            // Paper/light gives the mobile review a different polarity.
            await page.locator('#tront-theme-btn').click();
            await page.selectOption('[name="preset"]', 'light');
            await dismissEditor(page, 'escape');
            phase = route + ' light mobile visual review';
            for (const width of [320, 390, 768]) {
                await page.setViewportSize({ width, height: 844 });
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'page does not scroll horizontally');
                await page.locator('#tront-theme-btn').click();
                assert.equal(await page.locator('.te-dialog').evaluate(el => el.scrollWidth <= el.clientWidth), true, 'editor fits narrow screens');
                await auditText(page);
                if (screenshots && width === 390) await page.screenshot({ path: path.join(screenshots, `${pageName}-editor-mobile-light.png`) });
                await dismissEditor(page, 'escape');
                await auditText(page);
                if (route === '/games/') await assertGalleryContent(page);
                if (screenshots && width === 390) await page.screenshot({ path: path.join(screenshots, `${pageName}-page-mobile-light.png`), fullPage: route !== '/games/' });
                if ((route === '/' || route === '/discord/') && width === 390) await reviewScrolledGrid(page, pageName, 'mobile-light');
            }
            await page.setViewportSize({ width: 1280, height: 900 });
            phase = route + ' button and prose link affordances';
            for (const selector of (route === '/games/' ? ['#magic-navbar-container .nav-link'] : ['.cta-button', '.join-button', '.links a', '#magic-navbar-container .nav-link'])) {
                const link = page.locator(selector).first();
                if (!await link.count()) continue;
                await link.hover();
                assert.equal(await link.evaluate(el => getComputedStyle(el).textDecorationLine), 'none', 'button-style links have no hover underline');
                await link.focus();
                await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
                assert.equal(await link.evaluate(el => getComputedStyle(el).textDecorationLine), 'none');
                assert.notEqual(await link.evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'keyboard focus remains visible');
            }
            if (route === '/discord/' && screenshots) {
                await page.locator('.cta-button').first().hover();
                await page.screenshot({ path: path.join(screenshots, 'discord-cta-hover.png') });
            }
            await page.emulateMedia({ reducedMotion: 'reduce' });
            assert.equal(await page.locator('.nav-link').first().evaluate(el => getComputedStyle(el).animationName), 'none');
            await page.emulateMedia({ reducedMotion: 'no-preference' });
        }
        assert.deepEqual(await page.evaluate(() => [localStorage.getItem('tront-theme'), localStorage.getItem('tront-previews-paused')]), ['tront-purple', 'true']);
        await page.goto(url + '/games/');
        assert.equal(await page.locator('html').getAttribute('data-tront-theme-surface'), 'gallery');
        assert.equal(await page.evaluate(() => window.TrontThemeEditor.key), 'tront-theme-gallery-v1');
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundImage), 'none');
        // Measure playback in a fresh browser, just like the standalone gallery suite.
        // Prior full-page screenshot/DOM audits must not retain tabs or compositor state.
        await browser.close(); page = null;
        browser = await chromium.launch(options);
        // Exercise the unchanged media controller with custom colors actually active.
        const playback = [];
        for (const size of [{ width: 2560, height: 1440, cap: 12 }, { width: 390, height: 844, cap: 2 }]) {
            phase = 'custom gallery playback at ' + size.width;
            const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: size.width < 600, hasTouch: size.width < 600 });
            await context.route('**/*', r => r.request().url().startsWith(url) ? r.continue() : r.fulfill({ json: {} }));
            const game = await context.newPage();
            game.on('pageerror', error => errors.push(error.message));
            await game.goto(url + '/games/');
            await game.locator('#tront-theme-btn').click();
            await game.selectOption('[name="preset"]', 'purple');
            await game.locator('[name="position-1"]').focus();
            await game.keyboard.press('ArrowRight');
            await dismissEditor(game, 'escape');
            assert.equal(await game.locator('html').getAttribute('data-te-gallery'), 'custom');
            await game.locator('[data-preview]').first().scrollIntoViewIfNeeded();
            await game.waitForFunction(() => [...document.querySelectorAll('.gameplay-preview')].some(v => !v.paused && v.getVideoPlaybackQuality().totalVideoFrames > 5));
            const state = () => game.evaluate(() => ({ attached: document.querySelectorAll('.gameplay-preview[src]').length,
                playing: [...document.querySelectorAll('.gameplay-preview')].filter(v => !v.paused).length,
                videos: [...document.querySelectorAll('.gameplay-preview')].map(v => ({ id: v.closest('[data-preview]').id, total: v.getVideoPlaybackQuality().totalVideoFrames, dropped: v.getVideoPlaybackQuality().droppedVideoFrames })) }));
            // Match the established gallery load test: let all decoders warm up.
            await game.waitForTimeout(2000);
            const before = await state();
            await game.waitForTimeout(5000);
            const after = await state();
            assert.ok(after.playing > 0 && after.attached <= size.cap && after.playing <= size.cap);
            const byId = new Map(before.videos.map(v => [v.id, v]));
            const retained = after.videos.filter(v => byId.has(v.id));
            const frames = retained.reduce((sum, v) => sum + v.total - byId.get(v.id).total, 0);
            const drops = retained.reduce((sum, v) => sum + v.dropped - byId.get(v.id).dropped, 0);
            const measurement = { width: size.width, before, after, frames, drops, dropPercent: 100 * drops / frames };
            fs.mkdirSync(diagnosticsDir, { recursive: true });
            fs.writeFileSync(path.join(diagnosticsDir, `custom-gallery-playback-${size.width}.json`), JSON.stringify(measurement, null, 2));
            console.log('Custom gallery playback:', JSON.stringify(measurement));
            assert.ok(frames > 100 && drops / frames < .1, 'custom radial themes retain smooth bounded video playback: ' + JSON.stringify({ frames, drops }));
            await game.evaluate(() => document.getElementById('filter-mod').click());
            await game.waitForTimeout(300);
            assert.equal(await game.locator('.gameplay-preview[src]').evaluateAll(videos => videos.every(v => v.closest('.item').classList.contains('tag-mod') && v.getBoundingClientRect().width > 0)), true);
            await game.evaluate(() => document.getElementById('filter-all').click());
            await game.locator('[data-preview]').first().scrollIntoViewIfNeeded();
            await game.evaluate(() => document.getElementById('preview-toggle').click());
            await game.waitForFunction(() => !document.querySelector('.gameplay-preview[src]'));
            await game.reload();
            assert.equal(await game.locator('#preview-toggle').innerText(), 'Play previews');
            assert.equal(await game.locator('.gameplay-preview[src]').count(), 0);
            assert.equal(await game.locator('html').getAttribute('data-te-gallery'), 'custom');
            playback.push({ width: size.width, cap: size.cap, before, after, frames, drops, dropPercent: 100 * drops / frames, filtering: 'passed', pausePersistence: 'passed' });
            await context.close();
        }
        assert.deepEqual(errors, []);
        fs.mkdirSync(diagnosticsDir, { recursive: true });
        fs.writeFileSync(path.join(diagnosticsDir, 'theme-browser-report.json'), JSON.stringify({ status: 'passed', comparisonNormalization, approvedGalleryReview, nativeBaseline: baselineRoot ? { widths: [1440, 390, 360, 320], themes: ['dark', 'tront-purple', 'light'], exactGalleryGeometryAndBackground: true, navbarChange: 'Only the visible Theme opener width and resulting centered-row position may change; every other dimension, gap and font stays exact.', cases: nativeGalleryReview, localDependenciesLoaded: true, assetSources: 'separate original and candidate HTTP servers', independentOrigins: true } : null, routes: ['/', '/discord/', '/games/'], presets: 6, widths: [320, 390, 768, 1280], customGalleryPlayback: playback, queuedCloseLifecycle: closeLifecycle, errors }, null, 2));
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
        if (baselineServer?.listening) await new Promise(resolve => baselineServer.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
