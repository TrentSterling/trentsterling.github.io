#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('./contract.cjs');
const OUT=path.resolve(process.env.SITE_FOLLOWUP_OUTPUT||'.local/site-followup');
const ROOT=C.HOST+'/tutorials/';
const ALLOWED=new Set(['tront.xyz','cdn.jsdelivr.net','cdnjs.cloudflare.com','fonts.googleapis.com','fonts.gstatic.com','cdn.tailwindcss.com']);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const screenshotFailures=[];
const write=(name,data)=>fs.writeFileSync(path.join(OUT,name),JSON.stringify(data,null,2));
async function publicGet(url,{probeBytes=0}={}){
 C.assertPublic(url);const started=Date.now(),chain=[];
 for(let redirects=0;redirects<3;redirects++){
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'Accept-Encoding':'identity','User-Agent':'Tront-bounded-site-followup/1.0',...(probeBytes?{Range:`bytes=0-${probeBytes-1}`}:{})}});
  if(response.status>=300&&response.status<400){const next=new URL(response.headers.get('location'),url).href;C.assertPublic(next);chain.push({url,status:response.status,next});await response.body?.cancel();url=next;continue;}
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const{value,done}=await reader.read();if(done)break;if(probeBytes){const part=value.subarray(0,Math.max(0,probeBytes-size));chunks.push(part);size+=part.length;if(size>=probeBytes)break;}else{size+=value.length;if(size>1024*1024)throw Error('Public response exceeds 1 MiB cap');chunks.push(value);}}}finally{await reader.cancel();}
  const bytes=Buffer.concat(chunks),text=bytes.toString();assert.equal(C.unavailable(text),false,'no intermediary error page');
  return{url,status:response.status,contentType:response.headers.get('content-type'),bytes:size,probeOnly:Boolean(probeBytes),sha256:C.sha256(bytes),redirects:chain,elapsedMs:Date.now()-started,text};
 }
 throw Error('Public GET redirect cap');
}
function iconPaint(){
 window.__iconAudit={frames:[],paints:[],stop:false};
 try{new PerformanceObserver(list=>window.__iconAudit.paints.push(...list.getEntries().map(e=>({name:e.name,t:e.startTime})))).observe({type:'paint',buffered:true});}catch{}
 const sample=()=>{const nodes=[...document.querySelectorAll('#sidebar-trigger, #search-trigger')];if(nodes.length===2)window.__iconAudit.frames.push({t:performance.now(),icons:nodes.map(button=>{const icon=button.firstElementChild,r=icon?.getBoundingClientRect(),s=icon?getComputedStyle(icon):{};return{id:button.id,tag:icon?.tagName.toLowerCase(),width:r?.width,height:r?.height,visible:s.visibility,opacity:s.opacity,stroke:s.stroke};})});if(!window.__iconAudit.stop&&window.__iconAudit.frames.length<180)requestAnimationFrame(sample);};requestAnimationFrame(sample);
}
async function guardedContext(browser,viewport,{tutorialHtml=null,blockIcons=false,gamesOnlyIsaac=false}={}){
 const context=await browser.newContext({viewport,colorScheme:'dark',serviceWorkers:'block'}),events={blockedIconFonts:[],blockedDemoScripts:[],blockedNonReadMethods:[],externalNotExercised:[],pageErrors:[],criticalFailures:[],tutorialContentRequests:[],unrelatedGamesMediaBlocked:[]};
 await context.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url());
  if(u.origin===C.HOST&&u.pathname.startsWith('/tutorials/')&&(/\.md$/.test(u.pathname)||/(?:^|\/)demo\.js$/i.test(u.pathname)))events.tutorialContentRequests.push({url:u.href,method:request.method()});
  if(!['GET','HEAD'].includes(request.method())){events.blockedNonReadMethods.push({url:u.href,method:request.method()});return route.abort('blockedbyclient');}
  if(/(?:^|\/)demo\.js$/i.test(u.pathname)){events.blockedDemoScripts.push(u.href);return route.abort('blockedbyclient');}
  if(gamesOnlyIsaac&&request.resourceType()==='media'&&u.pathname!=='/games/media/binding-of-isaac-clone-2014.mp4'){events.unrelatedGamesMediaBlocked.push(u.href);return route.abort('blockedbyclient');}
  if(tutorialHtml!==null&&u.href.split('#')[0]===ROOT&&request.isNavigationRequest())return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:tutorialHtml});
  if(blockIcons&&request.resourceType()==='font'&&/font-?awesome|fa-(solid|regular|brands)/i.test(u.href)){events.blockedIconFonts.push(u.href);return route.abort('failed');}
  if(u.protocol!=='https:'||!ALLOWED.has(u.hostname)){if(events.externalNotExercised.length<50)events.externalNotExercised.push({url:u.href,type:request.resourceType()});return route.abort('blockedbyclient');}
  return route.continue();
 });
 const page=await context.newPage();page.setDefaultTimeout(8000);page.setDefaultNavigationTimeout(20000);
 page.on('pageerror',e=>events.pageErrors.push(e.message));
 page.on('response',r=>{if(r.url().startsWith(C.HOST+'/')&&['script','stylesheet'].includes(r.request().resourceType())&&r.status()>=400)events.criticalFailures.push({url:r.url(),status:r.status()});});
 return{context,page,events};
}
async function screenshot(page,name){await page.screenshot({path:path.join(OUT,name+'.png'),animations:'disabled',timeout:5000}).catch(error=>screenshotFailures.push({name,error:error.message}));}
async function settle(page){await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,3000))]));await sleep(200);}
async function geminiHashChecks(page,events,name){
 const evidence={scope:'Gemini roadmap only; blank-hash history is a pre-existing no-op, not a blank-content assertion',steps:[]};
 const requests=()=>events.tutorialContentRequests.filter(r=>r.url===C.HOST+'/tutorials/gemini.md').length;
 const check=async()=>{
  await page.waitForFunction(()=>document.querySelector('#content h1')?.textContent.trim()==='Game Development Tutorials');
  assert.equal((await page.locator('#content h1').textContent()).trim(),'Game Development Tutorials');
  assert.ok((await page.locator('#content h2').allTextContents()).some(t=>t.trim()==='Roadmap'));
  assert.equal((await page.locator('#content').innerText()).includes('Content TBD'),false);
  assert.ok((await page.locator('#nav-gemini').getAttribute('class')).split(/\s+/).includes('active'));
  assert.equal(await page.locator('#demo-wrapper').evaluate(el=>getComputedStyle(el).display),'none');
  assert.equal(new URL(page.url()).hash,'#gemini');
  assert.deepEqual(events.blockedDemoScripts,[],'Gemini never attempts demo.js');
  assert.equal(events.tutorialContentRequests.some(r=>r.url.includes('/gemini/README.md')),false);
 };
 const responseCheck=async promise=>{const r=await promise;assert.equal(r.status(),200);assert.match(r.headers()['content-type']||'',/^text\/markdown/);assert.equal(C.sha256(await r.body()),C.GEMINI_MARKDOWN_SHA256);return{url:r.url(),status:r.status(),sha256:C.GEMINI_MARKDOWN_SHA256};};
 const waitMarkdown=()=>page.waitForResponse(r=>r.url()===C.HOST+'/tutorials/gemini.md');
 const clickSidebar=async()=>{const nav=page.locator('#nav-gemini'),g=await nav.evaluate(C.geometry);assert.ok(g.styled&&g.inside&&g.hitTest&&C.visibleBox(g.rect,g.viewport),'Gemini sidebar item is normally visible and hit-testable');await page.mouse.click(g.clickPoint.x,g.clickPoint.y);return g;};
 assert.equal(new URL(page.url()).hash,'');const initial=requests();
 const[firstResponse,sidebar]=await Promise.all([responseCheck(waitMarkdown()),clickSidebar()]);await check();assert.equal(requests(),initial+1);evidence.steps.push({action:'sidebar-activation',sidebar,response:firstResponse,rendered:true});await screenshot(page,name+'-gemini-sidebar');
 const beforeBack=requests();await page.goBack({waitUntil:'domcontentloaded'});assert.equal(page.url(),ROOT);await sleep(150);assert.equal(requests(),beforeBack);evidence.steps.push({action:'back-to-blank-hash',url:page.url(),additionalMarkdownRequests:0});
 const[forwardResponse]=await Promise.all([responseCheck(waitMarkdown()),page.goForward({waitUntil:'domcontentloaded'})]);await check();assert.equal(requests(),beforeBack+1);evidence.steps.push({action:'forward-to-gemini',response:forwardResponse,rendered:true});
 const repeatBefore=requests();await clickSidebar();await sleep(250);await check();assert.equal(requests(),repeatBefore,'same-hash repeat preserves content without a duplicate Markdown fetch');evidence.steps.push({action:'repeat-same-hash',rendered:true,additionalMarkdownRequests:0});
 const directBefore=requests();const[directResponse]=await Promise.all([responseCheck(waitMarkdown()),page.reload({waitUntil:'domcontentloaded'})]);await check();assert.equal(requests(),directBefore+1);evidence.steps.push({action:'direct-hash-document-load',response:directResponse,rendered:true});await screenshot(page,name+'-gemini-direct');
 evidence.requests=events.tutorialContentRequests;evidence.status='passed';return evidence;
}
async function tutorialCase(browser,width,before,after){
 const result={name:'tutorial-'+width,viewport:{width,height:900},scope:'Source-intercepted exact candidate only at /tutorials/; target gemini.html is actual public HTML; no demo execution',baseline:null,candidate:null,errors:[],status:'running'};
 for(const[kind,html]of[['baseline',before],['candidate',after]]){
  const{context,page,events}=await guardedContext(browser,result.viewport,{tutorialHtml:html});
  try{
   await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);assert.equal(new URL(page.url()).hash,'');
   const anchor=page.locator('.tront-topics a').filter({hasText:'Project Roadmap'});assert.equal(await anchor.count(),1);
   const g=await anchor.evaluate(C.geometry);result[kind]={geometry:g,events};await screenshot(page,result.name+'-'+kind);
   assert.deepEqual(events.blockedDemoScripts,[],'blank-hash hub did not attempt a demo');
   if(kind==='baseline')continue;
   assert.equal(await anchor.getAttribute('href'),'/tutorials/gemini.html');
   if(!(g.styled&&g.inside&&g.hitTest&&C.visibleBox(g.rect,g.viewport))){const b=result.baseline?.geometry;result.status=b&&!(b.styled&&b.inside&&b.hitTest)?'blocked-preexisting-layout':'blocked-layout-visibility';result.reason='Static Roadmap anchor is not normally visible and hit-testable; no click or scrolling was forced.';continue;}
   const[targetResponse]=await Promise.all([page.waitForResponse(r=>r.request().isNavigationRequest()&&r.url()===C.HOST+'/tutorials/gemini.html'),page.mouse.click(g.clickPoint.x,g.clickPoint.y)]);
   await page.waitForURL(C.HOST+'/tutorials/gemini.html',{waitUntil:'domcontentloaded'});
   assert.equal(targetResponse.status(),200);assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),C.HOST+'/tutorials/gemini.html');
   result.candidate.navigation={method:'ordinary-visible-anchor-click',hitTestedPoint:g.clickPoint,url:page.url(),status:targetResponse.status(),title:await page.title(),canonical:await page.locator('link[rel="canonical"]').getAttribute('href')};await screenshot(page,result.name+'-destination');
   await page.goBack({waitUntil:'domcontentloaded'});assert.equal(page.url(),ROOT);assert.equal(await page.locator('.tront-topics a[href="/tutorials/gemini.html"]').count(),1);assert.equal(new URL(page.url()).hash,'');
   result.candidate.back={url:page.url(),candidateHrefPreserved:true};await screenshot(page,result.name+'-back');result.candidate.geminiHash=await geminiHashChecks(page,events,result.name);assert.deepEqual(events.blockedDemoScripts,[]);assert.deepEqual(events.pageErrors,[]);result.status=result.errors.length?'failed':'passed';
  }catch(error){result.status='failed';result.errors.push({phase:kind,message:error.message});await screenshot(page,result.name+'-'+kind+'-failed');}
  finally{await context.close();write(result.name+'.json',result);}
 }
 return result;
}
async function blogCase(browser,width,blockIcons,expectedMarkers){
 const name=`blog-mobile-${width}-${blockIcons?'blocked-icon-font':'normal'}`,result={name,width,blockIcons,status:'running'};
 const{context,page,events}=await guardedContext(browser,{width,height:844},{blockIcons});
 try{
  await context.addInitScript(iconPaint);
  const response=await page.goto(C.HOST+'/blog/',{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);await settle(page);
  const raw=await response.text();assert.deepEqual(C.svgMarkers(raw),expectedMarkers,'exact released inline SVG markers');
  result.document={url:page.url(),status:response.status(),sha256:C.sha256(raw),expectedRelease:C.BLOG_RELEASE,exactSvgMarkers:true};
  result.controls=[];
  for(const[label,id]of[['Menu','sidebar-trigger'],['Search','search-trigger']]){
   const button=page.getByRole('button',{name:label,exact:true});assert.equal(await button.getAttribute('id'),id);const g=await button.evaluate(C.geometry);assert.ok(g.styled&&g.inside&&g.hitTest,`${label} normally visible and hit-testable`);
   const icon=button.locator('svg');assert.equal(await icon.isVisible(),true);assert.equal(await icon.getAttribute('aria-hidden'),'true');assert.equal(await icon.getAttribute('focusable'),'false');result.controls.push({label,geometry:g});
  }
  const paint=await page.evaluate(()=>{window.__iconAudit.stop=true;return window.__iconAudit;});const fcp=paint.paints.find(p=>p.name==='first-contentful-paint')?.t;assert.ok(Number.isFinite(fcp));const frames=paint.frames.filter(f=>f.t>=fcp);assert.ok(frames.length);
  for(const frame of frames)for(const icon of frame.icons){assert.equal(icon.tag,'svg');assert.ok(icon.width>0&&icon.height>0);assert.equal(icon.visible,'visible');assert.equal(icon.opacity,'1');assert.notEqual(icon.stroke,'none');}
  result.paint={fcp,postFCPSamples:frames.length,frames};await screenshot(page,name+'-controls');
  await page.getByRole('button',{name:'Menu',exact:true}).click();assert.equal(await page.locator('body').getAttribute('sidebar-display'),'');await screenshot(page,name+'-menu');
  const mask=await page.locator('#mask').evaluate(C.geometry);result.menuDismiss={mask};assert.ok(mask.styled&&mask.hitTest&&mask.clickPoint,'an exposed visible mask point exists outside the sidebar');
  await page.mouse.click(mask.clickPoint.x,mask.clickPoint.y);assert.equal(await page.locator('body').getAttribute('sidebar-display'),null);result.menuDismiss.closed=true;
  const trigger=page.getByRole('button',{name:'Search',exact:true}),input=page.locator('#search-input');result.search=[];
  for(const dismiss of['Cancel','Escape']){
   await trigger.click();assert.equal(await input.evaluate(el=>el===document.activeElement),true);assert.equal(await input.inputValue(),'');await input.pressSequentially('Trontop');await page.locator('#search-results article').first().waitFor();assert.match(await page.locator('#search-results').innerText(),/Trontop/i);
   if(dismiss==='Cancel'){await screenshot(page,name+'-search-results');await page.locator('#search-cancel').click();}else await input.press('Escape');
   assert.equal(await input.inputValue(),'');assert.equal(await page.locator('#search-result-wrapper').isVisible(),false);assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);result.search.push({dismiss,resultsVisible:true,queryCleared:true,focusReturned:true});
  }
  result.fonts=await page.evaluate(()=>[...document.fonts].filter(f=>/Font Awesome/i.test(f.family)).map(f=>({family:f.family,weight:f.weight,status:f.status})));
  assert.deepEqual(events.pageErrors,[]);assert.deepEqual(events.criticalFailures,[]);assert.deepEqual(events.blockedDemoScripts,[]);
  if(blockIcons){assert.ok(events.blockedIconFonts.length>0,'icon-font blocking was actually exercised');assert.equal(result.fonts.some(f=>f.status==='loaded'),false,'no Font Awesome face bypassed the block');}
  result.status='passed';
 }catch(error){result.status='failed';result.error=error.message;await screenshot(page,name+'-failure');}
 finally{result.events=events;await context.close();write(name+'.json',result);}
 return result;
}
async function gamesCase(browser){
 const name='games-public-390',result={name,status:'running',scope:'One public gallery context, all 117 year labels, Isaac card only for decoded poster and video; no gameplay or gallery crawl'};
 const{context,page,events}=await guardedContext(browser,{width:390,height:844},{gamesOnlyIsaac:true});
 try{
  const response=await page.goto(C.HOST+'/games/',{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);const raw=await response.body();assert.equal(C.sha256(raw),C.GAMES.htmlSha256);result.document={status:200,sha256:C.sha256(raw),markers:C.gamesMarkers(raw.toString())};await settle(page);
  const years=await page.locator('.grid .item .card-title').evaluateAll(nodes=>nodes.map(h=>({title:h.textContent.trim(),year:h.querySelector('span')?.textContent.trim()})));
  assert.equal(years.length,117);assert.ok(years.every(x=>/^\(\d{4}(?:-(?:\d{4}|Present))?\)$/.test(x.year||'')));assert.match(years[0].title,/^Project Demigod/);result.years=years;
  const preview=page.locator('#'+C.GAMES.cardId);await preview.scrollIntoViewIfNeeded();
  const card=preview.locator('..');assert.equal((await card.locator('.card-title').textContent()).replace(/\s+/g,' ').trim(),C.GAMES.title);assert.equal((await card.locator('.blurb').textContent()).trim(),C.GAMES.blurb);
  result.blurb=await card.locator('.blurb').evaluate(el=>({text:el.textContent.trim(),clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,lineClamp:getComputedStyle(el).webkitLineClamp}));assert.ok(result.blurb.scrollHeight<=result.blurb.clientHeight+1,'Isaac blurb is not clipped');assert.ok(['none','0'].includes(result.blurb.lineClamp),'Isaac blurb is not line-clamped');
  result.poster=await preview.locator('img').evaluate(async img=>{await img.decode();return{src:img.getAttribute('src'),complete:img.complete,width:img.naturalWidth,height:img.naturalHeight};});assert.equal(result.poster.src,C.GAMES.poster);assert.equal(result.poster.complete,true);assert.equal(result.poster.width,576);assert.equal(result.poster.height,324);
  await page.waitForFunction(id=>{const v=document.querySelector('#'+id+' video');return v&&!v.paused&&v.currentTime>.1&&v.getVideoPlaybackQuality().totalVideoFrames>2;},C.GAMES.cardId);
  const sample=()=>preview.locator('video').evaluate(v=>({src:v.getAttribute('src'),time:v.currentTime,frames:v.getVideoPlaybackQuality().totalVideoFrames,width:v.videoWidth,height:v.videoHeight,duration:v.duration,paused:v.paused,muted:v.muted,loop:v.loop,playsInline:v.playsInline}));
  const first=await sample();await sleep(400);const second=await sample();assert.equal(second.src,C.GAMES.video);assert.equal(second.width,576);assert.equal(second.height,324);assert.ok(Math.abs(second.duration-4.8)<.01);assert.ok(second.muted&&second.loop&&second.playsInline&&!second.paused);assert.ok(second.frames>first.frames&&second.time!==first.time,'real decoded muted video advances');result.video={first,second,advancing:true};
  await screenshot(page,name+'-isaac-playing');assert.equal(page.url(),C.HOST+'/games/');assert.deepEqual(events.pageErrors,[]);assert.deepEqual(events.criticalFailures,[]);result.status='passed';
 }catch(error){result.status='failed';result.error=error.message;await screenshot(page,name+'-failure');}
 finally{result.events=events;await context.close();write(name+'.json',result);}return result;
}
async function main(){
 if(process.env.GITHUB_ACTIONS!=='true')throw Error('Run only in the parent-approved read-only GitHub Actions runner; do not launch local Chrome.');
 fs.mkdirSync(OUT,{recursive:true});
 const before=fs.readFileSync(path.join(process.env.TUTORIAL_BASELINE_ROOT||'.local/tutorial-baseline','index.html'));
 const after=fs.readFileSync(path.join(process.env.TUTORIAL_CANDIDATE_ROOT||'.local/tutorial-candidate','index.html'));
 const expectedMarkers=C.svgMarkers(fs.readFileSync(path.join(process.env.BLOG_EXPECT_ROOT||'.local/blog-expected','_includes/topbar.html'),'utf8'));
 const report={started:new Date().toISOString(),baseMainCommit:'36447f2b50a8cf9703b579216e32d380e76139da',diff:C.tutorialDiff(before,after),blogRelease:C.BLOG_RELEASE,svgSource:C.BLOG_SVG_SOURCE,http:[],tutorials:[],blog:[],games:[],errors:[],limits:'Seven logical cases in nine isolated browser contexts: two tutorial viewports (baseline/candidate), four mobile blog cases, ten bounded public GETs (seven HTML/Markdown, one 4 KiB image probe, two complete small Isaac assets), plus one mobile Games context; no crawl, demo.js, form submissions, non-read HTTP methods, cookies or credentials from user accounts.'};
 try{
  for(const route of['/tutorials/gemini/README.md','/tutorials/gemini.md','/blog/','/blog/posts/trontop/','/blog/categories/',C.FIXED_POST,C.FIXED_IMAGE,'/games/',C.GAMES.video,C.GAMES.poster]){
   try{
    const r=await publicGet(C.HOST+route,{probeBytes:route===C.FIXED_IMAGE?4096:0});
    if(route.startsWith('/blog/')){
     if(route===C.FIXED_IMAGE){assert.ok([200,206].includes(r.status));assert.match(r.contentType||'',/^image\//);r.imageAvailabilityOnly=true;}
     else{assert.equal(r.status,200);assert.deepEqual(C.svgMarkers(r.text),expectedMarkers);r.exactSvgMarkers=true;}
    }
    if(route==='/games/'){assert.equal(r.status,200);assert.equal(r.sha256,C.GAMES.htmlSha256);r.gallery=C.gamesMarkers(r.text);}
    if(C.GAMES.files[route]){const expected=C.GAMES.files[route];assert.equal(r.status,200);assert.equal(r.bytes,expected.bytes);assert.equal(r.sha256,expected.sha256);assert.ok(r.contentType?.startsWith(expected.type));r.exactReviewedAsset=true;}
    if(route==='/blog/categories/')r.categories=C.categoryMarkers(r.text);
    if(route===C.FIXED_POST)r.fixedImageLink=C.repairedPostMarker(r.text);
    if(route.startsWith('/tutorials/'))r.preview=r.text.slice(0,500);
    if(route==='/tutorials/gemini.md'){assert.equal(r.status,200);assert.match(r.contentType||'',/^text\/markdown/);assert.equal(r.sha256,C.GEMINI_MARKDOWN_SHA256);r.authenticRoadmapMarkdown=true;}
    delete r.text;report.http.push(r);
   }catch(error){report.http.push({url:C.HOST+route,error:error.message});report.errors.push(route+': '+error.message);}
   write('summary.json',report);await sleep(250);
  }
  const{chromium}=require('playwright');const browser=await chromium.launch({headless:true,executablePath:process.env.THEME_BROWSER_EXECUTABLE||'/opt/google/chrome/chrome'});report.browser=await browser.version();
  try{for(const width of[1440,390]){report.tutorials.push(await tutorialCase(browser,width,before.toString(),after.toString()));write('summary.json',report);}for(const width of[320,390])for(const blocked of[false,true]){report.blog.push(await blogCase(browser,width,blocked,expectedMarkers));write('summary.json',report);}report.games.push(await gamesCase(browser));write('summary.json',report);}finally{await browser.close();}
 }catch(error){report.errors.push(error.message);}
 finally{report.finished=new Date().toISOString();report.screenshotFailures=screenshotFailures;write('summary.json',report);}
 if(report.errors.length||screenshotFailures.length||report.tutorials.some(c=>c.status!=='passed')||report.blog.some(c=>c.status!=='passed')||report.tutorials.length!==2||report.blog.length!==4||report.games.length!==1||report.games.some(c=>c.status!=='passed'))process.exitCode=2;
 console.log(JSON.stringify({tutorials:report.tutorials.map(({name,status})=>({name,status})),blog:report.blog.map(({name,status})=>({name,status})),games:report.games.map(({name,status})=>({name,status})),errors:report.errors},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
