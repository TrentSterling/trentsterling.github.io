#!/usr/bin/env node
'use strict';
// Read-only public-page audit. Browser launch is restricted to approved CI.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { summarize } = require('./summarize.cjs');
const { isIntermediary, applyReadiness } = require('./readiness.cjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(process.env.PAINT_AUDIT_OUTPUT || '.local/paint-audit');
const base = process.env.PAINT_AUDIT_BASE || 'https://tront.xyz';
const routes = process.env.PAINT_AUDIT_ROUTES ? JSON.parse(fs.readFileSync(process.env.PAINT_AUDIT_ROUTES, 'utf8')) : [
  { name: 'home', url: base + '/' }, { name: 'discord', url: base + '/discord/' },
  { name: 'games', url: base + '/games/' }, { name: 'blog', url: base + '/blog/' },
  { name: 'blog-post', url: base + '/blog/posts/trontop/' },
  { name: 'monke', url: 'https://monke.tront.xyz/' }
];
const allowed = new Set(['tront.xyz', 'monke.tront.xyz', '127.0.0.1', 'localhost']);
for (const r of routes) {
  if (!/^[a-z0-9-]+$/.test(r.name) || !allowed.has(new URL(r.url).hostname)) throw Error('Unexpected route: ' + r.name);
}
if (routes.length > 80) throw Error('Shard inventories over 80 routes; do not silently truncate.');
const light = { version: 1, preset: 'light', mode: 'light', count: 4, angle: 135, intensity: 65, frost: 88,
  pegs: ['#75a1ce','#c5c0eb','#efd4b6','#8ec8c3'].map((color,i)=>({color,position:Math.round(i*100/3)})) };
const dark = { ...light, preset: 'cyan', mode: 'dark', pegs: ['#56ccff','#1871b8','#2dd4bf','#99f6e4'].map((color,i)=>({color,position:Math.round(i*100/3)})) };
const variants = [
  { name:'clean-dark-desktop', colorScheme:'dark', width:1440, height:900 },
  { name:'clean-light-mobile', colorScheme:'light', width:390, height:844 },
  { name:'saved-light-desktop', colorScheme:'dark', width:1440, height:900, saved:light },
  { name:'saved-dark-mobile', colorScheme:'light', width:390, height:844, saved:dark }
];
function instrumentation({ saved, legacy, sessionMode }) {
  if (window.top !== window) return;
  try {
    if (!sessionStorage.getItem('__paintAuditSeeded')) {
      if (saved) for (const key of ['tront-theme-editor-v1','tront-theme-gallery-v1','tront-theme-monke-v1']) localStorage.setItem(key, JSON.stringify(saved));
      if (legacy) localStorage.setItem('tront-theme', legacy);
      if (sessionMode) sessionStorage.setItem('mode', sessionMode);
      sessionStorage.setItem('__paintAuditSeeded','yes');
    }
  } catch (_) {}
  const data = window.__paintAudit = { frames:[], events:[], paints:[], shifts:[], resources:[], sampleCapReached:false };
  const event = (name, extra={}) => data.events.push({name,t:performance.now(),...extra});
  const rect = el => { if (!el) return null; const r=el.getBoundingClientRect(); return [r.x,r.y,r.width,r.height].map(n=>Math.round(n*10)/10); };
  const style = el => {
    if (!el) return null; const s=getComputedStyle(el);
    return { rect:rect(el), font:s.font, color:s.color, background:s.backgroundColor, image:s.backgroundImage, display:s.display, visibility:s.visibility };
  };
  const sample = () => {
    const h=document.documentElement,b=document.body;
    if (b) {
      const s=getComputedStyle(b); const nav=document.querySelector('#magic-navbar-container');
      const title=document.querySelector('main h1,.main-header h1,h1');
      data.frames.push({t:performance.now(),ready:document.readyState,fonts:document.fonts.status,
        visible:s.visibility!=='hidden' && +s.opacity>0 && b.getBoundingClientRect().height>0,
        theme:{mode:h.getAttribute('data-mode'),editor:h.getAttribute('data-te-mode'),gallery:h.getAttribute('data-te-gallery'),project:h.getAttribute('data-te-project')},
        body:{background:s.backgroundColor,image:s.backgroundImage,color:s.color,rootFont:getComputedStyle(h).fontSize},
        opacity:s.opacity,
        nav:nav?[...nav.querySelectorAll('.nav-link')].map(el=>({label:el.textContent.trim(),hidden:el.hidden,...style(el)})):null,
        title:style(title),main:rect(document.querySelector('main,.main-container')),sidebar:rect(document.querySelector('#sidebar')),
        cardAccents:[...document.querySelectorAll('.item')].slice(0,3).map(el=>({title:el.querySelector('.card-title')?.textContent.trim(),accent:getComputedStyle(el).getPropertyValue('--te-card-accent').trim(),color:getComputedStyle(el.querySelector('.card-title span')||el).color}))});
    }
    if (data.frames.length<1200 && !data.stopped) requestAnimationFrame(sample); else data.sampleCapReached=!data.stopped;
  };
  requestAnimationFrame(sample);
  for (const name of ['DOMContentLoaded','load','pageshow','pagehide']) addEventListener(name,e=>event(name,{persisted:e.persisted??null}));
  addEventListener('pageshow',e=>{if(e.persisted){data.frames=[];data.paints=[];data.shifts=[];data.stopped=false;event('bfcache-resumed');requestAnimationFrame(sample);}});
  document.fonts.ready.then(()=>event('fonts.ready'));
  document.fonts.addEventListener('loadingdone',()=>event('fonts.loadingdone'));
  const observeRoot=()=>new MutationObserver(ms=>{for(const m of ms) if(data.events.length<500) event('root.attribute',{attribute:m.attributeName,value:document.documentElement.getAttribute(m.attributeName)});}).observe(document.documentElement,{attributes:true,attributeFilter:['data-mode','data-te-mode','data-theme','data-te-gallery','data-te-project']});
  if(document.documentElement) observeRoot(); else {const waitRoot=new MutationObserver(()=>{if(document.documentElement){waitRoot.disconnect();observeRoot();}});waitRoot.observe(document,{childList:true});}
  for(const type of ['paint','layout-shift']) try {
    new PerformanceObserver(list=>{for(const e of list.getEntries()) {
      if(type==='paint') data.paints.push({name:e.name,startTime:e.startTime});
      else data.shifts.push({startTime:e.startTime,value:e.value,hadRecentInput:e.hadRecentInput,sources:e.sources?.map(s=>({node:s.node?.id||String(s.node?.className||s.node?.nodeName||''),previous:s.previousRect.toJSON(),current:s.currentRect.toJSON()}))});
    }}).observe({type,buffered:true});
  } catch (_) {}
}
async function capture(page, cdp, name, navigate, experiment) {
  const dir=path.join(root,name); fs.mkdirSync(dir,{recursive:true});
  const screen=[], failures=[], responses=[]; let frameCount=0;
  const onFrame=e=>{
    cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});
    if(frameCount>=100) return;
    const filename=String(frameCount++).padStart(4,'0')+'.jpg';
    fs.writeFileSync(path.join(dir,filename),Buffer.from(e.data,'base64'));
    screen.push({file:filename,metadata:e.metadata});
  };
  const onFailure=r=>failures.push({url:r.url(),type:r.resourceType(),error:r.failure()?.errorText});
  const onResponse=r=>{if(r.status()>=400) responses.push({url:r.url(),status:r.status(),type:r.request().resourceType()});};
  page.on('requestfailed',onFailure);page.on('response',onResponse);cdp.on('Page.screencastFrame',onFrame);
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:75,maxWidth:960,maxHeight:720,everyNthFrame:1});
  let response,error;
  try { response=await navigate(); } catch(e){error=e.message;}
  await sleep(experiment?2400:1700);
  let data,final;
  try {
    data=await page.evaluate(()=>{const d=window.__paintAudit;if(!d)return null;d.stopped=true;d.fontsStatus=document.fonts.status;d.resources=performance.getEntriesByType('resource').filter(r=>['script','link','css'].includes(r.initiatorType)).map(r=>({name:r.name,type:r.initiatorType,start:r.startTime,end:r.responseEnd,transferSize:r.transferSize}));return d;});
    final=await page.evaluate(()=>({url:location.href,title:document.title,text:document.body?.innerText.slice(0,300),cards:document.querySelectorAll('.item').length,previews:document.querySelectorAll('[data-preview]').length,posters:document.querySelectorAll('.item img.bg-image').length,firstCard:document.querySelector('.item .card-title')?.textContent.trim(),surface:document.documentElement.getAttribute('data-tront-theme-surface'),editorKey:window.TrontThemeEditor?.key}));
    await page.screenshot({path:path.join(dir,'settled.png')});
  }catch(e){error=(error?error+'; ':'')+e.message;}
  await cdp.send('Page.stopScreencast').catch(()=>{});cdp.off('Page.screencastFrame',onFrame);
  page.off('requestfailed',onFailure);page.off('response',onResponse);
  const unavailable=isIntermediary(final?.text);
  if (data) data.phase = name.endsWith('-back') || name.endsWith('-forward') ? 'history' : name.endsWith('-warm') ? 'warm' : 'cold';
  let summary=data?summarize(data):{status:'inconclusive-no-instrumentation'};
  const document=response?{url:response.url(),status:response.status(),headers:await response.allHeaders(),sha256:crypto.createHash('sha256').update(await response.body().catch(()=>Buffer.alloc(0))).digest('hex')}:null;
  const firstParty=final?.url?new URL(final.url).origin:null;
  const criticalFailures=[...failures,...responses].filter(f=>firstParty&&new URL(f.url).origin===firstParty&&['script','stylesheet','document'].includes(f.type));
  summary=applyReadiness(summary,{text:final?.text,status:response?.status(),error,criticalFailures,fontsStatus:data?.fontsStatus});
  const report={name,experiment,summary,document,final,error,unavailable,screen,screenCapReached:frameCount>=100,failures,criticalFailures,responses,data};
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(dir,'filmstrip.html'),'<!doctype html><meta charset="utf-8"><title>'+name+'</title><style>body{background:#222;color:#eee;font:14px monospace}section{display:inline-block;width:32%;vertical-align:top}img{width:100%}</style><h1>'+name+'</h1><p>CDP rendered-frame samples. Frame cap: 100. Review report.json for timing; screenshots are not all physical display frames.</p>'+screen.map(f=>'<section><p>'+f.file+' '+f.metadata.timestamp+'</p><img src="'+f.file+'"></section>').join(''));
  console.log(name+': '+summary.status+' '+Object.keys(summary.deltas||{}).join(','));
  return {name,summary,final,error,failedRequests:failures.length,criticalFailures};
}
async function runCase(browser,route,variant,experiment) {
  const context=await browser.newContext({viewport:{width:variant.width,height:variant.height},colorScheme:variant.colorScheme,serviceWorkers:'block'});
  try {
  await context.addInitScript(instrumentation,variant);
  const page=await context.newPage();page.setDefaultNavigationTimeout(20000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
  // Normal cases never call route(): interception disables HTTP cache, invalidating warm-cache claims.
  if(experiment) await page.route('**/*',async r=>{
    const req=r.request(),url=req.url();
    const delayed=experiment==='delay-font' && req.resourceType()==='font' || experiment==='delay-css' && req.resourceType()==='stylesheet' || experiment==='delay-editor' && /tront-theme-editor\.js(?:\?|$)/.test(url) || experiment==='delay-defer' && /\/assets\/js\/dist\/(home|post|page|misc|commons)\.min\.js/.test(url);
    if(delayed) await sleep(1200);
    await r.continue().catch(()=>{});
  });
  const label=route.name+'-'+variant.name+(experiment?'-'+experiment:'');
  const results=[];
  results.push(await capture(page,cdp,label+'-cold',()=>page.goto(route.url,{waitUntil:'domcontentloaded'}),experiment||null));
  if(!experiment) {
    results.push(await capture(page,cdp,label+'-warm',()=>page.reload({waitUntil:'domcontentloaded'}),null));
    if((route.name==='blog'||route.name==='games')&&variant.name==='saved-light-desktop') {
      // Navigate within this public site and record true Back/Forward pageshow evidence.
      const other=new URL(route.name==='blog'?'/blog/archives/':'/',route.url).href;
      await page.goto(other,{waitUntil:'domcontentloaded'});
      results.push(await capture(page,cdp,label+'-back',()=>page.goBack({waitUntil:'domcontentloaded'}),null));
      results.push(await capture(page,cdp,label+'-forward',()=>page.goForward({waitUntil:'domcontentloaded'}),null));
      await page.goto(route.url,{waitUntil:'domcontentloaded'});
      for(const width of [390,768,1440]) {
        await page.setViewportSize({width,height:900});await sleep(250);
        await page.screenshot({path:path.join(root,label+'-resize-'+width+'.png')});
      }
      // Explicit ColorMagic proves opt-in behavior; writes only this disposable context's localStorage.
      if(route.name==='games') {
        const before=await page.evaluate(()=>({cards:document.querySelectorAll('.item').length,first:document.querySelector('.card-title')?.textContent,legacy:localStorage.getItem('tront-theme'),playback:localStorage.getItem('tront-previews-paused')}));
        await page.locator('#tront-theme-btn').click();await page.locator('[data-action="magic"]').click();
        const after=await page.evaluate(()=>({cards:document.querySelectorAll('.item').length,first:document.querySelector('.card-title')?.textContent,gallery:document.documentElement.getAttribute('data-te-gallery'),legacy:localStorage.getItem('tront-theme'),playback:localStorage.getItem('tront-previews-paused'),body:getComputedStyle(document.body).backgroundImage,radius:getComputedStyle(document.body,'::before').borderRadius}));
        await page.locator('[data-action="reset"]').click();
        const reset=await page.locator('html').getAttribute('data-te-gallery');
        fs.writeFileSync(path.join(root,'games-colormagic-contract.json'),JSON.stringify({before,after,reset},null,2));
        if(after.cards!==117||after.first!==before.first||after.legacy!==before.legacy||after.playback!==before.playback||after.gallery!=='custom'||after.body!=='none'||after.radius!=='50%'||reset!=='native') throw Error('Games ColorMagic preservation contract changed');
      }
    }
  }
  return {results,errors};
  } finally { await context.close(); }
}
async function main(){
  if(process.env.GITHUB_ACTIONS!=='true') throw Error('Run only through parent-approved read-only GitHub Actions; no local Chrome launch.');
  fs.mkdirSync(root,{recursive:true});
  const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
  const browser=await chromium.launch({executablePath:process.env.THEME_BROWSER_EXECUTABLE||'/opt/google/chrome/chrome',headless:true});
  const run={started:new Date().toISOString(),browser:await browser.version(),routes,results:[],errors:[],scope:'isolated public read-only browser contexts; local preference changes only; no publish/deploy'};
  try {
    for(const route of routes) for(const variant of variants) {
      try {const r=await runCase(browser,route,variant);run.results.push(...r.results);run.errors.push(...r.errors.map(message=>({route:route.name,message})));}
      catch(e){run.errors.push({route:route.name,variant:variant.name,message:e.message});}
    }
    for(const [name,extra] of [['games',{name:'legacy-purple-desktop',legacy:'tront-purple'}],['blog',{name:'chirpy-session-light-desktop',sessionMode:'light'}]]) {
      const route=routes.find(r=>r.name===name);if(!route)continue;
      try {const r=await runCase(browser,route,{...variants[0],...extra});run.results.push(...r.results);run.errors.push(...r.errors.map(message=>({route:name,message})));}
      catch(e){run.errors.push({route:name,message:e.message});}
    }
    if(process.env.PAINT_AUDIT_STRESS!=='false') for(const [name,experiment] of [['blog','delay-defer'],['blog','delay-css'],['home','delay-editor'],['games','delay-font']]) {
      const route=routes.find(r=>r.name===name);if(!route)continue;
      try {const r=await runCase(browser,route,variants[2],experiment);run.results.push(...r.results);run.errors.push(...r.errors.map(message=>({route:name,experiment,message})));}
      catch(e){run.errors.push({route:name,experiment,message:e.message});}
    }
  } finally {await browser.close();run.finished=new Date().toISOString();fs.writeFileSync(path.join(root,'summary.json'),JSON.stringify(run,null,2));}
  if(run.errors.length||run.results.some(r=>/blocked|inconclusive/.test(r.summary.status)||r.summary.unsettledFonts)) process.exitCode=2;
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={instrumentation};
