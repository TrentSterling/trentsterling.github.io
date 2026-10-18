'use strict';
// The executable URL is intercepted as inert HTML. No binary is downloaded or run.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const { url: downloadUrl } = require('./device-download.cjs');
const root = path.resolve(__dirname, '../..');
assert.ok(process.env.THEME_BASELINE_ROOT, 'THEME_BASELINE_ROOT is required');
const baseline = path.resolve(process.env.THEME_BASELINE_ROOT);
const out = path.resolve(process.env.THEME_SCREENSHOTS || '.local/theme-review');
fs.mkdirSync(out, { recursive: true });
const origin = 'https://tront.xyz', routePath = '/device-history/';
const selector = 'a[href*="/releases/download/"]';
const started = Date.now();
const report = { status: 'running', startedAt: new Date(started).toISOString(), cases: [], binaryRequests: 0 };
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const measure = () => {
  const box = element => {
    const r = element.getBoundingClientRect(), s = getComputedStyle(element);
    return { x: r.x, y: r.y, width: r.width, height: r.height, font: s.font, color: s.color, background: s.background };
  };
  return { scrollWidth: document.documentElement.scrollWidth, nav: box(document.querySelector('nav')), heading: box(document.querySelector('h1')), sourceVersion: box(document.querySelector('.version-tag')) };
};
(async () => {
  const browser = await (process.env.NAV_BROWSER === 'webkit' ? webkit : chromium).launch({ headless: true, executablePath: process.env.NAV_BROWSER_EXECUTABLE || process.env.THEME_BROWSER_EXECUTABLE || undefined });
  async function open(source, width, javaScriptEnabled) {
    const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, reducedMotion: 'reduce', javaScriptEnabled, serviceWorkers: 'block', acceptDownloads: false });
    const intercepted = [], errors = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.href === downloadUrl) {
        intercepted.push(url.href);
        return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Intercepted destination</title><p>Local test fixture only</p>' });
      }
      if (url.origin !== origin) return route.abort();
      let file = path.resolve(source, '.' + decodeURIComponent(url.pathname));
      assert.ok(file === source || file.startsWith(source + path.sep));
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'Missing fixture asset' });
      return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    page.on('download', () => { report.binaryRequests++; });
    await page.goto(origin + routePath, { waitUntil: 'networkidle' });
    return { context, page, intercepted, errors };
  }
  async function destinations(page) {
    assert.deepEqual(await page.locator(selector).evaluateAll(links => links.map(a => a.href)), [downloadUrl, downloadUrl]);
    for (const label of await page.locator(selector).allTextContents()) assert.ok(label.includes('v0.8.0'));
    assert.equal(await page.locator('.version-tag').textContent(), 'v0.8.3 - Tauri v2 + Svelte 5 rewrite');
    assert.equal(await page.locator('nav a[href="/discord/"]').textContent(), 'Discord');
  }
  try {
    for (const [width, javaScriptEnabled] of [[1440, true], [390, true], [320, true], [390, false]]) {
      const before = await open(baseline, width, javaScriptEnabled), after = await open(root, width, javaScriptEnabled);
      const name = `device-download-${width}-${javaScriptEnabled ? 'script' : 'no-script'}`;
      await before.page.bringToFront(); await before.page.screenshot({ path: path.join(out, name + '-before.png'), animations: 'disabled' });
      const beforeMeasure = await before.page.evaluate(measure);
      await after.page.bringToFront(); await after.page.screenshot({ path: path.join(out, name + '-after.png'), animations: 'disabled' });
      const afterMeasure = await after.page.evaluate(measure);
      assert.deepEqual(afterMeasure, beforeMeasure, 'unchanged navigation, heading, source badge and page width');
      await destinations(after.page);
      await after.page.reload({ waitUntil: 'networkidle' }); await destinations(after.page);
      // Real native Tab from the final nav link reaches the hero download.
      await after.page.locator('nav a[href="/"]').focus(); await after.page.keyboard.press('Tab');
      const focused = await after.page.evaluate(() => {
        const a = document.activeElement, s = getComputedStyle(a);
        return { href: a.href, visible: a.matches(':focus-visible'), outline: s.outlineStyle, width: parseFloat(s.outlineWidth) };
      });
      assert.equal(focused.href, downloadUrl); assert.equal(focused.visible, true);
      assert.notEqual(focused.outline, 'none'); assert.ok(focused.width > 0);
      await after.page.screenshot({ path: path.join(out, name + '-keyboard.png') });
      await Promise.all([after.page.waitForURL(downloadUrl), after.page.keyboard.press('Enter')]);
      await after.page.goBack({ waitUntil: 'networkidle' }); await destinations(after.page);
      await before.page.bringToFront();
      await before.page.locator('#install').scrollIntoViewIfNeeded();
      await before.page.screenshot({ path: path.join(out, name + '-install-before.png'), animations: 'disabled' });
      await after.page.bringToFront();
      await after.page.locator('#install').scrollIntoViewIfNeeded();
      await after.page.screenshot({ path: path.join(out, name + '-install.png'), animations: 'disabled' });
      await Promise.all([after.page.waitForURL(downloadUrl), after.page.locator(selector).nth(1).click()]);
      await after.page.goBack({ waitUntil: 'networkidle' }); await after.page.reload({ waitUntil: 'networkidle' }); await destinations(after.page);
      assert.deepEqual(after.intercepted, [downloadUrl, downloadUrl]);
      assert.deepEqual(before.errors, []); assert.deepEqual(after.errors, []);
      report.cases.push({ width, javaScriptEnabled, exactUnchangedHeaderGeometry: true, directReloadAndBack: true, keyboardFocus: focused, intercepted: after.intercepted });
      console.log('PASS Device History downloads:', width, javaScriptEnabled ? 'script' : 'no script');
      await before.context.close(); await after.context.close();
    }
    assert.equal(report.binaryRequests, 0); report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = error.stack; throw error; }
  finally { report.durationMs = Date.now() - started; fs.writeFileSync(path.join(out, 'device-download-report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
