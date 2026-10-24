// Real browser regressions for the website shell. No mouse, touch, audio,
// pointer lock, OS focus, or runtime source edits. Uses the installed Playwright.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { PNG } = require('node:module').createRequire(require.resolve(process.env.PLAYWRIGHT_MODULE || 'playwright'))('pngjs');
const root = path.resolve(__dirname, '../..');
const out = path.resolve(process.env.AQUA_REVIEW_OUT || path.join(root, '.local/aqua-intro-review'));
fs.mkdirSync(out, { recursive: true });
const checks = [];
const report = { checkedUtc: new Date().toISOString(), checks };
const events = report.browserEvents = [];
function event(type, detail) {
  if (events.length < 100) events.push({ type, detail });
}
async function diagnostic(q) {
  return q.evaluate(() => ({
    url: location.href,
    playing: document.body.classList.contains('playing'),
    launchTitle: document.getElementById('launch-title')?.textContent,
    launchMessage: document.getElementById('launch-message')?.textContent,
    bootHidden: document.getElementById('boot')?.hidden,
    failure: document.getElementById('failure')?.hidden === false ? document.getElementById('failure').textContent : null,
    game: window.AQUA_DIAGNOSTICS?.()
  }));
}
function check(name, ok, detail) {
  checks.push({ name, pass: !!ok, ...(detail === undefined ? {} : { detail }) });
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  assert(ok, name);
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end('Not found'); return; }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const init = () => {
  localStorage.setItem('aqua-empire-settings-v1', JSON.stringify({ sound: false, music: false }));
  window.focus = () => { throw Error('OS focus is forbidden in this test'); };
  Element.prototype.requestPointerLock = () => { throw Error('Pointer lock is forbidden in this test'); };
};
async function activate(page, id) {
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(id => document.activeElement.id === id, id)) {
      await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.keyboard.press('Enter')]);
      return;
    }
  }
  throw Error('Keyboard could not reach ' + id);
}
async function game(page) {
  const element = await page.waitForSelector('iframe', { state: 'attached' });
  const frame = await element.contentFrame();
  await frame.waitForFunction(() => window.AQUAQA && document.getElementById('boot').hidden, null, { timeout: 45000 });
  const boot = await diagnostic(frame);
  event('boot', boot);
  console.log('AQUA_BOOT ' + JSON.stringify(boot));
  await page.waitForFunction(() => document.body.classList.contains('playing'));
  await frame.evaluate(() => { AQUAQA.setManual(); AQUAQA.render(); });
  return frame;
}
async function present(q) {
  // Let the renderer submit the manual state's buffers before capture.
  for (let i = 0; i < 3; i++) {
    await q.evaluate(() => { AQUAQA.render(); return new Promise(requestAnimationFrame); });
  }
}
async function recovered(page, name) {
  await page.waitForFunction(() => document.getElementById('launch-title').textContent === 'The aquarium could not open');
  check(name + ': guide is visible and usable', await page.locator('h1').isVisible() && !await page.locator('#introduction').evaluate(e => e.inert));
  check(name + ': failed frame removed', page.frames().length === 1 && await page.locator('iframe').count() === 0);
  check(name + ': retry and standalone actions remain available', await page.locator('#retry-game').isVisible() && await page.locator('#direct-game').isVisible());
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
}
let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true,
    ...(process.env.THEME_BROWSER_EXECUTABLE ? { executablePath: process.env.THEME_BROWSER_EXECUTABLE } : { channel: 'chrome' }),
    // Honor Chrome's WebGPU adapter blocklist; unsupported runners use the
    // unchanged runtime's WebGL2 fallback instead of forcing a failing device.
    args: ['--mute-audio', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])] });
  const cdp = await browser.newBrowserCDPSession();
  const system = await cdp.send('SystemInfo.getInfo');
  report.environment = { node: process.version, platform: process.platform, browser: browser.version(), gpu: system.gpu };
  console.log('AQUA_ENVIRONMENT ' + JSON.stringify(report.environment));
  async function context(options = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...options });
    ctx.on('page', page => {
      page.on('pageerror', error => event('pageerror', error.message));
      page.on('console', message => {
        if (['error', 'warning'].includes(message.type())) event(message.type(), message.text());
      });
      page.on('requestfailed', request => event('requestfailed', { url: request.url(), error: request.failure()?.errorText }));
    });
    await ctx.addInitScript(init);
    await ctx.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    return ctx;
  }
  // Direct entry has an in-page return path even with no useful browser history.
  let ctx = await context(), page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/aqua-empire/?play=1&x=hello%20world');
  let frame = await game(page);
  check('Direct entry boots one runtime', page.frames().length === 2 && await frame.locator('canvas').count() === 1);
  check('Direct entry exposes Back to guide', await page.locator('#return-guide').isVisible());
  check('Return link preserves other URL parameters', new URL(await page.locator('#return-guide').getAttribute('href')).search === '?x=hello+world');
  await page.screenshot({ path: path.join(out, 'direct-title-return.png') });
  await activate(page, 'return-guide');
  check('Keyboard return works without browser Back history', await page.locator('h1').isVisible() && !new URL(page.url()).searchParams.has('play'));
  check('Returning removes the runtime', page.frames().length === 1);
  await page.screenshot({ path: path.join(out, 'intro-desktop.png') });
  await page.goBack(); frame = await game(page);
  check('Browser Back reopens exactly one runtime', page.frames().length === 2);
  await page.reload(); frame = await game(page);
  check('Direct-entry reload still exposes the guide link', await page.locator('#return-guide').isVisible());
  // Native keyboard enters the existing canvas controls, then starts and pauses.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    if (await frame.evaluate(() => AQUAQA.uiState().focus === 'start')) break;
  }
  await page.keyboard.press('Enter');
  check('Keyboard starts the unchanged game', await frame.evaluate(() => AQUAQA.summary().state.mode === 'play'));
  await present(frame);
  await page.waitForFunction(() => document.getElementById('return-guide').hidden);
  check('Guide link does not overlay active gameplay', !await page.locator('#return-guide').isVisible());
  check('Game viewport stays 1280 by 800', await frame.evaluate(() => innerWidth === 1280 && innerHeight === 800));
  const saved = await frame.evaluate(() => { AQUAQA.advance(1, false, false); AQUAQA.save(); return AQUAQA.snapshot(); });
  await page.keyboard.press('Escape');
  await present(frame);
  await page.waitForFunction(() => !document.getElementById('return-guide').hidden);
  check('Pause exposes the return control', await frame.evaluate(() => AQUAQA.summary().state.paused));
  await page.screenshot({ path: path.join(out, 'paused-return.png') });
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.keyboard.press('Alt+g')]);
  await page.waitForSelector('h1');
  check('Alt+G returns from inside the canvas', await page.locator('h1').isVisible() && page.frames().length === 1);
  check('Returning preserves the game save', await page.evaluate(n => JSON.parse(localStorage.getItem('aqua-empire-save-v1')).fish.length === n, saved.fish.length));
  await page.goBack(); frame = await game(page);
  check('Back after shortcut keeps the saved aquarium', await frame.evaluate(() => localStorage.getItem('aqua-empire-save-v1') !== null));
  check('Successful keyboard flows have no page errors', errors.length === 0, errors);
  // Compare the wrapper with the exact standalone file using the same saved state.
  const standalone = await ctx.newPage(); await standalone.goto(base + '/aqua-empire/game.html');
  await standalone.waitForFunction(() => window.AQUAQA && document.getElementById('boot').hidden);
  for (const q of [standalone, frame]) {
    await q.evaluate(() => { AQUAQA.setManual(); AQUAQA.setVisualTime(0); });
    await q.evaluate(s => AQUAQA.restore(s), saved);
    await q.evaluate(() => { AQUAQA.advance(12, false, false); AQUAQA.render(); });
    await present(q);
  }
  const before = await standalone.evaluate(() => { const s = AQUAQA.snapshot(); delete s.savedAt; return s; });
  const after = await frame.evaluate(() => { const s = AQUAQA.snapshot(); delete s.savedAt; return s; });
  check('Simulation matches after 12 seconds except savedAt', JSON.stringify(before) === JSON.stringify(after));
  fs.writeFileSync(path.join(out, 'matched-standalone-state.json'), JSON.stringify(before, null, 2));
  fs.writeFileSync(path.join(out, 'matched-shell-state.json'), JSON.stringify(after, null, 2));
  // The periodic shell status check must observe the restored gameplay state.
  await page.waitForFunction(() => document.getElementById('return-guide').hidden);
  await standalone.screenshot({ path: path.join(out, 'matched-standalone.png') });
  await page.screenshot({ path: path.join(out, 'matched-shell.png') });
  const baselinePixels = PNG.sync.read(fs.readFileSync(path.join(out, 'matched-standalone.png')));
  const candidatePixels = PNG.sync.read(fs.readFileSync(path.join(out, 'matched-shell.png')));
  check('Matched gameplay pixels are identical', baselinePixels.width === candidatePixels.width && baselinePixels.height === candidatePixels.height && baselinePixels.data.equals(candidatePixels.data));
  await ctx.close();
  // Genuine renderer failure: neither WebGPU nor WebGL can initialize.
  ctx = await context();
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem('test-renderer-repaired') === 'yes') return;
    Object.defineProperty(navigator, 'gpu', { value: undefined });
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(type)) return null;
      return getContext.call(this, type, ...args);
    };
  });
  page = await ctx.newPage(); await page.goto(base + '/aqua-empire/?play=1');
  await recovered(page, 'renderer-failure');
  await page.evaluate(() => sessionStorage.setItem('test-renderer-repaired', 'yes'));
  await activate(page, 'retry-game'); frame = await game(page);
  check('Renderer retry recovers to one working game', page.frames().length === 2 && await frame.evaluate(() => AQUA_DIAGNOSTICS().phase === 'Running'));
  await ctx.close();
  // Aborted network request and a real non-game 404 document are separate cases.
  for (const failure of ['aborted-document', 'missing-document']) {
    ctx = await context({ viewport: { width: 390, height: 844 } });
    let broken = true;
    await ctx.route('**/game.html', route => broken ? failure === 'aborted-document' ? route.abort() : route.fulfill({ status: 404, contentType: 'text/html', body: '<h1>Not found</h1>' }) : route.continue());
    page = await ctx.newPage(); await page.goto(base + '/aqua-empire/?play=1');
    await recovered(page, failure);
    broken = false; await activate(page, 'retry-game'); frame = await game(page);
    check(failure + ': keyboard retry loads one game', page.frames().length === 2 && await frame.evaluate(() => AQUA_DIAGNOSTICS().phase === 'Running'));
    await ctx.close();
  }
  // A slow child keeps the guide usable before the bounded startup timeout.
  ctx = await context(); page = await ctx.newPage(); await page.clock.install();
  await ctx.route('**/game.html', () => {});
  await page.goto(base + '/aqua-empire/?play=1', { waitUntil: 'domcontentloaded' });
  check('Pending child leaves guide usable', await page.locator('h1').isVisible() && !await page.locator('#introduction').evaluate(e => e.inert));
  await page.clock.fastForward(31000); await recovered(page, 'startup-timeout'); await ctx.close();
  for (const width of [320, 390]) {
    ctx = await context({ viewport: { width, height: 844 } });
    page = await ctx.newPage(); await page.goto(base + '/aqua-empire/?play=1');
    frame = await game(page); await present(frame);
    const box = await page.locator('#return-guide').boundingBox();
    check(width + 'px direct entry: return link fits the viewport', box && box.x >= 0 && box.x + box.width <= width && box.height >= 44);
    await page.screenshot({ path: path.join(out, 'direct-title-return-' + width + '.png') });
    await activate(page, 'return-guide');
    check(width + 'px direct entry: keyboard returns to guide', await page.locator('h1').isVisible() && page.frames().length === 1);
    await ctx.close();
  }
  // Narrow text is judged by readable column geometry, not overflow alone.
  for (const width of [320, 390]) {
    for (const scale of [100, 200]) {
      ctx = await context({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      page = await ctx.newPage(); await page.goto(base + '/aqua-empire/');
      if (scale === 200) await page.addStyleTag({ content: 'html{font-size:200%}' });
      const geometry = await page.locator('.controls > div').evaluateAll(rows => rows.map(row => {
        const term = row.querySelector('dt').getBoundingClientRect(), description = row.querySelector('dd').getBoundingClientRect();
        return { rowWidth: row.getBoundingClientRect().width, width: description.width, stacked: description.top >= term.bottom, wrap: getComputedStyle(row.querySelector('dd')).overflowWrap };
      }));
      check(width + 'px at ' + scale + '%: descriptions use full row width', geometry.every(g => g.stacked && g.width >= g.rowWidth - 1 && g.wrap === 'normal'), geometry);
      check(width + 'px at ' + scale + '%: no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(out, 'intro-' + width + '-text-' + scale + '.png'), fullPage: true });
      await page.locator('#controls').screenshot({ path: path.join(out, 'controls-' + width + '-text-' + scale + '.png') });
      await ctx.close();
    }
  }
  ctx = await context({ javaScriptEnabled: false, viewport: { width: 320, height: 568 } });
  page = await ctx.newPage(); await page.goto(base + '/aqua-empire/?play=1');
  check('No-JS direct Play retains the guide and explanation', await page.locator('h1').isVisible() && await page.locator('noscript').isVisible());
  await ctx.close(); report.passed = true;
})().catch(async error => {
  report.passed = false; report.error = error.stack; console.error(error); process.exitCode = 1;
  // Distinguish a runner/runtime startup failure from the same-origin wrapper.
  // This is diagnostic evidence only; it cannot turn a failing check into a pass.
  if (browser && checks.length === 0) {
    const control = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      const base = 'http://127.0.0.1:' + server.address().port;
      await control.addInitScript(init);
      await control.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
      const page = await control.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/aqua-empire/game.html?x=hello+world');
      await page.waitForFunction(() => window.AQUAQA && document.getElementById('boot').hidden, null, { timeout: 45000 });
      report.standaloneControl = { state: await diagnostic(page), errors };
      await page.screenshot({ path: path.join(out, 'standalone-startup-control.png'), timeout: 5000 });
    } catch (controlError) { report.standaloneControl = { error: controlError.message }; }
    finally { await control.close(); }
    console.error('AQUA_STANDALONE_CONTROL ' + JSON.stringify(report.standaloneControl));
  }
  report.failurePages = [];
  for (const ctx of browser?.contexts() || []) {
    for (const page of ctx.pages()) {
      const states = [];
      for (const frame of page.frames()) {
        try { states.push(await diagnostic(frame)); } catch (failure) { states.push({ error: failure.message }); }
      }
      report.failurePages.push(states);
      try { await page.screenshot({ path: path.join(out, 'failure-' + report.failurePages.length + '.png'), timeout: 5000 }); } catch {}
    }
  }
  console.error('AQUA_FAILURE ' + JSON.stringify({ events, pages: report.failurePages }));
})
  .finally(async () => {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(out, 'browser.json'), JSON.stringify(report, null, 2));
    console.log('CHECKS ' + checks.filter(c => c.pass).length + '/' + checks.length);
  });
