/* Run with NODE_PATH pointing to Playwright; no live site writes or external requests. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const data = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (_) { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.THEME_BROWSER_EXECUTABLE || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
  const reports = [];
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      for (const route of ['/', '/discord/', '/games/']) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        await page.route('**/*', r => r.request().url().startsWith(origin + '/') && !/\.(mp4|webm)(\?|$)/.test(r.request().url()) ? r.continue() : r.abort());
        await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
        await page.locator('#tront-theme-btn').click();
        const select = page.locator('#te-preset');
        const key = route === '/games/' ? 'tront-theme-gallery-v1' : 'tront-theme-editor-v1';
        const state = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
        const options = () => select.locator('option').evaluateAll(nodes => nodes.map(n => ({ value: n.value, label: n.textContent.trim(), disabled: n.disabled })));
        const initial = await options();
        assert.equal(initial.find(o => o.value === 'custom').disabled, false, 'Custom must be enabled before ColorMagic');
        assert(initial.every(o => o.label && o.value), 'All options must have visible names and values');
        await select.selectOption('cyan');
        const cyan = await state();
        await select.focus();
        await select.press('End');
        await select.press('Enter');
        assert.equal(await select.inputValue(), 'custom', 'Custom must be keyboard-selectable');
        const custom = await state();
        assert.deepEqual(custom, { ...cyan, preset: 'custom' }, 'Selecting Custom must preserve every current setting');
        await page.locator('[data-action="magic"]').click();
        assert.equal(await select.inputValue(), 'custom');
        const randomized = await state();
        assert.notDeepEqual(randomized.pegs.map(p => p.color), custom.pegs.map(p => p.color));
        assert.deepEqual(await options(), initial, 'ColorMagic must not append blank or duplicate options');
        await page.locator('[data-action="undo"]').click();
        assert.deepEqual(await state(), custom, 'Undo restores the exact pre-magic custom palette');
        await page.locator('#te-color-0').evaluate(input => {
          input.value = '#123456';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        assert.equal((await state()).pegs[0].color, '#123456');
        assert.equal(await select.inputValue(), 'custom');
        const edited = await state();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('#tront-theme-btn').click();
        assert.deepEqual(await state(), edited, 'Custom choices survive reload');
        assert.equal(await select.inputValue(), 'custom');
        assert.deepEqual(await options(), initial, 'Reload retains named, selectable options');
        await page.locator('[data-action="reset"]').click();
        assert.equal(await select.inputValue(), route === '/games/' ? 'gallery-original' : 'dark');
        await page.locator('[data-action="undo"]').click();
        assert.deepEqual(await state(), edited, 'Reset remains undoable');
        await select.selectOption('light');
        const light = await state();
        await select.selectOption('custom');
        assert.deepEqual(await state(), { ...light, preset: 'custom' }, 'Custom preserves light appearance too');
        const screenshotDir = process.env.THEME_SCREENSHOTS;
        if (screenshotDir) {
          fs.mkdirSync(screenshotDir, { recursive: true });
          await page.screenshot({ path: path.join(screenshotDir, (route === '/' ? 'home' : route.replaceAll('/', '')) + '-' + viewport.width + '.png') });
        }
        reports.push({ page: route, width: viewport.width, result: 'passed' });
        await context.close();
      }
    }
    console.log(JSON.stringify({ checks: 'Custom selection, keyboard access, ColorMagic labels, manual edits, persistence, undo/reset, light appearance', reports }, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
