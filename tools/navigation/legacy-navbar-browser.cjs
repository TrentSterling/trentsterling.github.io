'use strict';
// Exact local page/assets at canonical routes. Hub navigation is intercepted;
// no destination runtime or download is fetched. The actual baseline is never
// replaced by a reverse-normalized defect fixture, including self-base runs.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium, webkit, request } = require('playwright');
const { PNG } = require('pngjs');
const { files:allFiles, block, buttonAfter, normalize, assertResponsive } = require('./legacy-navbar.cjs');
const files = allFiles.filter(file => file === 'snapscan/index.html');
const grid = require('./snapscan-grid.cjs');
const root = path.resolve(__dirname, '../..');
assert.ok(process.env.THEME_BASELINE_ROOT, 'THEME_BASELINE_ROOT is required');
const baseline = path.resolve(process.env.THEME_BASELINE_ROOT);
const out = path.resolve(process.env.THEME_SCREENSHOTS || '.local/theme-review');
fs.mkdirSync(out, { recursive: true });
const origin = 'https://tront.xyz', hubs = ['/discord/', '/blog/', '/games/', '/'];
const themes = ['dark', 'tront-cyan', 'tront-purple', 'tront-ember', 'light'];
const labels = ['Dark', 'Cyan', 'Purple', 'Ember', 'Light'];
const widths = [320];
const assets = new Map(), started = Date.now();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { status: 'running', sources: { baseline, candidate: root }, widths, themes,
  fixture: 'Exact checked-out source and authentic fonts/logo; infinite decorative CSS animations paused at time zero on both sides. Real baseline used even when already fixed. Pixel gate covers the complete 96px navbar/header strip; full-viewport diagnostics retain existing animated GIFs, whose independently advancing frames are not a pixel gate.',
  pixelFailures: [], pixelDiagnostics: [], cases: [], keyboard: [], noScript: [], source: [], assets: [], interceptedDestinations: [], blockedExternal: [], runtimeRequests: 0, downloads: 0 };
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml', '.ttf':'font/ttf', '.woff2':'font/woff2' };
for (const file of files) {
  const before = fs.readFileSync(path.join(baseline, file), 'utf8'), after = fs.readFileSync(path.join(root, file), 'utf8');
  assertResponsive(after);
  assert.equal(normalize(after, file), normalize(before, file), 'only exact reviewed local CSS and button name may differ: ' + file);
  const baselineHasFix = before.includes(block) && before.includes(buttonAfter);
  if (baselineHasFix) assertResponsive(before);
  report.source.push({ file, baselineHasFix, beforeSha256: hash(before), afterSha256: hash(after), exactReviewedDifference: true });
}
for (const file of ['assets/css/tront-themes.css', 'assets/js/tront-theme.js']) {
  const before = fs.readFileSync(path.join(baseline, file)), after = fs.readFileSync(path.join(root, file));
  assert.deepEqual(after, before, 'shared theme implementation is untouched');
  report.source.push({ file, sha256: hash(after), byteIdentical: true });
}
// Text ranges are measured glyph by glyph against their own control's client
// box, every clipping ancestor, and the viewport. Hidden icons are not labels.
function measure() {
  const rect = r => ({ left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height });
  const intersect = (a, b) => ({ left:Math.max(a.left,b.left), right:Math.min(a.right,b.right), top:Math.max(a.top,b.top), bottom:Math.min(a.bottom,b.bottom) });
  const appearance = element => {
    const style = getComputedStyle(element);
    return { rect:rect(element.getBoundingClientRect()), font:style.font, color:style.color, background:style.background,
      border:style.border, padding:style.padding, gap:style.gap, flexDirection:style.flexDirection };
  };
  const nav = document.querySelector('#magic-navbar-container');
  const controls = [...nav.querySelectorAll('a, button')].map(element => {
    const box = element.getBoundingClientRect();
    let clip = intersect(rect(box), { left:0, top:0, right:innerWidth, bottom:innerHeight });
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor), b = ancestor.getBoundingClientRect();
      clip = intersect(clip, {
        left:/hidden|clip|auto|scroll/.test(style.overflowX) ? b.left + ancestor.clientLeft : -Infinity,
        right:/hidden|clip|auto|scroll/.test(style.overflowX) ? b.left + ancestor.clientLeft + ancestor.clientWidth : Infinity,
        top:/hidden|clip|auto|scroll/.test(style.overflowY) ? b.top + ancestor.clientTop : -Infinity,
        bottom:/hidden|clip|auto|scroll/.test(style.overflowY) ? b.top + ancestor.clientTop + ancestor.clientHeight : Infinity
      });
    }
    const text = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim()) continue;
      let visible = true;
      for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (style.display === 'none' || style.visibility === 'hidden') visible = false;
      }
      if (!visible) continue;
      const range = document.createRange(), glyphs = []; let offset = 0;
      for (const character of node.textContent) {
        range.setStart(node, offset); offset += character.length; range.setEnd(node, offset);
        if (!character.trim()) continue;
        for (const r of range.getClientRects()) {
          if (!r.width || !r.height) continue;
          const hit = document.elementFromPoint((r.left+r.right)/2, (r.top+r.bottom)/2);
          glyphs.push({ character, rect:rect(r), fullyInside:r.left >= clip.left-.1 && r.right <= clip.right+.1 && r.top >= clip.top-.1 && r.bottom <= clip.bottom+.1,
            centerHitOwnControl:hit === element || element.contains(hit) });
        }
      }
      if (glyphs.length) text.push({ text:node.textContent.trim(), glyphs });
    }
    const hit = document.elementFromPoint((box.left+box.right)/2, (box.top+box.bottom)/2);
    return { tag:element.tagName, id:element.id, label:element.textContent.trim().replace(/\s+/g,' '), href:element.getAttribute('href'),
      target:element.getAttribute('target'), download:element.getAttribute('download'), appearance:appearance(element), clip, text,
      centerHitOwnControl:hit === element || element.contains(hit) };
  });
  return { theme:document.documentElement.getAttribute('data-theme') || 'dark', width:innerWidth, scrollWidth:document.documentElement.scrollWidth,
    nav:appearance(nav), navScrollWidth:nav.scrollWidth, controls, heading:appearance(document.querySelector('h1')),
    primaryControls:[...document.querySelectorAll('a.btn')].map(element => ({ text:element.textContent, href:element.getAttribute('href'), ...appearance(element) })),
    fonts:{ status:document.fonts.status, faces:[...document.fonts].map(font => ({ family:font.family, weight:font.weight, status:font.status })) } };
}
function readable(state) {
  assert.ok(state.navScrollWidth <= state.width, 'no horizontal navbar overflow');
  assert.equal(state.nav.rect.width, state.width, 'navbar remains exactly viewport-wide');
  assert.equal(state.nav.rect.height, 60); assert.equal(state.controls.length, 5);
  assert.deepEqual(state.controls.map(control => control.href), [null, ...hubs], 'native DOM/tab order unchanged');
  assert.deepEqual(state.controls.slice(1).map(control => control.label), ['Discord', 'Blog', 'Games', 'Home']);
  assert.equal(state.controls[0].tag, 'BUTTON'); assert.equal(state.controls[0].id, 'tront-theme-btn');
  assert.equal(state.fonts.status, 'loaded'); assert.ok(state.fonts.faces.every(font => font.status !== 'error'));
  assert.ok(state.primaryControls.length, 'real page primary actions are measured');
  for (const control of state.controls) {
    const box = control.appearance.rect;
    assert.equal(box.height, 40, 'original 40px target height');
    assert.ok(box.left >= 0 && box.right <= state.width && box.top >= 0 && box.bottom <= state.nav.rect.bottom, 'control is inside navbar and viewport');
    assert.ok(control.centerHitOwnControl, 'control center is hit-testable');
    assert.equal(control.target, null); assert.equal(control.download, null);
    assert.ok(control.text.length, 'every control has visible text');
    for (const text of control.text) for (const glyph of text.glyphs) {
      assert.ok(glyph.fullyInside, 'every visible glyph is inside its control, clipping chain and viewport: ' + control.label + ' / ' + glyph.character);
      assert.ok(glyph.centerHitOwnControl, 'visible glyph belongs to its own control');
    }
  }
  assert.ok(state.controls[0].text.some(text => text.text === labels[themes.indexOf(state.theme)]), 'current theme keeps a visible native label');
}
(async () => {
  if (process.env.AUTHOR_FONT_CACHE) for (const [url, value] of Object.entries(JSON.parse(fs.readFileSync(process.env.AUTHOR_FONT_CACHE)))) {
    const body = fs.readFileSync(value.file); assert.equal(hash(body), value.sha256); assets.set(url, { body, contentType:value.contentType });
  }
  const client = await request.newContext({ timeout:20000 });
  async function cache(url, contentType) {
    if (assets.has(url)) return;
    const response = await client.get(url); assert.equal(response.status(), 200, url);
    assets.set(url, { body:await response.body(), contentType:contentType || response.headers()['content-type'] });
  }
  for (const file of files) for (const match of fs.readFileSync(path.join(root, file), 'utf8').matchAll(/href="(https:\/\/fonts.googleapis.com\/css2[^"]+)"/g)) {
    await cache(match[1], 'text/css');
    for (const font of assets.get(match[1]).body.toString().matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) await cache(font[1]);
  }
  const logo = origin + '/blog/assets/img/tront.png';
  if (process.env.AUTHOR_BLOG_ROOT) assets.set(logo, { body:fs.readFileSync(path.join(process.env.AUTHOR_BLOG_ROOT, 'assets/img/tront.png')), contentType:'image/png' });
  else {
    const response = await client.get('https://raw.githubusercontent.com/TrentSterling/blog/ddb16b66b7c6fec28ce8711245db683053c572a0/assets/img/tront.png');
    assert.equal(response.status(), 200); assets.set(logo, { body:await response.body(), contentType:'image/png' });
  }
  await client.dispose();
  report.assets = [...assets].map(([url, value]) => ({ url, sha256:hash(value.body) }));
  const browser = await (process.env.NAV_BROWSER === 'webkit' ? webkit : chromium).launch({ headless:true, executablePath:process.env.NAV_BROWSER_EXECUTABLE || process.env.THEME_BROWSER_EXECUTABLE || undefined });
  async function settle(page, javaScriptEnabled) {
    await page.mouse.move(0, 80);
    if (javaScriptEnabled) await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    else {
      // No async page callbacks: WebKit disables those in no-script contexts.
      await page.waitForTimeout(100);
      await page.evaluate(() => { for (const animation of document.getAnimations()) if (animation.effect.getTiming().iterations === Infinity) { animation.pause(); animation.currentTime = 0; } });
      return;
    }
    await page.evaluate(async () => {
      const finite = [];
      for (const animation of document.getAnimations()) {
        if (animation.effect.getTiming().iterations === Infinity) { animation.pause(); animation.currentTime = 0; }
        else finite.push(animation.finished.catch(() => {}));
      }
      await Promise.all(finite);
    });
  }
  async function open(source, file, width, javaScriptEnabled = true) {
    const context = await browser.newContext({ viewport:{ width, height:844 }, colorScheme:'dark', reducedMotion:'reduce', javaScriptEnabled, serviceWorkers:'block', acceptDownloads:false });
    const url = origin + '/' + file.replace('index.html', ''), missing = [], errors = [], intercepted = [];
    await context.route('**/*', route => {
      const req = route.request(), u = new URL(req.url());
      if (assets.has(u.href)) return route.fulfill(assets.get(u.href));
      if (u.origin === origin && hubs.includes(u.pathname) && req.isNavigationRequest()) {
        intercepted.push(u.href); report.interceptedDestinations.push({ file, width, javaScriptEnabled, url:u.href });
        return route.fulfill({ contentType:'text/html', body:'<!doctype html><title>Intercepted navbar destination</title><p>Inert local navigation fixture</p>' });
      }
      if (/\/(play|games)\//.test(u.pathname) || /\.(wasm|data)$/.test(u.pathname)) { report.runtimeRequests++; return route.abort(); }
      if (/\.(exe|zip|msi|dmg)$/.test(u.pathname)) { report.downloads++; return route.abort(); }
      if (u.origin !== origin) { report.blockedExternal.push(u.href); return route.abort(); }
      let target = path.resolve(source, '.' + decodeURIComponent(u.pathname));
      assert.ok(target === source || target.startsWith(source + path.sep));
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!fs.existsSync(target)) { missing.push(u.pathname); return route.fulfill({ status:404, body:'Missing local fixture' }); }
      return route.fulfill({ body:fs.readFileSync(target), contentType:types[path.extname(target)] || 'application/octet-stream' });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); page.on('download', () => report.downloads++);
    const reset = async () => { await page.goto(url, { waitUntil:'load' }); await settle(page, javaScriptEnabled); };
    await reset(); return { context, page, url, reset, errors, missing, intercepted, javaScriptEnabled };
  }
  async function screenshot(test, name, full = false) {
    await test.page.bringToFront(); await settle(test.page, test.javaScriptEnabled);
    return test.page.screenshot({ path:path.join(out, name + '.png'), animations:'allow', ...(full ? {} : { clip:{ x:0, y:0, width:test.page.viewportSize().width, height:96 } }) });
  }
  async function keyboard(test, file, width) {
    const page = test.page, keys = [], tabs = [];
    await test.reset(); await page.keyboard.press('Tab');
    assert.equal(await page.locator('#tront-theme-btn').evaluate(element => document.activeElement === element), true, 'first native Tab reaches theme');
    assert.equal(await page.getByRole('button', { name:'Cycle color theme', exact:true }).count(), 1);
    for (const key of ['Enter', 'Space']) for (let index = 1; index <= 5; index++) {
      await page.keyboard.press(key); await settle(page, test.javaScriptEnabled);
      const theme = await page.locator('html').getAttribute('data-theme') || 'dark';
      assert.equal(theme, test.javaScriptEnabled ? themes[index % 5] : 'dark');
      keys.push({ key, theme });
    }
    for (const href of hubs) {
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const element = document.activeElement, style = getComputedStyle(element);
        return { href:element.getAttribute('href'), visible:element.matches(':focus-visible'), outline:style.outlineStyle, outlineWidth:parseFloat(style.outlineWidth) };
      });
      assert.equal(focus.href, href); assert.equal(focus.visible, true); assert.notEqual(focus.outline, 'none'); assert.ok(focus.outlineWidth > 0); tabs.push(focus);
    }
    await screenshot(test, `legacy-navbar-${file.split('/')[0]}-${width}-${test.javaScriptEnabled ? 'js' : 'nojs'}-focus`);
    for (let index = 0; index < hubs.length; index++) {
      await test.reset();
      for (let step = 0; step < index + 2; step++) await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), hubs[index]);
      const count = test.intercepted.length;
      await Promise.all([page.waitForURL(origin + hubs[index]), page.keyboard.press('Enter')]);
      assert.equal(await page.title(), 'Intercepted navbar destination');
      assert.equal(test.intercepted.length, count + 1); assert.equal(test.intercepted.at(-1), origin + hubs[index]);
    }
    await test.reset(); await page.reload({ waitUntil:'load' }); await settle(page, test.javaScriptEnabled); readable(await page.evaluate(measure));
    assert.deepEqual(test.intercepted, hubs.map(href => origin + href));
    return { file, width, javaScriptEnabled:test.javaScriptEnabled, keys, tabs, nativeEnterDestinations:test.intercepted, directRouteAndReload:true };
  }
  const clean = test => { assert.deepEqual(test.errors, []); assert.deepEqual(test.missing, []); };
  try {
    for (const file of files) for (const width of widths) {
      const before = await open(baseline, file, width), after = await open(root, file, width);
      const baselineHasFix = report.source.find(source => source.file === file).baselineHasFix;
      for (const theme of themes) {
        await Promise.all([settle(before.page, true), settle(after.page, true)]);
        const b = await before.page.evaluate(measure), a = await after.page.evaluate(measure);
        assert.equal(a.theme, theme); assert.equal(b.theme, theme); readable(a);
        if (baselineHasFix) readable(b);
        const gridProof = file === grid.file ? grid.compare(await before.page.evaluate(grid.measure), await after.page.evaluate(grid.measure), fs.readFileSync(path.join(baseline, file), 'utf8'), fs.readFileSync(path.join(root, file), 'utf8'), b, a) : { expected:b, reflow:0, correctedOverflow:false };
        const expected = gridProof.expected;
        assert.deepEqual(a.heading, b.heading, 'heading appearance and geometry unchanged');
        assert.deepEqual(a.primaryControls, expected.primaryControls, 'primary action appearance and geometry unchanged except exact grid reflow below features');
        assert.deepEqual(a.nav.rect, b.nav.rect, 'outer navbar geometry unchanged');
        assert.equal(a.scrollWidth, expected.scrollWidth, 'only the exact SnapScan grid overflow correction may differ');
        assert.deepEqual(a.fonts, b.fonts, 'authentic page font state unchanged');
        if (width > 600 || baselineHasFix) assert.deepEqual(a, expected, 'desktop or already-fixed baseline geometry is exact apart from proven grid reflow');
        const name = `legacy-navbar-${file.split('/')[0]}-${width}-${theme}`;
        const imageBefore = await screenshot(before, name + '-nav-before'), imageAfter = await screenshot(after, name + '-nav-after');
        let pixelProof = { pixelIdentical:imageAfter.equals(imageBefore), firstRowChangedPixels:0, maxChannelDelta:0 };
        if (width > 600 || baselineHasFix) {
          const original = PNG.sync.read(imageBefore), candidate = PNG.sync.read(imageAfter);
          const changed = [], rows = new Set(); let maxDelta = 0;
          assert.equal(original.width, candidate.width); assert.equal(original.height, candidate.height);
          for (let pixel=0; pixel<original.width*original.height; pixel++) {
            const delta = [0,1,2,3].map(channel=>Math.abs(original.data[pixel*4+channel]-candidate.data[pixel*4+channel]));
            if (delta.some(Boolean)) { changed.push({x:pixel%original.width,y:Math.floor(pixel/original.width),delta});rows.add(Math.floor(pixel/original.width));maxDelta=Math.max(maxDelta,...delta); }
          }
          report.pixelDiagnostics.push({file,width,theme,changedPixels:changed.length,maxDelta,rows:[...rows],changed});
          try { pixelProof = grid.pixelParity(original, candidate, {file,width,reflow:gridProof.correctedOverflow ? gridProof.reflow : 0}); }
          catch (error) { report.pixelFailures.push({file,width,theme,error:error.message}); }
        }
        const diagnostics = [];
        if (theme === 'dark' && [320, 390, 1440].includes(width)) {
          for (const [version, test] of [['before', before], ['after', after]]) {
            const diagnostic = name + '-viewport-' + version; await screenshot(test, diagnostic, true); diagnostics.push(diagnostic + '.png');
          }
        }
        assert.equal(await after.page.getByRole('button', { name:'Cycle color theme', exact:true }).count(), 1);
        report.cases.push({ file, width, theme, baselineHasFix, candidate:a, baseline:b, accessibleName:'Cycle color theme',
          labelsReadable:true, unchangedPrimarySizeAndStyle:true, gridReflowPx:gridProof.reflow, correctedGridOverflow:gridProof.correctedOverflow, preExistingDocumentOverflowPx:Math.max(0, a.scrollWidth - width), pixelGateRequired:width > 600 || baselineHasFix, ...pixelProof, screenshots:[name + '-nav-before.png', name + '-nav-after.png'], diagnosticScreenshots:diagnostics });
        // Use native keys rather than script-injected palette state or mouse hover.
        for (const test of [before, after]) { await test.page.locator('#tront-theme-btn').focus(); await test.page.keyboard.press('Enter'); }
      }
      report.keyboard.push(await keyboard(after, file, width)); clean(before); clean(after);
      await before.context.close(); await after.context.close(); console.log('PASS legacy navbar', file, width, 'all five themes');
    }
    for (const file of files) for (const width of []) {
      const before = await open(baseline, file, width, false), test = await open(root, file, width, false);
      const b = await before.page.evaluate(measure), a = await test.page.evaluate(measure); readable(a);
      const gridProof = file === grid.file ? grid.compare(await before.page.evaluate(grid.measure), await test.page.evaluate(grid.measure), fs.readFileSync(path.join(baseline, file), 'utf8'), fs.readFileSync(path.join(root, file), 'utf8'), b, a) : { expected:b, reflow:0, correctedOverflow:false };
      assert.equal(a.scrollWidth, gridProof.expected.scrollWidth, 'no-JS overflow only changes by the exact grid correction');
      assert.deepEqual(a.nav.rect, b.nav.rect, 'no-JS outer navbar geometry unchanged');
      assert.deepEqual(a.heading, b.heading, 'no-JS heading geometry unchanged');
      assert.deepEqual(a.primaryControls, gridProof.expected.primaryControls, 'no-JS primary actions only shift by exact grid reflow');
      report.noScript.push({ ...await keyboard(test, file, width), documentScrollWidth:{ baseline:b.scrollWidth, candidate:a.scrollWidth },
        navbarScrollWidth:a.navScrollWidth, gridReflowPx:gridProof.reflow, correctedGridOverflow:gridProof.correctedOverflow, preExistingDocumentOverflowPx:Math.max(0, a.scrollWidth - width) });
      clean(before); clean(test); await before.context.close(); await test.context.close();
      console.log('PASS legacy navbar no-JS', file, width);
    }
    assert.equal(report.cases.length, files.length * widths.length * themes.length);
    assert.equal(report.interceptedDestinations.length, files.length * widths.length * hubs.length);
    assert.equal(report.runtimeRequests, 0); assert.equal(report.downloads, 0);
    assert.deepEqual(report.pixelFailures, [], 'all five exact existing pixel gates must pass; diagnostic collection never waives a failure'); report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = error.stack; throw error; }
  finally {
    report.durationMs = Date.now() - started;
    fs.writeFileSync(path.join(out, 'legacy-navbar-report.json'), JSON.stringify(report, null, 2)); await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
