'use strict';
// Read-only replay of the real page and fonts; no production mutation.
// Optional GAMES_FONT_CACHE points to an existing URL -> {file, contentType}
// cache. Otherwise download the page's public font stylesheet/font files once.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit, request } = require('playwright');
const root = path.resolve(__dirname, '../..');
const baseline = process.env.THEME_BASELINE_ROOT;
assert.ok(baseline, 'THEME_BASELINE_ROOT must identify a checkout of the PR base');
const output = process.env.THEME_SCREENSHOTS || path.join(root, '.local/theme-review');
fs.mkdirSync(output, { recursive: true });
const report = { fonts: [], normalAppearance: [] };
const origin = 'https://tront.xyz';
const fontCssUrl = fs.readFileSync(path.join(root, 'games/index.html'), 'utf8')
  .match(/href="(https:\/\/fonts.googleapis.com\/css2[^"\s]+)"/)[1];
const cached = process.env.GAMES_FONT_CACHE ? JSON.parse(fs.readFileSync(process.env.GAMES_FONT_CACHE, 'utf8')) : {};
const assets = new Map();
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
async function fontAsset(url, client) {
  if (assets.has(url)) return assets.get(url);
  const entry = cached[url];
  let result;
  if (entry) result = { body: fs.readFileSync(entry.file), contentType: entry.contentType };
  else {
    const response = await client.get(url);
    assert.ok(response.ok(), 'public font asset: ' + url);
    result = { body: await response.body(), contentType: response.headers()['content-type'] };
  }
  assets.set(url, result);
  return result;
}
const measure = () => {
  const box = e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return { x: r.x, y: r.y, width: r.width, height: r.height, font: s.font, color: s.color, background: s.backgroundColor, border: s.border, padding: s.padding };
  };
  const pseudo = selector => {
    const s = getComputedStyle(document.body, selector);
    return Object.fromEntries(['width', 'height', 'borderRadius', 'filter', 'opacity', 'backgroundColor', 'transform'].map(k => [k, s[k]]));
  };
  return {
    width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    heading: box(document.querySelector('h1')),
    nav: [...document.querySelectorAll('#magic-navbar-container .nav-link')].map(box),
    filters: [...document.querySelectorAll('.filter-nav label')].map(box),
    cards: [...document.querySelectorAll('.grid .item')].map(box),
    radialBefore: pseudo('::before'), radialAfter: pseudo('::after')
  };
};

