/* Read-only consumer regression against an already-built blog and candidate same-origin shared assets.
 * Use CI Chrome; this script never edits source, deploys, or retries a blocked browser.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = fs.realpathSync(path.resolve(process.env.BLOG_SITE_ROOT || '_site'));
const out = path.resolve(process.env.BLOG_SCREENSHOTS || process.env.THEME_SCREENSHOTS || '.local/theme-review');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
    try {
        if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
        let file = fs.realpathSync(path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)));
        if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
        if (fs.statSync(file).isDirectory()) file = fs.realpathSync(path.join(file, 'index.html'));
        if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
        const body = fs.readFileSync(file);
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
        res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404); res.end('Not found'); }
});

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


(async () => {
    let browser, page;
    const report = { status: 'running', routes: [], errors: [], missing: [], externalBlocked: [], lifecycle: [] };
    let phase = 'startup';
    try {
        assert.ok(process.env.CI, 'Use CI Chrome; no local blocked-browser retry is permitted');
        assert.ok(process.env.THEME_BROWSER_EXECUTABLE, 'Set THEME_BROWSER_EXECUTABLE to CI Chrome');
        const editor = path.join(root, 'assets/js/tront-theme-editor.js');
        report.candidateEditorSha256 = crypto.createHash('sha256').update(fs.readFileSync(editor)).digest('hex');
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const url = `http://127.0.0.1:${server.address().port}`;
        browser = await chromium.launch({ headless: true, executablePath: process.env.THEME_BROWSER_EXECUTABLE });
        page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        page.on('pageerror', error => report.errors.push(error.message));
        page.on('response', response => { if (response.url().startsWith(url) && /\.(css|js)(\?|$)/.test(response.url()) && response.status() >= 400) report.missing.push(response.url()); });
        await page.route('**/*', route => {
            const u = new URL(route.request().url());
            if (u.origin === url || (route.request().resourceType() === 'image' && u.hostname === 'tront.xyz') || ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'].includes(u.hostname)) return route.continue();
            report.externalBlocked.push(u.href);
            return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
        });
        await page.goto(url + '/blog/', { waitUntil: 'networkidle' });
        const firstPost = await page.locator('#post-list .post-preview').first().getAttribute('href');
        assert.ok(firstPost?.startsWith('/blog/posts/'), 'exercise a real generated blog post');
        await page.evaluate(() => { localStorage.setItem('tront-theme', 'tront-purple'); localStorage.setItem('tront-previews-paused', 'true'); });
        for (const route of ['/blog/', firstPost]) {
            phase = route + ' queued-close consumer checks';
            const response = await page.goto(url + route, { waitUntil: 'networkidle' });
            assert.equal(response.status(), 200);
            assert.equal(await page.locator('html').getAttribute('data-tront-theme-surface'), 'blog');
            assert.equal(await page.evaluate(() => TrontThemeEditor.key), 'tront-theme-editor-v1');
            assert.equal(await page.locator('script[src="/assets/js/tront-theme-editor.js"]').count(), 1, 'candidate editor loads at the real same-origin shared path');
            report.routes.push(route);
            report.lifecycle.push(await verifyQueuedCloseLifecycle(page, route));
            const label = route === '/blog/' ? 'home' : 'post';
            await page.screenshot({ path: path.join(out, `blog-close-${label}-page.png`) });
            await openEditor(page); await page.screenshot({ path: path.join(out, `blog-close-${label}-editor.png`) }); await dismissEditor(page);
            fs.writeFileSync(path.join(out, 'blog-close-report.json'), JSON.stringify(report, null, 2));
        }
        assert.deepEqual(report.missing, [], 'same-origin consumer dependencies load');
        assert.deepEqual(report.errors, [], 'consumer produces no JavaScript errors');
        report.status = 'passed';
        console.log('PASS: built blog home/post consume the queued-close repair, native Escape, Reset/Undo, focus and persistence.');
    } catch (error) {
        report.status = 'failed'; report.phase = phase; report.error = error.stack;
        if (page && !page.isClosed()) {
            try { report.state = await closeDetails(page); await page.screenshot({ path: path.join(out, 'blog-close-failure.png') }); }
            catch (diagnosticError) { report.diagnosticError = diagnosticError.message; }
        }
        process.exitCode = 1; console.error(error);
    } finally {
        fs.writeFileSync(path.join(out, 'blog-close-report.json'), JSON.stringify(report, null, 2));
        if (browser) await browser.close();
        if (server.listening) await new Promise(resolve => server.close(resolve));
    }
})();
