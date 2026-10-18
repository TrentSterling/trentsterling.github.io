'use strict';
// Real page/runtime/media. Network destinations are intercepted; no game execution.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit, request } = require('playwright');
const root = path.resolve(__dirname, '../..');
const baseline = process.env.THEME_BASELINE_ROOT;
assert.ok(baseline, 'actual PR base required');
const output = process.env.THEME_SCREENSHOTS || path.join(root, '.local/theme-review');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', cases: [], browser: process.env.GAMES_TEST_BROWSER || 'chromium' };
const started = Date.now(), origin = 'https://tront.xyz', destination = 'https://github.com/TrentSterling/DungeonGen';
const selector = '.grid a[href="' + destination + '"]';
const clipPath = '/games/media/dungeongen-2013.mp4';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
const cached = process.env.GAMES_FONT_CACHE ? JSON.parse(fs.readFileSync(process.env.GAMES_FONT_CACHE, 'utf8')) : {};
const assets = new Map();
const measure = card => {
  const box = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return { width:r.width,height:r.height,x:r.x, font:s.font,color:s.color,background:s.backgroundColor }; };
  const img = card.querySelector('img');
  return { card:box(card), image:box(img), content:box(card.querySelector('.card-content')), text:card.innerText, href:card.href, target:card.target, poster:img.getAttribute('src'), width:img.naturalWidth, height:img.naturalHeight, index:[...document.querySelectorAll('.grid .item')].indexOf(card), count:document.querySelectorAll('.grid .item').length };
};
(async () => {
  const client = await request.newContext({ timeout: 15000 });
  async function font(url) {
    if (assets.has(url)) return assets.get(url);
    const entry = cached[url]; let asset;
    if (entry) asset = { body:fs.readFileSync(entry.file),contentType:entry.contentType };
    else { const response = await client.get(url); assert.ok(response.ok(), url); asset = {body:await response.body(),contentType:response.headers()['content-type']}; }
    assets.set(url,asset); return asset;
  }
  const cssUrl = fs.readFileSync(path.join(root,'games/index.html'),'utf8').match(/href="(https:\/\/fonts.googleapis.com\/css2[^"\s]+)"/)[1];
  const css = await font(cssUrl);
  for (const m of css.body.toString().matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) await font(m[1]);
  await client.dispose();
  const browser = await (report.browser === 'webkit' ? webkit : chromium).launch({ headless:true, executablePath:process.env.GAMES_BROWSER_EXECUTABLE || process.env.THEME_BROWSER_EXECUTABLE });
  async function open(source,width,{ paused=false,reducedMotion='no-preference',javaScriptEnabled=true,saveData=false,failMedia=false }={}) {
    const context = await browser.newContext({ viewport:{width,height:900},reducedMotion,javaScriptEnabled });
    if (paused) await context.addInitScript(() => { if(localStorage.getItem('tront-previews-paused')===null) localStorage.setItem('tront-previews-paused','true'); });
    if (saveData) await context.addInitScript(() => Object.defineProperty(navigator,'connection',{value:{saveData:true,addEventListener(){}}}));
    const requested=[],errors=[],destinations=[];
    await context.route('**/*',async route => {
      const url = new URL(route.request().url());
      if (assets.has(url.href)) return route.fulfill(assets.get(url.href));
      if (url.href === destination) { destinations.push(url.href); return route.fulfill({contentType:'text/html',body:'Destination intercepted for verification.'}); }
      if (url.hostname === 'discord.com') return route.fulfill({json:{name:'TrontDev',presence_count:0,members:[]}});
      if (url.origin !== origin) return route.abort();
      if (url.pathname.endsWith('.mp4')) requested.push(url.pathname);
      if (failMedia && url.pathname === clipPath) return route.abort('failed');
      let file = path.resolve(source,'.'+decodeURIComponent(url.pathname));
      assert.ok(file.startsWith(path.resolve(source)+path.sep));
      if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
      assert.ok(fs.existsSync(file),'local asset '+url.pathname);
      return route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'});
    });
    const page = await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/games/',{waitUntil:'domcontentloaded'});
    if (javaScriptEnabled) await page.evaluate(()=>document.fonts.ready);
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.waitForFunction(selector=>{const i=document.querySelector(selector+' img');return i.complete&&i.naturalWidth===640;},selector);
    await page.waitForTimeout(500);
    return {context,page,requested,errors,destinations,card:page.locator(selector)};
  }
  async function shot(t,name) { await t.page.screenshot({path:path.join(output,'dungeongen-'+name+'.png')}); }
  async function playing(t) {
    await t.page.waitForFunction(selector=>{const v=document.querySelector(selector+' video');return v&&!v.paused&&v.currentTime>.4&&v.getVideoPlaybackQuality().totalVideoFrames>5;},selector,{timeout:10000});
    const result=await t.card.locator('video').evaluate(v=>({time:v.currentTime,frames:v.getVideoPlaybackQuality().totalVideoFrames,width:v.videoWidth,height:v.videoHeight,duration:v.duration,muted:v.muted,loop:v.loop,inline:v.playsInline,hidden:v.getAttribute('aria-hidden'),tabIndex:v.tabIndex,source:v.getAttribute('src')}));
    assert.equal(result.width,640);assert.equal(result.height,360);assert.equal(result.duration,12);
    assert.equal(result.muted,true);assert.equal(result.loop,true);assert.equal(result.inline,true);assert.equal(result.hidden,'true');assert.equal(result.tabIndex,-1);assert.equal(result.source,clipPath+'?v=15e62358f2e2');
    const count=await t.page.locator('.gameplay-preview[src]').count();assert.ok(count<=(t.page.viewportSize().width<=700?2:12));
    return {...result,attached:count};
  }
  try {
    for(const width of [1440,390,320]) {
      const before=await open(baseline,width,{paused:true}), after=await open(root,width,{paused:true});
      await before.page.bringToFront();await shot(before,'before-'+width);
      await after.page.bringToFront();await shot(after,'poster-'+width);
      assert.deepEqual(await after.card.evaluate(measure),await before.card.evaluate(measure),'poster/copy/geometry '+width);
      const beforePng=await before.card.screenshot({animations:'disabled'}),afterPng=await after.card.screenshot({animations:'disabled'});
      assert.deepEqual(afterPng,beforePng,'exact poster card pixels '+width);
      await before.context.close();
      assert.equal(after.requested.length,0);
      await after.page.evaluate(()=>document.getElementById('preview-toggle').click());
      const playback=await playing(after);await shot(after,'playing-'+width);
      await after.card.focus(); assert.equal(await after.card.evaluate(e=>e===document.activeElement),true);
      const popup=after.page.waitForEvent('popup');await after.page.keyboard.press('Enter');const target=await popup;await target.waitForLoadState('domcontentloaded');assert.equal(target.url(),destination);await target.close();
      assert.deepEqual(after.destinations,[destination]);await after.page.bringToFront();
      await after.page.evaluate(()=>document.getElementById('preview-toggle').click());
      assert.equal(await after.page.locator('.gameplay-preview[src]').count(),0);
      await after.page.reload({waitUntil:'domcontentloaded'});await after.card.scrollIntoViewIfNeeded();await after.page.waitForTimeout(300);
      assert.equal(await after.page.locator('.gameplay-preview[src]').count(),0);assert.equal(await after.page.locator('#preview-toggle').innerText(),'Play previews');
      await after.page.evaluate(()=>document.getElementById('preview-toggle').click());await playing(after);
      await after.page.evaluate(()=>document.getElementById('filter-game').click());await after.page.waitForTimeout(200);assert.equal(await after.card.locator('video').count(),0);
      await after.page.evaluate(()=>document.getElementById('filter-tool').click());await after.card.scrollIntoViewIfNeeded();await playing(after);
      await after.page.locator('h1').scrollIntoViewIfNeeded();await after.page.waitForTimeout(200);assert.equal(await after.card.locator('video').count(),0);
      assert.deepEqual(after.errors,[]);report.cases.push({width,kind:'playback',posterPixelParity:true,playback,keyboardDestination:destination,pauseReload:true,filterRelease:true,offscreenRelease:true});
      await after.context.close();console.log('PASS DungeonGen playback',width);
    }
    for(const [kind,options] of [['reduced-motion',{reducedMotion:'reduce'}],['data-saver',{saveData:true}],['no-js',{javaScriptEnabled:false}],['failed-media',{failMedia:true}]]) {
      const t=await open(root,390,options);await t.page.waitForTimeout(600);
      assert.equal(await t.card.locator('video').count(),0);
      if(kind==='failed-media')assert.ok(t.requested.includes(clipPath));else assert.equal(t.requested.length,0);
      assert.equal(await t.card.locator('img').evaluate(i=>getComputedStyle(i).opacity),'1');
      assert.equal(await t.card.getAttribute('href'),destination);assert.deepEqual(t.errors,[]);
      await shot(t,kind);report.cases.push({kind,width:390,originalPoster:true,clipRequests:t.requested.filter(p=>p===clipPath).length});await t.context.close();console.log('PASS DungeonGen',kind);
    }
    report.status='passed';
  } catch(error) { report.status='failed';report.error=error.stack;throw error; }
  finally { report.durationMs=Date.now()-started;fs.writeFileSync(path.join(output,'dungeongen-preview-report.json'),JSON.stringify(report,null,2)+'\n');await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
