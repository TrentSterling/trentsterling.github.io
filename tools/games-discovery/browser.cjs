'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('../game-media/server.cjs');
const server = createServer();
const out = path.resolve(process.env.THEME_SCREENSHOTS || '.local/theme-review');
fs.mkdirSync(out, { recursive: true });
const report = { cases: [], errors: [], fixture: 'Exact local pages/assets, external services blocked, fallback fonts. No game runtimes are launched.' };
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.THEME_BROWSER_EXECUTABLE || undefined, headless: true });
  async function open(width, options = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', ...options });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(origin + '/games/', { waitUntil: 'networkidle' });
    return { context, page };
  }
  const count = page => page.locator('.grid .item:visible').count();
  const search = page => page.locator('#games-search');
  async function reset(page) { await page.locator('#games-reset').click(); assert.equal(await count(page), 128); }
  try {
    for (const width of [320, 390, 768, 1440]) {
      const { context, page } = await open(width);
      assert.equal(await count(page), 128);
      assert.match(await page.locator('.grid .item:visible').first().innerText(), /^Project Demigod/);
      assert.equal(await page.locator('#games-result-count').innerText(), '128 of 128 projects');
      await page.screenshot({ path: path.join(out, `games-discovery-${width}.png`), fullPage: false });
      await search(page).fill('  GEMs   shared  ');
      assert.equal(await count(page), 1);
      await page.locator('#games-browser').check();
      await page.locator('#games-multiplayer').check();
      assert.equal(await count(page), 1);
      await page.locator('label[for="filter-tool"]').click();
      assert.equal(await count(page), 0);
      assert.equal(await page.locator('.games-empty').isVisible(), true);
      await page.locator('.games-empty button').click();
      assert.equal(await count(page), 128);
      assert.equal(await search(page).evaluate(e => e === document.activeElement), true);
      await page.locator('#games-browser').check();
      assert.equal(await count(page), 64);
      await page.locator('#games-multiplayer').check();
      assert.equal(await count(page), 8);
      await page.locator('label[for="filter-prototype"]').click();
      assert.ok(await count(page) > 0);
      await reset(page);
      await search(page).fill('2026');
      assert.ok(await count(page) > 20);
      await search(page).press('Escape');
      assert.equal(await count(page), 128);
      await search(page).fill('jenns farm');
      assert.equal(await count(page), 1);
      await search(page).fill('<img src=x onerror=alert(1)>');
      assert.equal(await count(page), 0);
      assert.equal(await page.locator('img[src="x"]').count(), 0);
      await search(page).fill('robotlife');
      assert.equal(await count(page), 0);
      await reset(page);
      await page.locator('#filter-all').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#filter-vr').isChecked(), true);
      assert.equal(await count(page), 6);
      await reset(page);
      await page.locator('#games-browser').focus();
      await page.keyboard.press('Space');
      assert.equal(await count(page), 64);
      await search(page).fill('gems');
      await search(page).press('Tab');
      for (let i = 0; i < 8; i++) {
        assert.equal(await page.evaluate(() => !!document.activeElement.closest('.item[hidden]')), false);
        await page.keyboard.press('Tab');
      }
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await count(page), 1);
      assert.equal(await search(page).inputValue(), 'gems');
      await page.evaluate(() => {
        history.pushState(null, '', '?q=voxel&multiplayer=1#catalog');
        dispatchEvent(new PopStateEvent('popstate'));
      });
      assert.equal(await count(page), 1);
      assert.match(await page.locator('.grid .item:visible').innerText(), /Voxel Heroes/);
      await page.goBack();
      assert.equal(await search(page).inputValue(), 'gems');
      assert.equal(await count(page), 1);
      await reset(page);
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
      await search(page).fill('tools');
      await page.screenshot({ path: path.join(out, `games-discovery-light-${width}.png`), fullPage: false });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok(await search(page).evaluate(e => e.getBoundingClientRect().width >= 220));
      report.cases.push({ width, search: true, intersections: true, zeroResults: true, keyboard: true, urlReloadAndBack: true, noOverflow: true });
      await context.close();
    }
    for (const options of [{ javaScriptEnabled: false }, {}]) {
      const { context, page } = await open(390, options);
      if (options.javaScriptEnabled !== false) {
        await context.route('**/assets/js/games-discovery.js', route => route.abort());
        await page.reload({ waitUntil: 'networkidle' });
      }
      assert.equal(await page.locator('#games-search').count(), 0);
      assert.equal(await count(page), 128);
      await page.locator('label[for="filter-tool"]').click();
      assert.equal(await count(page), await page.locator('.grid .item.tag-tool').count());
      await context.close();
    }
    const motion = await open(1440, { reducedMotion: 'no-preference' });
    await motion.page.locator('.grid').scrollIntoViewIfNeeded();
    await motion.page.waitForFunction(() => document.querySelectorAll('.gameplay-preview').length > 0);
    await search(motion.page).fill('nothing matches this project');
    await motion.page.waitForFunction(() => document.querySelectorAll('.item[hidden] video').length === 0);
    assert.equal(await count(motion.page), 0);
    await motion.context.close();
    const home = await browser.newPage();
    await home.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await home.goto(origin + '/', { waitUntil: 'networkidle' });
    assert.equal(await home.getByRole('link', { name: 'View All My Games', exact: true }).getAttribute('href'), '/games/');
    assert.equal(await home.getByRole('link', { name: 'My itch.io Games', exact: true }).getAttribute('href'), 'https://trent.itch.io/');
    await home.getByRole('link', { name: 'View All My Games', exact: true }).click();
    await home.waitForURL('**/games/');
    assert.equal(await count(home), 128);
    await home.close();
    assert.deepEqual(report.errors, []);
    report.status = 'passed';
    console.log('PASS: catalog search, combined filters, mobile, keyboard, URL state, fallbacks, preview release and homepage navigation.');
  } finally {
    fs.writeFileSync(path.join(out, 'games-discovery.json'), JSON.stringify(report, null, 2));
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { server.close(); console.error(error); process.exitCode = 1; });
