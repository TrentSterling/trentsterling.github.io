'use strict';
// Exact source at its intended route; all other navigation and external services
// are intercepted. This gate never fetches a game runtime or download.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const { chromium, webkit, request } = require('playwright');
const { PNG } = require('pngjs');
const contract = require('./games-md.cjs');
const root = path.resolve(__dirname, '../..');
assert.ok(process.env.THEME_BASELINE_ROOT, 'the actual PR base is required');
const baseline = path.resolve(process.env.THEME_BASELINE_ROOT);
const out = path.resolve(process.env.THEME_SCREENSHOTS || '.local/theme-review'); fs.mkdirSync(out, { recursive: true });
const origin = 'https://tront.xyz', routePath = '/games/md/';
const themes = ['dark', 'tront-cyan', 'tront-purple', 'tront-ember', 'light'];
const themeLabels = ['Dark', 'Cyan', 'Purple', 'Ember', 'Light'];
const widths = [320, 360, 361, 390, 700, 701, 1440];
const read = (source, file = contract.file) => fs.readFileSync(path.join(source, file), 'utf8');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const candidate = read(root), base = read(baseline), assets = new Map();
contract.assertFixed(candidate);
assert.equal(contract.normalize(candidate, contract.file), contract.normalize(base, contract.file));
const report = { status:'running', widths, themes, cases:[], noScript:[], keyboard:[], negativeControl:[], errors:[], missing:[], blockedExternal:[], interceptedDestinations:[], assets:[], source:{candidate:hash(candidate), baseline:hash(base), rawPortfolio:hash(contract.rawPortfolio(candidate))}, fixture:'Exact checked-out pages/assets and authentic cached fonts. External card imagery, analytics and Discord API blocked. Full-viewport pixel parity after fonts and finite transitions settle; no first-paint or live-deployment claim.' };
const mime = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml'};
function measure() {
  const rect = r => ({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height});
  const appearance = e => { const s=getComputedStyle(e); return {box:rect(e.getBoundingClientRect()),font:s.font,color:s.color,background:s.background,border:s.border,padding:s.padding}; };
  const nav = document.querySelector('nav');
  return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,theme:document.documentElement.getAttribute('data-theme')||'dark',nav:appearance(nav),
    controls:[...nav.children].map(e => {
      const b=e.getBoundingClientRect(), text=[], walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()) {
        const n=walker.currentNode; if(!n.textContent.trim() || getComputedStyle(n.parentElement).display==='none') continue;
        const range=document.createRange(), glyphs=[]; let offset=0;
        for(const ch of n.textContent) {
          range.setStart(n,offset);offset+=ch.length;range.setEnd(n,offset);if(!ch.trim())continue;
          for(const r of range.getClientRects()) {
            if(!r.width||!r.height)continue;
            const hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
            glyphs.push({character:ch,box:rect(r),inside:r.left>=Math.max(0,b.left)-.1&&r.right<=Math.min(innerWidth,b.right)+.1&&r.top>=Math.max(0,b.top)-.1&&r.bottom<=Math.min(innerHeight,b.bottom)+.1,hit:hit===e||e.contains(hit)});
          }
        }
        if(glyphs.length)text.push({text:n.textContent.trim(),glyphs});
      }
      return {id:e.id,label:e.textContent.trim().replace(/\s+/g,' '),href:e.getAttribute('href'),target:e.getAttribute('target'),appearance:appearance(e),text};
    }),heading:appearance(document.querySelector('h1')),cards:[...document.querySelectorAll('.grid .item')].map(e=>({html:e.innerHTML,href:e.getAttribute('href'),target:e.getAttribute('target')})),fonts:document.fonts.status};
}
function readable(state) {
  assert.equal(state.scrollWidth,state.width,'no page overflow'); assert.equal(state.controls.length,6);
  assert.equal(state.nav.box.height,state.width<=700?102:60);
  assert.deepEqual(state.controls.map(c=>c.href),[null,'https://tront.xyz/discord/','/blog/','#','https://tront.xyz/','javascript:void(0);']);
  assert.deepEqual(state.controls.slice(1).map(c=>c.label),['Discord','Blog','Games','Home','[ DEACTIVATE HACKER MODE ]']);
  assert.equal(state.cards.length,55); assert.equal(state.fonts,'loaded');
  for(const control of state.controls) {
    const b=control.appearance.box;
    assert.equal(b.height,40); assert.ok(b.left>=0&&b.right<=state.width&&b.top>=0&&b.bottom<=state.nav.box.bottom,'visible control '+control.label);
    assert.ok(control.text.length,'visible label '+control.label);
    for(const text of control.text) for(const glyph of text.glyphs) {
      assert.ok(glyph.inside,'unclipped glyph '+control.label+' '+glyph.character);
      assert.ok(glyph.hit,'hit-testable glyph '+control.label+' '+glyph.character);
    }
  }
  assert.ok(state.controls[0].text.some(t=>t.text===themeLabels[themes.indexOf(state.theme)]),'visible current theme name');
  const visual=[...state.controls].sort((a,b)=>a.appearance.box.top-b.appearance.box.top||a.appearance.box.left-b.appearance.box.left);
  assert.deepEqual(visual.map(c=>c.id||c.label),['js-toggle-button-nav','Home','Games','Blog','Discord','tront-theme-btn'],'visual reading order unchanged');
}
(async()=>{
  if(process.env.NAV_FONT_CACHE) for(const [url,item] of Object.entries(JSON.parse(fs.readFileSync(process.env.NAV_FONT_CACHE)))) {
    const body=fs.readFileSync(item.file); if(item.sha256)assert.equal(hash(body),item.sha256);assets.set(url,{body,contentType:item.contentType});
  }
  const client=await request.newContext({timeout:20000});
  async function cache(url,contentType) { if(assets.has(url))return; const response=await client.get(url);assert.equal(response.status(),200,url);assets.set(url,{body:await response.body(),contentType:contentType||response.headers()['content-type']}); }
  const fontUrl=candidate.match(/href="(https:\/\/fonts.googleapis.com\/css2[^"]+)"/)[1];
  await cache(fontUrl,'text/css');
  for(const match of assets.get(fontUrl).body.toString().matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))await cache(match[1]);
  await client.dispose();
  for(const [url,item] of assets)report.assets.push({url,sha256:hash(item.body)});
  const logo=fs.readFileSync(process.env.NAV_BLOG_LOGO||path.join(root,'blog/assets/img/tront.png'));
  assert.equal(hash(logo),'ea975fdd6f2c6f4e2c948b84daf15b6f52e0d36ad84e580350cb894a0ad096f8');
  const browser=await(process.env.NAV_BROWSER==='webkit'?webkit:chromium).launch({headless:true,executablePath:process.env.NAV_BROWSER_EXECUTABLE||process.env.THEME_BROWSER_EXECUTABLE||undefined});
  async function settle(page) { await page.mouse.move(0,110);if(page.__noScript)return;await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));}); }
  async function open(source,width,js=true,negative=false) {
    const context=await browser.newContext({viewport:{width,height:900},javaScriptEnabled:js,reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:false});
    await context.route('**/*',r=>{
      const u=new URL(r.request().url()); if(assets.has(u.href))return r.fulfill(assets.get(u.href));
      if(r.request().isNavigationRequest()&&u.href!==origin+routePath&&u.href!==origin+routePath+'#') {report.interceptedDestinations.push(u.href);return r.fulfill({body:'<!doctype html><title>Inert destination</title>',contentType:'text/html'});}
      if(u.origin!==origin){report.blockedExternal.push(u.href);return r.abort();}
      if(/\/play\/|\.(wasm|mp4|webm|exe|zip)$/.test(u.pathname))throw new Error('out-of-scope runtime request '+u.pathname);
      if(u.pathname==='/blog/assets/img/tront.png')return r.fulfill({body:logo,contentType:'image/png'});
      let file=path.resolve(source,'.'+decodeURIComponent(u.pathname));assert.ok(file.startsWith(source+path.sep));
      if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
      if(!fs.existsSync(file)){report.missing.push(u.pathname);return r.fulfill({status:404,body:''});}
      let body=fs.readFileSync(file);if(negative&&path.relative(source,file)===contract.file)body=Buffer.from(contract.normalize(body.toString(),contract.file));
      return r.fulfill({body,contentType:mime[path.extname(file)]||'application/octet-stream'});
    });
    const page=await context.newPage();page.__noScript=!js;page.on('pageerror',e=>report.errors.push(e.message));page.on('download',()=>{throw new Error('unexpected download')});
    await page.goto(origin+routePath,{waitUntil:'load'});await settle(page);return {page,context};
  }
  async function initial(page,js) {
    const state=await page.evaluate(()=>({opacity:getComputedStyle(document.body).opacity,scrollWidth:document.documentElement.scrollWidth,width:innerWidth,button:getComputedStyle(document.querySelector('#js-toggle-button')).display,main:getComputedStyle(document.querySelector('.main-container')).display,raw:document.querySelector('#portfolio-data').textContent,mode:document.body.className}));
    assert.equal(state.opacity,'1');assert.equal(state.scrollWidth,state.width);assert.equal(state.main,'none');assert.deepEqual(state.mode.split(' ').sort(),js?['js-inactive','loaded']:['js-inactive']);
    assert.equal(state.button,js?'block':'none');// HTML parsing removes the one newline immediately after an opening pre.
    assert.equal(state.raw,contract.rawPortfolio(candidate).replace(/^\n/,''));return state;
  }
  async function activate(page) {await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'js-toggle-button');await page.keyboard.press('Enter');await settle(page);}
  async function focus(page,id) {
    const result=await page.evaluate(()=>{const e=document.activeElement,r=e.getBoundingClientRect(),s=getComputedStyle(e);return{id:e.id,tag:e.tagName,text:e.textContent.trim(),visible:r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,focusVisible:e.matches(':focus-visible'),outline:s.outlineStyle,outlineWidth:parseFloat(s.outlineWidth)};});
    if(id)assert.equal(result.id,id);assert.ok(result.visible);assert.ok(result.focusVisible);assert.notEqual(result.outline,'none');assert.ok(result.outlineWidth>0);return result;
  }
  async function shot(page,name) {await settle(page);return page.screenshot({path:path.join(out,'games-md-'+name+'.png'),animations:'disabled'});}
  async function parity(before,after,name) {
    for(const p of [before,after])await p.evaluate(()=>document.activeElement.blur());
    const a=PNG.sync.read(await shot(before,name+'-before')),b=PNG.sync.read(await shot(after,name+'-after'));
    assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert.deepEqual(b.data,a.data,'settled desktop pixels '+name);
  }
  try {
    for(const width of widths) {
      const before=await open(baseline,width),after=await open(root,width);
      await initial(after.page,true);
      if(width===1440)await parity(before.page,after.page,width+'-raw');
      await activate(before.page);await activate(after.page);await focus(after.page,'js-toggle-button-nav');
      for(let index=0;index<themes.length;index++) {
        await Promise.all([settle(before.page),settle(after.page)]);
        const a=await after.page.evaluate(measure),b=await before.page.evaluate(measure);readable(a);assert.equal(a.theme,themes[index]);assert.deepEqual(a.cards,b.cards,'every rendered card and destination stays exact');
        const record={width,theme:a.theme,readable:true,cards:a.cards.length,nav:a.nav,controls:a.controls};report.cases.push(record);
        if(width>700) {assert.deepEqual(a,b,'unchanged desktop geometry/styles/text');await parity(before.page,after.page,width+'-'+a.theme);record.pixelIdentical=true;}
        else if([320,390,700].includes(width))await shot(after.page,width+'-'+a.theme);
        for(const page of [before.page,after.page]) {await page.locator('#tront-theme-btn').focus();await page.keyboard.press(index%2?'Space':'Enter');}
      }
      if([320,390,1440].includes(width)) {
        await after.page.reload({waitUntil:'load'});await settle(after.page);await initial(after.page,true);await activate(after.page);
        const steps=[await focus(after.page,'js-toggle-button-nav')];
        for(let i=0;i<5;i++){await after.page.keyboard.press('Shift+Tab');steps.push(await focus(after.page));}
        await focus(after.page,'tront-theme-btn');
        for(let i=0;i<5;i++){await after.page.keyboard.press(i%2?'Enter':'Space');await settle(after.page);const state=await after.page.evaluate(measure);assert.equal(state.theme,themes[(i+1)%5]);readable(state);}
        for(let i=0;i<5;i++){await after.page.keyboard.press('Tab');steps.push(await focus(after.page));}
        await focus(after.page,'js-toggle-button-nav');
        for(let i=0;i<2;i++){await after.page.keyboard.press('Enter');steps.push(await focus(after.page,'js-toggle-button'));await initial(after.page,true);await after.page.keyboard.press('Space');steps.push(await focus(after.page,'js-toggle-button-nav'));readable(await after.page.evaluate(measure));}
        report.keyboard.push({width,directReload:true,nativeEnterSpace:true,repeatedModeSwitches:2,steps});await shot(after.page,width+'-keyboard');
      }
      await before.context.close();await after.context.close();
    }
    for(const width of [320,390,1440]) {
      const test=await open(root,width,false);await initial(test.page,false);await shot(test.page,width+'-nojs');await test.page.reload({waitUntil:'load'});await settle(test.page);await initial(test.page,false);report.noScript.push({width,visibleRaw:true,inertButtonHidden:true,directReload:true});await test.context.close();
    }
    // The historical defects stay executable even when the actual base is fixed.
    for(const js of [false,true]) {
      const test=await open(baseline,320,js,true);
      const state=await test.page.evaluate(()=>({opacity:getComputedStyle(document.body).opacity,scrollWidth:document.documentElement.scrollWidth}));
      if(!js)assert.equal(state.opacity,'0');
      else {
        assert.ok(state.scrollWidth>320);await activate(test.page);const old=await test.page.evaluate(measure);assert.ok(old.controls.some(c=>c.appearance.box.left<0||c.appearance.box.right>320));
        await test.page.locator('#js-toggle-button-nav').focus();await test.page.keyboard.press('Enter');await settle(test.page);assert.notEqual(await test.page.evaluate(()=>document.activeElement.id),'js-toggle-button');
      }
      report.negativeControl.push({js,...state,defectsReproduced:true});await test.context.close();
    }
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.status='passed';
  } finally {fs.writeFileSync(path.join(out,'games-md-report.json'),JSON.stringify(report,null,2));await browser.close();}
  console.log('PASS: legacy portfolio fallback, all six labels, exact 55 cards, keyboard modes/themes, direct/reload, breakpoint edges and settled desktop parity.');
})().catch(error=>{report.status='failed';report.error=error.stack;fs.writeFileSync(path.join(out,'games-md-report.json'),JSON.stringify(report,null,2));console.error(error);process.exitCode=1;});
