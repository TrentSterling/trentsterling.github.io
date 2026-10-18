'use strict';
// Render exact local source at its public route. No game is launched, no link
// leaves the fixture origin, and no Discord message/invite action is performed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit, request } = require('playwright');
const { pages } = require('./contract.cjs');
const { invite } = require('./discord-invites.cjs');
const root = path.resolve(__dirname, '../..');
const baseline = path.resolve(process.env.THEME_BASELINE_ROOT || '');
assert.ok(process.env.THEME_BASELINE_ROOT, 'THEME_BASELINE_ROOT is required');
const out = path.resolve(process.env.THEME_SCREENSHOTS || '.local/theme-review');
fs.mkdirSync(out, { recursive: true });
const origin = 'https://tront.xyz';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const assets = new Map();
if (process.env.NAV_FONT_CACHE) {
  for (const [url, value] of Object.entries(JSON.parse(fs.readFileSync(process.env.NAV_FONT_CACHE)))) assets.set(url, { body: fs.readFileSync(value.file), contentType: value.contentType });
}
const cases = pages.map(page => ({ ...page, selector: '#magic-navbar-container', core: true })).concat([
  { file: 'style/index.html', route: '/style/', current: 'Style', selector: 'body > nav' },
  { file: 'minecraft-modding/index.html', route: '/minecraft-modding/', current: null, selector: '#nav' }
]);
const started = Date.now();
const report = { status: 'running', startedAt: new Date(started).toISOString(), source: 'exact local source; external widgets stubbed; no public deployment claim', cases: [] };
const measure = selector => {
  const nav = document.querySelector(selector);
  const box = e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return { x: r.x, y: r.y, width: r.width, height: r.height, font: s.font, color: s.color, background: s.background, border: s.border, padding: s.padding };
  };
  return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, heading: box(document.querySelector('h1')), nav: box(nav), links: [...nav.querySelectorAll(':scope > a, :scope > button:not([hidden]), :scope > .t-nav__links > a, :scope > .t-nav__links > details > summary')].map(box) };
};
(async () => {
  const client = await request.newContext({ timeout: 20000 });
  // Cache authentic stylesheet/fonts once so both sources use identical assets.
  for (const file of ['index.html', 'games/index.html']) {
    const cssUrl = fs.readFileSync(path.join(root, file), 'utf8').match(/href="(https:\/\/fonts.googleapis.com\/css2[^\"]+)"/)[1];
    if (!assets.has(cssUrl)) {
      const response = await client.get(cssUrl); assert.equal(response.status(), 200);
      assets.set(cssUrl, { body: await response.body(), contentType: 'text/css' });
    }
    for (const match of assets.get(cssUrl).body.toString().matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
      if (assets.has(match[1])) continue;
      const response = await client.get(match[1]); assert.equal(response.status(), 200);
      assets.set(match[1], { body: await response.body(), contentType: response.headers()['content-type'] });
    }
  }
  await client.dispose();
  const browser = await (process.env.NAV_BROWSER === 'webkit' ? webkit : chromium).launch({ headless: true, executablePath: process.env.NAV_BROWSER_EXECUTABLE || process.env.THEME_BROWSER_EXECUTABLE || undefined });
  async function open(source, item, width, javaScriptEnabled = true, widgetFailure = false) {
    const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, reducedMotion: 'reduce', javaScriptEnabled, serviceWorkers: 'block' });
    await context.addInitScript(() => localStorage.setItem('tront-previews-paused', 'true'));
    const missing = [], errors = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (assets.has(url.href)) return route.fulfill(assets.get(url.href));
      if (url.hostname === 'discord.com') return route.fulfill(widgetFailure ? { status: 503, body: 'Fixture unavailable' } : { json: { name: 'TrontDev', presence_count: 0, members: [] } });
      if (url.origin !== origin) return route.abort();
      let file = path.resolve(source, '.' + decodeURIComponent(url.pathname));
      assert.ok(file === source || file.startsWith(source + path.sep));
      if (url.pathname === '/navigation-test-missing/') file = path.join(source, '404.html');
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) {
        if (/\.(css|js)$/.test(file)) missing.push(url.pathname);
        return route.fulfill({ status: 404, body: 'Missing fixture asset' });
      }
      return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + item.route, { waitUntil: 'networkidle' });
    if (javaScriptEnabled && ['/style/', '/minecraft-modding/'].includes(item.route)) {
      await page.waitForFunction(() => window.Tront && Tront.scale, null, { timeout: 10000 });
    }
    await page.evaluate(async frames => {
      await Promise.all(['400 16px Inter', '500 16px "Fira Code"', '700 16px "Fira Code"'].map(font => document.fonts.load(font)));
      await document.fonts.ready;
      if (frames) await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, javaScriptEnabled);
    return { page, context, errors, missing };
  }
  async function state(page, item) {
    return page.locator(item.selector).evaluate(nav => [...nav.querySelectorAll('a[aria-current]')].map(a => ({ text: a.textContent.trim(), current: a.getAttribute('aria-current'), href: a.getAttribute('href') })));
  }
  async function current(page, item) {
    const active = await state(page, item);
    assert.deepEqual(active.map(a => [a.text, a.current]), item.current ? [[item.current, 'page']] : []);
    if (item.current) assert.equal(new URL(active[0].href, origin).pathname, item.route);
  }
  try {
    for (const item of cases) for (const width of [1440, 390, 320]) {
      const before = await open(baseline, item, width), after = await open(root, item, width);
      const entry = { route: item.route, width };
      const name = (item.route === '/' ? 'home' : item.route.replace(/[^a-z0-9]/g, '-')) + '-' + width;
      // Measure the same painted frame captured as evidence. WebKit can retain
      // pre-theme fallback values in background documents until the first paint.
      await before.page.bringToFront();
      await before.page.screenshot({ path: path.join(out, 'nav-' + name + '-before.png'), animations: 'disabled' });
      const beforeMeasure = await before.page.evaluate(measure, item.selector);
      await after.page.bringToFront();
      await after.page.screenshot({ path: path.join(out, 'nav-' + name + '-after.png'), animations: 'disabled' });
      const afterMeasure = await after.page.evaluate(measure, item.selector);
      try { assert.deepEqual(afterMeasure, beforeMeasure, item.route + ': exact loaded geometry/colors'); }
      catch (error) {
        console.error('Comparison diagnostics', { beforeErrors: before.errors, afterErrors: after.errors, beforeMissing: before.missing, afterMissing: after.missing,
          before: await before.page.evaluate(() => ({ ready: document.readyState, fonts: document.fonts.status, style: document.documentElement.style.cssText })),
          after: await after.page.evaluate(() => ({ ready: document.readyState, fonts: document.fonts.status, style: document.documentElement.style.cssText })) });
        throw error;
      }
      if (item.core) assert.ok(afterMeasure.scrollWidth <= width, 'no document-width overflow');
      entry.exactAppearance = true; entry.currentBefore = await state(before.page, item); entry.currentAfter = await state(after.page, item);
      await current(after.page, item);
      await after.page.reload({ waitUntil: 'networkidle' }); await current(after.page, item);
      entry.directAndReload = true;
      if (item.core) {
        // Start at the first native nav control and use actual Tab traversal.
        await after.page.locator('#tront-theme-btn').focus();
        entry.focus = [];
        for (const label of ['Discord', 'Blog', 'Games', 'Home']) {
          await after.page.keyboard.press('Tab');
          const focused = await after.page.evaluate(() => {
            const a = document.activeElement, r = a.getBoundingClientRect(), s = getComputedStyle(a);
            return { label: a.textContent.trim(), href: a.getAttribute('href'), focusVisible: a.matches(':focus-visible'), outlineStyle: s.outlineStyle, outlineWidth: parseFloat(s.outlineWidth), x: r.x, right: r.right, y: r.y, bottom: r.bottom, width: innerWidth, height: innerHeight };
          });
          assert.equal(focused.label, label); assert.equal(focused.focusVisible, true);
          assert.notEqual(focused.outlineStyle, 'none'); assert.ok(focused.outlineWidth > 0);
          assert.ok(focused.x >= 0 && focused.right <= focused.width && focused.y >= 0 && focused.bottom <= focused.height);
          entry.focus.push(focused);
        }
        await after.page.screenshot({ path: path.join(out, 'nav-' + name + '-keyboard.png') });
        if (item.current) {
          await after.page.locator(item.selector + ' a[aria-current="page"]').focus();
          await Promise.all([after.page.waitForNavigation({ waitUntil: 'networkidle' }), after.page.keyboard.press('Enter')]);
          assert.equal(after.page.url(), origin + item.route); await current(after.page, item);
          entry.keyboardSelfLink = true;
        }
      }
      if (item.route === '/minecraft-modding/') {
        await after.page.locator('#nav a[href="#lesson-0"]').focus();
        await after.page.keyboard.press('Tab');
        assert.equal(await after.page.evaluate(() => document.activeElement.getAttribute('href')), '#lesson-4');
        await after.page.keyboard.press('Enter'); await after.page.waitForURL(origin + item.route + '#lesson-4');
        await after.page.reload({ waitUntil: 'networkidle' }); await current(after.page, item);
        assert.equal(new URL(after.page.url()).hash, '#lesson-4');
        await after.page.locator('#nav summary').focus(); await after.page.keyboard.press('Enter');
        assert.equal(await after.page.locator('#nav details').evaluate(el => el.open), true);
        await after.page.keyboard.press('Enter'); assert.equal(await after.page.locator('#nav details').evaluate(el => el.open), false);
        entry.productKeyboardAndHashRefresh = true;
      } else if (item.route === '/style/') {
        await after.page.locator('body > nav a').first().focus(); await after.page.keyboard.press('Tab');
        assert.equal(await after.page.evaluate(() => document.activeElement.getAttribute('href')), '/games/');
        entry.styleKeyboard = true;
      }
      assert.deepEqual(before.errors, []); assert.deepEqual(after.errors, []); assert.deepEqual(after.missing, []);
      report.cases.push(entry);
      fs.writeFileSync(path.join(out, 'navigation-report.json'), JSON.stringify({ ...report, durationMs: Date.now() - started }, null, 2));
      console.log('PASS navigation:', item.route, width);
      await before.context.close(); await after.context.close();
    }
    // Static current semantics and real hrefs must work without hydration/script.
    for (const item of cases.filter(item => item.core || item.current === 'Style')) {
      const test = await open(root, item, 390, false); await current(test.page, item);
      if (item.current) {
        await Promise.all([test.page.waitForNavigation({ waitUntil: 'networkidle' }), test.page.locator(item.selector + ' a[aria-current="page"]').click()]);
        assert.equal(test.page.url(), origin + item.route); await current(test.page, item);
      }
      await test.context.close();
    }
    const missing = await open(root, { route: '/navigation-test-missing/' }, 390);
    await current(missing.page, cases[3]);
    await missing.page.locator('#magic-navbar-container .home-link').click();
    await missing.page.waitForURL(origin + '/'); await current(missing.page, cases[0]);
    await missing.page.goBack({ waitUntil: 'networkidle' }); await current(missing.page, cases[3]);
    await missing.page.reload({ waitUntil: 'networkidle' }); await current(missing.page, cases[3]);
    report.missingRouteRecovery = 'no false current page, Home recovery, Back, direct refresh';
    await missing.context.close();
    report.discordInvites = [];
    for (const mode of ['success', 'failure', 'no-script']) {
      const test = await open(root, cases[2], 390, mode !== 'no-script', mode === 'failure');
      const popupRequests = [];
      // Intercept before click: inspect the exact target without sending any
      // request to Discord, accepting an invite, or communicating externally.
      await test.context.route(invite, route => {
        popupRequests.push(route.request().url());
        return route.fulfill({ contentType: 'text/html', body: '<title>Local invite target fixture</title>' });
      });
      const calls = test.page.locator('a.cta-button');
      assert.equal(await calls.count(), 2);
      if (mode === 'failure') await test.page.getByText('join directly', { exact: true }).waitFor();
      const actions = mode === 'failure' ? test.page.locator('a.cta-button, #widget-container a') : calls;
      assert.equal(await actions.count(), mode === 'failure' ? 3 : 2);
      for (let i = 0; i < await actions.count(); i++) {
        assert.equal(await actions.nth(i).getAttribute('href'), invite);
        const [popup] = await Promise.all([test.page.waitForEvent('popup'), actions.nth(i).click()]);
        await popup.waitForURL(invite); await popup.close();
      }
      assert.equal(popupRequests.length, mode === 'failure' ? 3 : 2);
      await current(test.page, cases[2]);
      report.discordInvites.push({ mode, target: invite, interceptedClicks: popupRequests.length, navbarStillLanding: true });
      await test.page.screenshot({ path: path.join(out, 'discord-invite-' + mode + '.png') });
      await test.context.close();
    }
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.error = error.message; throw error;
  } finally {
    report.durationMs = Date.now() - started;
    fs.writeFileSync(path.join(out, 'navigation-report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
