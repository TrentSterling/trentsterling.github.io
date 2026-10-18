'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium, webkit } = require('playwright');
const { file, rule, normalize, assertFixed } = require('./ducktoy-fallback.cjs');
const root = path.resolve(__dirname, '../..'), base = process.env.THEME_BASELINE_ROOT;
assert.ok(base, 'actual PR baseline required');
const out = process.env.THEME_SCREENSHOTS || path.join(root, '.local/theme-review');
fs.mkdirSync(out, { recursive:true });
const origin = 'https://tront.xyz', routePath = '/ducktoy/';
const html = fs.readFileSync(path.join(root, file), 'utf8'); assertFixed(html);
const report = { status:'running', cases:[], errors:[], missing:[], blocked:[], destinations:[], runtimeRequests:0, downloads:0 };
const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.png':'image/png' };
function measure() {
  const rect = element => { const r = element.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height }; };
  return { width:innerWidth, scrollWidth:document.documentElement.scrollWidth,
    bodyText:document.querySelector('main').innerText, main:rect(document.querySelector('main')), footer:rect(document.querySelector('footer')),
    nav:rect(document.querySelector('nav')), theme:document.documentElement.getAttribute('data-theme') || 'dark',
    button:{ ...rect(document.getElementById('tront-theme-btn')), display:getComputedStyle(document.getElementById('tront-theme-btn')).display },
    links:[...document.querySelectorAll('nav a')].map(e => ({ text:e.innerText, href:e.getAttribute('href'), ...rect(e) })) };
}
async function open(browser, source, width, js, control = false) {
  const context = await browser.newContext({ viewport:{ width,height:900 }, javaScriptEnabled:js, reducedMotion:'reduce', serviceWorkers:'block', acceptDownloads:false });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { report.blocked.push(url.href); return route.abort(); }
    if (/\/play\/|\.(?:mp4|webm|wasm|exe|zip)$/.test(url.pathname)) { report.runtimeRequests++; return route.abort(); }
    if (request.isNavigationRequest() && url.pathname !== routePath) { report.destinations.push(url.href); return route.fulfill({ contentType:'text/html', body:'<title>Intercepted destination</title>' }); }
    const rel = decodeURIComponent(url.pathname).slice(1) + (url.pathname.endsWith('/') ? 'index.html' : '');
    const target = path.resolve(source, rel); assert.ok(target.startsWith(path.resolve(source) + path.sep));
    if (!fs.existsSync(target)) { report.missing.push(rel); return route.fulfill({ status:404, body:'Missing fixture resource' }); }
    const data = control && rel === file ? normalize(html, file) : fs.readFileSync(target);
    return route.fulfill({ body:data, contentType:mime[path.extname(target)] || 'application/octet-stream' });
  });
  const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message)); page.on('download', () => report.downloads++);
  await page.goto(origin + routePath, { waitUntil:'load' });
  return { context,page };
}
function readable(state) {
  assert.equal(state.scrollWidth, state.width);
  assert.deepEqual(state.links.map(a => [a.text,a.href]), [['Discord','/discord/'],['Blog','/blog/'],['Games','/games/'],['Home','/']]);
  for (const a of state.links) { assert.ok(a.x >= 0 && a.x+a.width <= state.width); assert.ok(a.height >= 40); }
}
(async () => {
  const engine = process.env.NAV_BROWSER === 'webkit' ? webkit : chromium;
  const browser = await engine.launch({ headless:true, executablePath:process.env.NAV_BROWSER_EXECUTABLE || process.env.THEME_BROWSER_EXECUTABLE || undefined });
  try {
    for (const width of [320,390,1440]) for (const js of [true,false]) {
      const before = await open(browser, base, width, js), after = await open(browser, root, width, js);
      const id = `ducktoy-${width}-${js ? 'js' : 'nojs'}`;
      try {
        const bp = await before.page.screenshot({ path:path.join(out,id+'-before.png'), animations:'disabled' });
        const ap = await after.page.screenshot({ path:path.join(out,id+'-after.png'), animations:'disabled' });
        const b = await before.page.evaluate(measure), a = await after.page.evaluate(measure); readable(a);
        assert.deepEqual(a.main,b.main); assert.deepEqual(a.footer,b.footer); assert.deepEqual(a.nav,b.nav); assert.equal(a.bodyText,b.bodyText);
        if (js) { assert.deepEqual(a,b); assert.deepEqual(ap,bp,'JavaScript rendering remains pixel-identical'); assert.equal(a.button.display,'flex'); }
        else assert.equal(a.button.display,'none');
        // Start from native initial Tab order, including the existing skip link.
        await after.page.keyboard.press('Tab'); assert.equal(await after.page.evaluate(() => document.activeElement.className),'skip-link');
        await after.page.keyboard.press('Tab');
        if (js) {
          assert.equal(await after.page.evaluate(() => document.activeElement.id),'tront-theme-btn');
          for (const [index,theme] of ['tront-cyan','tront-purple','tront-ember','light','dark'].entries()) {
            await after.page.keyboard.press(index % 2 ? 'Space' : 'Enter');
            assert.equal(await after.page.locator('html').getAttribute('data-theme') || 'dark',theme);
          }
          await after.page.keyboard.press('Tab');
        }
        const tabs=[];
        for (const href of ['/discord/','/blog/','/games/','/']) {
          assert.equal(await after.page.evaluate(() => document.activeElement.getAttribute('href')),href);
          assert.equal(await after.page.evaluate(() => document.activeElement.matches(':focus-visible')),true);
          tabs.push(href); await after.page.keyboard.press('Tab');
        }
        // Intercept all native link activations; no public destination is visited.
        for (const href of tabs) { await after.page.locator('nav a[href="'+href+'"]').focus(); await Promise.all([after.page.waitForURL(origin+href),after.page.keyboard.press('Enter')]); await after.page.goto(origin+routePath,{waitUntil:'load'}); }
        await after.page.reload({waitUntil:'load'}); readable(await after.page.evaluate(measure));
        assert.equal(await after.page.locator('#tront-theme-btn').isVisible(),js);
        report.cases.push({width,js,readable:true,jsPixelIdentical:js,noScriptHidden:!js,tabs,directAndReload:true});
        console.log('PASS '+id);
      } finally { await before.context.close(); await after.context.close(); }
    }
    const control = await open(browser,root,320,false,true);
    try { const button=control.page.locator('#tront-theme-btn'); assert.equal(await button.isVisible(),true); assert.equal((await button.textContent()).trim(),''); report.defectControl={blankInertButtonReproduced:true}; await control.page.screenshot({path:path.join(out,'ducktoy-control-nojs.png')}); } finally { await control.context.close(); }
    assert.equal(report.cases.length,6); assert.equal(report.destinations.length,24);
    assert.deepEqual(report.errors,[]); assert.deepEqual(report.missing,[]); assert.equal(report.runtimeRequests,0); assert.equal(report.downloads,0);
    report.status='passed';
  } finally { await browser.close(); }
})().catch(error => { report.status='failed'; report.error=error.stack; console.error(error); process.exitCode=1; }).finally(() => fs.writeFileSync(path.join(out,'ducktoy-fallback-report.json'),JSON.stringify(report,null,2)));
