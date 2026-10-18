'use strict';
// Render exact files and intercept outbound navigation. No game or binary runs.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '../..');
assert.ok(process.env.THEME_BASELINE_ROOT);
const baseline = path.resolve(process.env.THEME_BASELINE_ROOT);
const out = path.resolve(process.env.THEME_SCREENSHOTS || '.local/theme-review'); fs.mkdirSync(out, { recursive: true });
const origin = 'https://tront.xyz', product = '/device-history/';
const hubs = ['/discord/', '/blog/', '/games/', '/'];
const themes = ['dark', 'tront-cyan', 'tront-purple', 'tront-ember', 'light'];
const started = Date.now(), report = { status: 'running', cases: [], noScript: [] };
const measure = () => {
  const box = e => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; };
  const appearance = e => { const s = getComputedStyle(e); return { box: box(e), font: s.font, color: s.color, background: s.background, border: s.border, padding: s.padding }; };
  return {
    theme: document.documentElement.getAttribute('data-theme') || 'dark', width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    nav: appearance(document.querySelector('nav')),
    links: [...document.querySelectorAll('nav .nav-link')].map(e => {
      const r = e.getBoundingClientRect(), walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), text = []; let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent.trim() || getComputedStyle(node.parentElement).display === 'none') continue;
        const range = document.createRange(); range.selectNodeContents(node); const b = range.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        text.push({ text: node.textContent.trim(), x: b.x, right: b.right, fullyInside: b.x >= r.x && b.right <= r.right });
      }
      return { label: e.textContent.trim(), href: e.getAttribute('href'), appearance: appearance(e), text };
    }),
    install: appearance(document.querySelector('.install-options')),
    cards: [...document.querySelectorAll('.install-card')].map(appearance),
    code: appearance(document.querySelector('.install-card code')),
    heading: appearance(document.querySelector('h1')), badge: document.querySelector('.version-tag').textContent
  };
};
(async () => {
  const browser = await (process.env.NAV_BROWSER === 'webkit' ? webkit : chromium).launch({ headless: true, executablePath: process.env.NAV_BROWSER_EXECUTABLE || process.env.THEME_BROWSER_EXECUTABLE || undefined });
  async function open(source, width, javaScriptEnabled = true) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled, reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: false });
    const errors = [], intercepted = [];
    await context.route('**/*', route => {
      const u = new URL(route.request().url()); if (u.origin !== origin) return route.abort();
      if (hubs.includes(u.pathname)) { intercepted.push(u.pathname); return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local hub destination</title><p>Navigation intercepted</p>' }); }
      let file = path.resolve(source, '.' + decodeURIComponent(u.pathname)); assert.ok(file.startsWith(source + path.sep));
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ body: fs.readFileSync(file), contentType: ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream' });
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    page.on('download', () => { throw new Error('unexpected download'); });
    await page.goto(origin + product, { waitUntil: 'networkidle' });
    return { context, page, errors, intercepted };
  }
  function readable(state) {
    assert.ok(state.scrollWidth <= state.width);
    assert.equal(state.links.length, 5); assert.equal(state.nav.box.height, 60);
    for (const link of state.links) {
      assert.ok(link.text.length, 'every control has visible identification: ' + link.label);
      assert.ok(link.text.every(t => t.fullyInside), 'unclipped label: ' + link.label);
      const b = link.appearance.box;
      assert.ok(b.width >= 24 && b.height >= 40, 'existing 40px touch target height retained: ' + JSON.stringify({ label: link.label, box: b }));
      assert.ok(b.x >= 0 && b.right <= state.width && b.y >= 0 && b.bottom <= state.nav.box.bottom);
    }
    for (const label of ['Home', 'Games', 'Blog', 'Discord']) assert.ok(state.links.some(a => a.text.some(t => t.text === label)));
    assert.ok(state.links[0].text.some(t => /Dark|Cyan|Purple|Ember|Light/.test(t.text)), 'theme has visible text, not only an icon');
    const [first, second] = state.cards.map(c => c.box);
    if (state.width <= 640) {
      assert.equal(first.x, second.x); assert.equal(first.width, second.width); assert.ok(second.y >= first.bottom + 19);
      assert.ok(state.code.box.width >= 220, 'readable code column at narrowest viewport');
    } else { assert.equal(first.y, second.y); assert.ok(second.x >= first.right + 19); }
    assert.equal(state.badge, 'v0.8.3 - Tauri v2 + Svelte 5 rewrite');
  }
  async function settle(page) {
    await page.mouse.move(0, 80);
    await page.locator('nav').evaluate(nav => Promise.all(nav.getAnimations({ subtree: true }).filter(a => a.effect.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))));
  }
  async function screenshot(page, name) { await page.bringToFront(); await settle(page); return page.screenshot({ path: path.join(out, name + '.png'), animations: 'disabled' }); }
  async function keyboard(test, javaScriptEnabled) {
    await test.page.reload({ waitUntil: 'networkidle' });
    await test.page.keyboard.press('Tab');
    assert.equal(await test.page.evaluate(() => document.activeElement.id), 'tront-theme-btn');
    if (javaScriptEnabled) {
      await test.page.keyboard.press('Space'); assert.equal(await test.page.locator('html').getAttribute('data-theme'), 'tront-cyan');
      await test.page.keyboard.press('Enter'); assert.equal(await test.page.locator('html').getAttribute('data-theme'), 'tront-purple');
      for (let i = 0; i < 3; i++) await test.page.keyboard.press('Enter');
      assert.equal(await test.page.locator('html').getAttribute('data-theme'), null);
    }
    for (const href of hubs) {
      await test.page.keyboard.press('Tab');
      const focused = await test.page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { href: e.getAttribute('href'), visible: e.matches(':focus-visible'), outline: s.outlineStyle, width: parseFloat(s.outlineWidth) }; });
      assert.equal(focused.href, href); assert.equal(focused.visible, true); assert.notEqual(focused.outline, 'none'); assert.ok(focused.width > 0);
    }
    for (const href of hubs) {
      await test.page.locator('nav a[href="' + href + '"]').focus();
      await Promise.all([test.page.waitForURL(origin + href), test.page.keyboard.press('Enter')]);
      await test.page.goBack({ waitUntil: 'networkidle' });
      assert.equal(test.page.url(), origin + product);
    }
    await test.page.reload({ waitUntil: 'networkidle' }); readable(await test.page.evaluate(measure));
    assert.deepEqual(test.intercepted, hubs);
  }
  try {
    for (const width of [320, 360, 361, 390, 480, 481, 600, 601, 640, 641, 768, 1440]) {
      const before = await open(baseline, width), after = await open(root, width);
      for (const theme of themes) {
        await Promise.all([settle(before.page), settle(after.page)]);
        const b = await before.page.evaluate(measure), a = await after.page.evaluate(measure);
        assert.equal(a.theme, theme); readable(a);
        if (width >= 641) assert.deepEqual(a, b, 'desktop geometry, colors and text remain exact');
        if (width === 320 || width === 390) assert.ok(b.links.some(l => l.text.some(t => !t.fullyInside)), 'baseline reproduces clipped labels');
        if (width <= 640) assert.equal(b.cards[0].box.y, b.cards[1].box.y, 'baseline reproduces overridden stacking');
        const entry = { width, theme, labelsReadable: true, codeWidth: a.code.box.width, stacked: width <= 640 };
        if ([320, 390, 641, 768, 1440].includes(width)) {
          const name = `device-responsive-${width}-${theme}`;
          const oldImage = await screenshot(before.page, name + '-before'), newImage = await screenshot(after.page, name + '-after');
          if (width >= 641) assert.ok(newImage.equals(oldImage), 'desktop viewport pixels identical');
          await before.page.locator('#install').scrollIntoViewIfNeeded(); await after.page.locator('#install').scrollIntoViewIfNeeded();
          const oldInstall = await screenshot(before.page, name + '-install-before'), newInstall = await screenshot(after.page, name + '-install-after');
          if (width >= 641) assert.ok(newInstall.equals(oldInstall), 'desktop install pixels identical');
          await before.page.evaluate(() => scrollTo(0, 0)); await after.page.evaluate(() => scrollTo(0, 0));
          entry.desktopPixelIdentical = width >= 641;
        }
        report.cases.push(entry);
        await before.page.locator('#tront-theme-btn').click(); await after.page.locator('#tront-theme-btn').click();
      }
      if ([320, 390, 1440].includes(width)) await keyboard(after, true);
      assert.deepEqual(before.errors, []); assert.deepEqual(after.errors, []);
      await before.context.close(); await after.context.close(); console.log('PASS Device History responsive:', width, 'all five themes');
    }
    for (const width of [320, 390]) {
      const test = await open(root, width, false); readable(await test.page.evaluate(measure)); await keyboard(test, false);
      await screenshot(test.page, `device-responsive-${width}-no-script`); assert.deepEqual(test.errors, []);
      report.noScript.push({ width, keyboardAndLinks: true, intercepted: test.intercepted }); await test.context.close();
    }
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = error.stack; throw error; }
  finally { report.durationMs = Date.now() - started; fs.writeFileSync(path.join(out, 'device-responsive-report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
