const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/trontstack/tmp/card-refresh/tools/node_modules/playwright');
const {createServer,root} = require('./server.cjs');
const results=[];
const check=(name,value,detail)=>{assert.ok(value,name+' '+JSON.stringify(detail||''));results.push({name,detail});console.log('PASS',name,detail?JSON.stringify(detail):'');};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function state(page){return page.evaluate(()=>({attached:document.querySelectorAll('.gameplay-preview[src]').length,playing:[...document.querySelectorAll('.gameplay-preview')].filter(v=>!v.paused).length,visible:[...document.querySelectorAll('.gameplay-preview')].every(v=>{const r=v.getBoundingClientRect();return r.bottom>64&&r.top<innerHeight&&r.width>0;}),sources:[...document.querySelectorAll('.gameplay-preview')].map(v=>v.getAttribute('src')),stats:[...document.querySelectorAll('.gameplay-preview')].map(v=>({time:v.currentTime,total:v.getVideoPlaybackQuality().totalVideoFrames,dropped:v.getVideoPlaybackQuality().droppedVideoFrames}))}));}
async function context(browser,options={}){
 const c=await browser.newContext({viewport:{width:1440,height:1000},...options});
 await c.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.fulfill({status:200,contentType:'application/json',body:r.request().url().includes('discord.com')?'{}':''}));
 return c;
}
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(8967,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const c=await context(browser),page=await c.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.goto('http://127.0.0.1:8967/games/');await page.waitForTimeout(600);
  check('Demigod remains the first card',await page.locator('.grid .item .card-title').first().innerText().then(t=>t.startsWith('Project Demigod')));
  check('Gallery does not request GIFs',!requests.some(u=>/\.gif(?:\?|$)/.test(u)));
  check('Initial video sources stay bounded and visible',(await state(page)).attached<=12&&(await state(page)).visible);
  await page.locator('[data-preview]').first().scrollIntoViewIfNeeded();await page.waitForTimeout(2200);
  let s=await state(page);check('Desktop starts autoplay without hover and caps it at twelve',s.playing>0&&s.attached<=12&&s.visible,s);
  check('Decoded video advances',s.stats.some(v=>v.total>5&&v.time>0),s.stats);
  const first=s.sources;
  await page.waitForTimeout(7000);s=await state(page);
  check('All eligible visible previews keep playing within the desktop limit',s.playing>0&&s.attached<=12,s);
  await page.screenshot({path:path.join(root,'.local/gallery-desktop.png')});
  let maxAttached=0,maxPlaying=0;
  for(let y=0;y<16000;y+=700){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(65);s=await state(page);maxAttached=Math.max(maxAttached,s.attached);maxPlaying=Math.max(maxPlaying,s.playing);assert.ok(s.attached<=12&&s.playing<=12);}
  check('Rapid full-gallery scrolling keeps the video pool bounded',maxAttached<=12&&maxPlaying<=12,{maxAttached,maxPlaying});
  await page.locator('[data-preview]').first().scrollIntoViewIfNeeded();await page.waitForTimeout(500);
  await page.evaluate(()=>document.getElementById('filter-mod').click());await page.waitForTimeout(300);
  const filtered=await page.evaluate(()=>[...document.querySelectorAll('.gameplay-preview[src]')].map(v=>({source:v.getAttribute('src'),matches:v.closest('.item').classList.contains('tag-mod'),visible:v.getBoundingClientRect().width>0})));
  check('Filtering releases hidden cards and keeps only matching footage',filtered.every(v=>v.matches&&v.visible)&&filtered.length<=12,filtered);
  const animatedMod=page.locator('.item.tag-mod [data-preview]').first();
  if(await animatedMod.count()){
   await animatedMod.scrollIntoViewIfNeeded();await page.waitForTimeout(900);
   check('An animated mod plays after filtering',await animatedMod.locator('video').evaluateAll(v=>v.some(x=>!x.paused&&x.currentTime>0)));
  }
  await page.evaluate(()=>document.getElementById('filter-all').click());await page.locator('[data-preview]').first().scrollIntoViewIfNeeded();await page.waitForTimeout(500);
  await page.evaluate(()=>document.getElementById('preview-toggle').click());await page.waitForTimeout(150);
  check('Pause control releases every video source',(await state(page)).attached===0);
  await page.reload();await page.locator('[data-preview]').first().scrollIntoViewIfNeeded();await page.waitForTimeout(500);
  check('Pause preference survives reload',(await state(page)).attached===0&&await page.locator('#preview-toggle').innerText()==='Play previews');
  await page.evaluate(()=>document.getElementById('preview-toggle').click());await page.waitForTimeout(500);
  // Emulate hidden visibility to exercise the same handler used by tab switching.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  check('Hidden tab releases every video source',(await state(page)).attached===0);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(500);
  check('Returning to the tab resumes eligible previews',(await state(page)).playing>0);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);
  check('Changing reduced motion stops playback',(await state(page)).attached===0);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(500);
  check('Returning to normal motion resumes playback',(await state(page)).playing>0);
  const images=await page.evaluate(async()=>{const imgs=[...document.querySelectorAll('.grid .bg-image')];return Promise.all(imgs.map(async i=>{try{i.loading='eager';await Promise.race([i.decode(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Decode timeout')),15000))]);return {src:i.getAttribute('src'),ok:i.naturalWidth>0};}catch{return {src:i.getAttribute('src'),ok:false};}}));});
  check('Every card poster decodes',images.every(i=>i.ok),{count:images.length,broken:images.filter(i=>!i.ok)});
  check('No page JavaScript errors',errors.length===0,errors);
  await c.close();

  const wide=await context(browser,{viewport:{width:2560,height:1440}}),wp=await wide.newPage();
  const media=await wide.newCDPSession(wp),decoders={};await media.send('Media.enable');
  media.on('Media.playerPropertiesChanged',e=>{for(const p of e.properties)if(/decoder|resolution|codec/i.test(p.name)){(decoders[e.playerId]??={})[p.name]=p.value;}});
  await wp.goto('http://127.0.0.1:8967/games/');await wp.locator('[data-preview]').first().scrollIntoViewIfNeeded();await wp.waitForTimeout(2000);
  const wideBefore=await state(wp);await wp.waitForTimeout(5000);const wideAfter=await state(wp);
  const frames=wideAfter.stats.reduce((n,v,i)=>n+v.total-(wideBefore.stats[i]?.total||0),0),drops=wideAfter.stats.reduce((n,v,i)=>n+v.dropped-(wideBefore.stats[i]?.dropped||0),0);
  check('A large desktop runs more than three previews within the twelve-slot cap',wideAfter.playing>3&&wideAfter.attached<=12&&wideAfter.visible,wideAfter);
  check('Expanded desktop playback advances with fewer than ten percent dropped frames',frames>300&&drops/frames<.10,{frames,drops,dropPercent:100*drops/frames});
  fs.writeFileSync(path.join(root,'.local/gallery-playback-load.json'),JSON.stringify({before:wideBefore,after:wideAfter,frames,drops,dropPercent:100*drops/frames,decoders},null,2));
  await wp.screenshot({path:path.join(root,'.local/gallery-wide.png')});await wide.close();

  const mobile=await context(browser,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});const mp=await mobile.newPage();
  await mp.goto('http://127.0.0.1:8967/games/');await mp.locator('[data-preview]').first().scrollIntoViewIfNeeded();await mp.waitForTimeout(1500);
  s=await state(mp);check('Mobile autoplays up to two previews',s.playing>0&&s.playing<=2&&s.attached<=2,s);
  check('Mobile has no horizontal overflow',await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mp.screenshot({path:path.join(root,'.local/gallery-mobile.png')});await mobile.close();

  const low=await context(browser,{viewport:{width:1920,height:1080}});await low.addInitScript(()=>Object.defineProperty(navigator,'deviceMemory',{value:4}));const lp=await low.newPage();
  await lp.goto('http://127.0.0.1:8967/games/#preview-slopeloop-2026');await lp.waitForTimeout(1200);
  const target=await lp.evaluate(()=>[...document.querySelectorAll('[data-preview]')].find(c=>{const r=c.getBoundingClientRect();return !c.querySelector('video')&&r.top>=64&&r.bottom<=innerHeight;})?.id);
  assert.ok(target,'There is a visible waiting card for the hover test');
  await lp.locator('#'+target).hover();await lp.waitForTimeout(600);
  check('Hover immediately prioritizes a waiting preview',await lp.locator('#'+target+'.preview-playing').count()===1&&(await state(lp)).attached<=4);
  await lp.mouse.move(0,0);await lp.locator('#'+target).evaluate(c=>c.closest('a').focus());await lp.waitForTimeout(300);
  check('Keyboard focus prioritizes previews too',await lp.locator('#'+target+'.preview-playing').count()===1);await low.close();

  const reduced=await context(browser,{reducedMotion:'reduce'});const rp=await reduced.newPage(),reducedRequests=[];rp.on('request',r=>reducedRequests.push(r.url()));
  await rp.goto('http://127.0.0.1:8967/games/');await rp.locator('[data-preview]').first().scrollIntoViewIfNeeded();await rp.waitForTimeout(500);
  check('Reduced motion makes no video requests',!reducedRequests.some(u=>new URL(u).pathname.endsWith('.mp4'))&&(await state(rp)).attached===0);await reduced.close();

  const saver=await context(browser);await saver.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true,addEventListener(){}}}));const sp=await saver.newPage();
  await sp.goto('http://127.0.0.1:8967/games/');await sp.locator('[data-preview]').first().scrollIntoViewIfNeeded();await sp.waitForTimeout(400);
  check('Data saver keeps posters only',(await state(sp)).attached===0);await saver.close();

  const blocked=await context(browser);await blocked.addInitScript(()=>HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Autoplay blocked','NotAllowedError'));});const bp=await blocked.newPage();
  await bp.goto('http://127.0.0.1:8967/games/');await bp.locator('[data-preview]').first().scrollIntoViewIfNeeded();await bp.waitForTimeout(600);
  check('Blocked autoplay falls back to posters without retry storms',(await state(bp)).attached===0&&await bp.locator('.preview-playing').count()===0);await blocked.close();

  const nojs=await context(browser,{javaScriptEnabled:false});const np=await nojs.newPage();await np.goto('http://127.0.0.1:8967/games/');
  check('No JavaScript still shows usable cards',await np.locator('.grid .item').first().isVisible()&&await np.locator('video').count()===0);await nojs.close();
  fs.writeFileSync(path.join(root,'.local/gallery-verification.json'),JSON.stringify({at:new Date().toISOString(),results},null,2));
  console.log('COMPLETE all '+results.length+' gallery checks passed');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