(async () => {
  const client = await request.newContext({ timeout: 15000 });
  const css = await fontAsset(fontCssUrl, client);
  const fontUrls = [...css.body.toString().matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map(m => m[1]);
  assert.ok(fontUrls.length > 0, 'real font stylesheet must reference font files');
  for (const url of fontUrls) await fontAsset(url, client);
  await client.dispose();
  const browserType = process.env.GAMES_TEST_BROWSER === 'webkit' ? webkit : chromium;
  const browser = await browserType.launch({ headless: true, executablePath: process.env.GAMES_BROWSER_EXECUTABLE || process.env.THEME_BROWSER_EXECUTABLE });
  async function open(source, width, { held = false, reducedMotion = 'no-preference', javaScriptEnabled = true } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion, javaScriptEnabled });
    await context.addInitScript(() => localStorage.setItem('tront-previews-paused', 'true'));
    const pending = [], errors = [], missing = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (assets.has(url.href)) {
        if (held && url.hostname === 'fonts.gstatic.com') { pending.push(route); return; }
        return route.fulfill(assets.get(url.href));
      }
      if (url.hostname === 'discord.com') return route.fulfill({ json: { name: 'TrontDev', presence_count: 0, members: [] } });
      if (url.origin !== origin) return route.abort();
      let file = path.resolve(source, '.' + decodeURIComponent(url.pathname));
      assert.ok(file.startsWith(path.resolve(source) + path.sep));
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) { missing.push(url.pathname); return route.fulfill({ status: 404, body: 'Missing local test asset' }); }
      return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/games/', { waitUntil: 'domcontentloaded' });
    return { page, context, pending, errors, missing };
  }
  async function readable(test) {
    try {
      await test.page.waitForFunction(() => getComputedStyle(document.body).visibility === 'visible' && Number(getComputedStyle(document.body).opacity) === 1, null, { timeout: 2000 });
    } catch (error) {
      console.error('Readability diagnostic:', await test.page.evaluate(() => ({ className: document.body.className, fontStatus: document.fonts.status, visibility: getComputedStyle(document.body).visibility, opacity: getComputedStyle(document.body).opacity })));
      throw error;
    }
    const result = await test.page.evaluate(() => ({ fontStatus: document.fonts.status, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, visibleCards: [...document.querySelectorAll('.grid .item')].filter(e => e.getClientRects().length).length }));
    assert.ok(result.scrollWidth <= result.width, 'no horizontal overflow');
    assert.equal(result.visibleCards, 128);
    assert.deepEqual(test.errors, [], 'no page errors');
    assert.deepEqual(test.missing, [], 'all local assets available');
    return result;
  }
  try {
    // Negative control proves the actual pre-fix page can remain invisible.
    const old = await open(baseline, 390, { held: true });
    await old.page.waitForTimeout(1500);
    assert.ok(old.pending.length > 0);
    const before = await old.page.evaluate(() => ({ fontStatus: document.fonts.status, visibility: getComputedStyle(document.body).visibility, opacity: getComputedStyle(document.body).opacity }));
    assert.equal(before.fontStatus, 'loading');
    const baselineWasHidden = fs.readFileSync(path.join(baseline, 'games/index.html'), 'utf8').includes('overflow-x:hidden;opacity:0;visibility:hidden');
    if (baselineWasHidden) assert.equal(before.opacity, '0', 'negative control reproduces the original blank page');
    else await readable(old);
    report.beforeFix = before;
    await old.page.screenshot({ path: path.join(output, 'games-fonts-before.png') });
    await old.context.close();

    for (const width of [1440, 390, 320]) {
      const before = await open(baseline, width), after = await open(root, width);
      await before.page.evaluate(() => document.fonts.ready);
      await after.page.evaluate(() => document.fonts.ready);
      await readable(before); await readable(after);
      assert.deepEqual(await after.page.evaluate(measure), await before.page.evaluate(measure), 'loaded appearance/geometry unchanged at ' + width);
      report.normalAppearance.push({ width, exactComputedGeometry: true });
      await after.page.screenshot({ path: path.join(output, `games-loaded-${width}.png`) });
      await before.context.close(); await after.context.close();

      for (const reducedMotion of ['no-preference', 'reduce']) {
        const test = await open(root, width, { held: true, reducedMotion });
        const first = await readable(test);
        assert.equal(first.fontStatus, 'loading'); assert.ok(test.pending.length > 0);
        await test.page.waitForTimeout(1200);
        assert.equal((await readable(test)).fontStatus, 'loading');
        await test.page.screenshot({ path: path.join(output, `games-fonts-held-${width}-${reducedMotion}.png`) });
        for (const route of test.pending) await route.fulfill(assets.get(route.request().url()));
        await test.page.evaluate(() => document.fonts.ready);
        const settled = await readable(test);
        assert.equal(settled.fontStatus, 'loaded');
        report.fonts.push({ width, reducedMotion, heldRequests: test.pending.length, visibleWhileLoading: true, settled });
        await test.context.close();
      }
    }
    for (const javaScriptEnabled of [true, false]) {
      const test = await open(root, 390, { held: true, javaScriptEnabled });
      assert.equal((await readable(test)).fontStatus, 'loading'); assert.ok(test.pending.length > 0);
      for (const route of test.pending) await route.abort();
      await test.page.evaluate(() => document.fonts.ready);
      await readable(test);
      report.fonts.push({ javaScriptEnabled, failedFontsRemainReadable: true });
      await test.context.close();
    }
    report.status = 'passed';
    console.log('PASS: Games stays readable during held/failed fonts and preserves loaded desktop/mobile geometry.');
  } finally {
    fs.writeFileSync(path.join(output, 'games-resilience-report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
