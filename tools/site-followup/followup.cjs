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
// Runs within the page. No scrolling or click synthesis occurs here.
function geometry(element){
 const rect=element.getBoundingClientRect(),css=getComputedStyle(element),vp={width:innerWidth,height:innerHeight};
 let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};const ancestors=[];
 for(let p=element.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),r=p.getBoundingClientRect();if(/hidden|clip|scroll|auto/.test(s.overflowX)){clip.left=Math.max(clip.left,r.left);clip.right=Math.min(clip.right,r.right);}if(/hidden|clip|scroll|auto/.test(s.overflowY)){clip.top=Math.max(clip.top,r.top);clip.bottom=Math.min(clip.bottom,r.bottom);}if(/hidden|clip/.test(s.overflowX+' '+s.overflowY))ancestors.push({tag:p.tagName,id:p.id,className:p.className,overflowX:s.overflowX,overflowY:s.overflowY,rect:[r.x,r.y,r.width,r.height]});}
 const inside=rect.width>0&&rect.height>0&&rect.left>=clip.left&&rect.top>=clip.top&&rect.right<=clip.right&&rect.bottom<=clip.bottom;
 const hit=inside?document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2):null;
 const styled=css.display!=='none'&&css.visibility==='visible'&&Number(css.opacity)>0;
 return{rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},viewport:vp,clip,styled,inside,hitTest:!!hit&&(hit===element||element.contains(hit)),hitTag:hit?.tagName||null,clippingAncestors:ancestors,href:element.getAttribute('href')};
}
function iconPaint(){
 window.__iconAudit={frames:[],paints:[],stop:false};
 try{new PerformanceObserver(list=>window.__iconAudit.paints.push(...list.getEntries().map(e=>({name:e.name,t:e.startTime})))).observe({type:'paint',buffered:true});}catch{}
 const sample=()=>{const nodes=[...document.querySelectorAll('#sidebar-trigger, #search-trigger')];if(nodes.length===2)window.__iconAudit.frames.push({t:performance.now(),icons:nodes.map(button=>{const icon=button.firstElementChild,r=icon?.getBoundingClientRect(),s=icon?getComputedStyle(icon):{};return{id:button.id,tag:icon?.tagName.toLowerCase(),width:r?.width,height:r?.height,visible:s.visibility,opacity:s.opacity,stroke:s.stroke};})});if(!window.__iconAudit.stop&&window.__iconAudit.frames.length<180)requestAnimationFrame(sample);};requestAnimationFrame(sample);
}
async function guardedContext(browser,viewport,{tutorialHtml=null,blockIcons=false}={}){
 const context=await browser.newContext({viewport,colorScheme:'dark',serviceWorkers:'block'}),events={blockedIconFonts:[],blockedDemoScripts:[],blockedNonReadMethods:[],externalNotExercised:[],pageErrors:[],criticalFailures:[]};
 await context.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url());
  if(!['GET','HEAD'].includes(request.method())){events.blockedNonReadMethods.push({url:u.href,method:request.method()});return route.abort('blockedbyclient');}
  if(/(?:^|\/)demo\.js$/i.test(u.pathname)){events.blockedDemoScripts.push(u.href);return route.abort('blockedbyclient');}
  if(tutorialHtml!==null&&u.href===ROOT&&request.isNavigationRequest())return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:tutorialHtml});
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
async function tutorialCase(browser,width,before,after){
 const result={name:'tutorial-'+width,viewport:{width,height:900},scope:'Source-intercepted exact candidate only at /tutorials/; target gemini.html is actual public HTML; no demo execution',baseline:null,candidate:null,errors:[],status:'running'};
 for(const[kind,html]of[['baseline',before],['candidate',after]]){
  const{context,page,events}=await guardedContext(browser,result.viewport,{tutorialHtml:html});
  try{
   await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);assert.equal(new URL(page.url()).hash,'');
   const anchor=page.locator('.tront-topics a').filter({hasText:'Project Roadmap'});assert.equal(await anchor.count(),1);
   const g=await anchor.evaluate(geometry);result[kind]={geometry:g,events};await screenshot(page,result.name+'-'+kind);
   assert.deepEqual(events.blockedDemoScripts,[],'blank-hash hub did not attempt a demo');
   if(kind==='baseline')continue;
   assert.equal(await anchor.getAttribute('href'),'/tutorials/gemini.html');
   if(!(g.styled&&g.inside&&g.hitTest&&C.visibleBox(g.rect,g.viewport))){const b=result.baseline?.geometry;result.status=b&&!(b.styled&&b.inside&&b.hitTest)?'blocked-preexisting-layout':'blocked-layout-visibility';result.reason='Static Roadmap anchor is not normally visible and hit-testable; no click or scrolling was forced.';continue;}
   const[targetResponse]=await Promise.all([page.waitForResponse(r=>r.request().isNavigationRequest()&&r.url()===C.HOST+'/tutorials/gemini.html'),anchor.click({timeout:4000})]);
   await page.waitForURL(C.HOST+'/tutorials/gemini.html',{waitUntil:'domcontentloaded'});
   assert.equal(targetResponse.status(),200);assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),C.HOST+'/tutorials/gemini.html');
   result.candidate.navigation={method:'ordinary-visible-anchor-click',url:page.url(),status:targetResponse.status(),title:await page.title(),canonical:await page.locator('link[rel="canonical"]').getAttribute('href')};await screenshot(page,result.name+'-destination');
   await page.goBack({waitUntil:'domcontentloaded'});assert.equal(page.url(),ROOT);assert.equal(await page.locator('.tront-topics a[href="/tutorials/gemini.html"]').count(),1);assert.equal(new URL(page.url()).hash,'');
   result.candidate.back={url:page.url(),candidateHrefPreserved:true};await screenshot(page,result.name+'-back');assert.deepEqual(events.blockedDemoScripts,[]);assert.deepEqual(events.pageErrors,[]);result.status=result.errors.length?'failed':'passed';
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
   const button=page.getByRole('button',{name:label,exact:true});assert.equal(await button.getAttribute('id'),id);const g=await button.evaluate(geometry);assert.ok(g.styled&&g.inside&&g.hitTest,`${label} normally visible and hit-testable`);
   const icon=button.locator('svg');assert.equal(await icon.isVisible(),true);assert.equal(await icon.getAttribute('aria-hidden'),'true');assert.equal(await icon.getAttribute('focusable'),'false');result.controls.push({label,geometry:g});
  }
  const paint=await page.evaluate(()=>{window.__iconAudit.stop=true;return window.__iconAudit;});const fcp=paint.paints.find(p=>p.name==='first-contentful-paint')?.t;assert.ok(Number.isFinite(fcp));const frames=paint.frames.filter(f=>f.t>=fcp);assert.ok(frames.length);
  for(const frame of frames)for(const icon of frame.icons){assert.equal(icon.tag,'svg');assert.ok(icon.width>0&&icon.height>0);assert.equal(icon.visible,'visible');assert.equal(icon.opacity,'1');assert.notEqual(icon.stroke,'none');}
  result.paint={fcp,postFCPSamples:frames.length,frames};await screenshot(page,name+'-controls');
  await page.getByRole('button',{name:'Menu',exact:true}).click();assert.equal(await page.locator('body').getAttribute('sidebar-display'),'');await screenshot(page,name+'-menu');await page.locator('#mask').click();assert.equal(await page.locator('body').getAttribute('sidebar-display'),null);
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
async function main(){
 if(process.env.GITHUB_ACTIONS!=='true')throw Error('Run only in the parent-approved read-only GitHub Actions runner; do not launch local Chrome.');
 fs.mkdirSync(OUT,{recursive:true});
 const before=fs.readFileSync(path.join(process.env.TUTORIAL_BASELINE_ROOT||'.local/tutorial-baseline','index.html'));
 const after=fs.readFileSync(path.join(process.env.TUTORIAL_CANDIDATE_ROOT||'.local/tutorial-candidate','index.html'));
 const expectedMarkers=C.svgMarkers(fs.readFileSync(path.join(process.env.BLOG_EXPECT_ROOT||'.local/blog-expected','_includes/topbar.html'),'utf8'));
 const report={started:new Date().toISOString(),baseMainCommit:'36447f2b50a8cf9703b579216e32d380e76139da',diff:C.tutorialDiff(before,after),blogRelease:C.BLOG_RELEASE,svgSource:C.BLOG_SVG_SOURCE,http:[],tutorials:[],blog:[],errors:[],limits:'Two tutorial viewports, four mobile blog cases, seven bounded public GETs (six HTML/Markdown and one 4 KiB image probe); no crawl, demo.js, form submissions, non-read HTTP methods, cookies or credentials from user accounts.'};
 try{
  for(const route of['/tutorials/gemini/README.md','/tutorials/gemini.md','/blog/','/blog/posts/trontop/','/blog/categories/',C.FIXED_POST,C.FIXED_IMAGE]){
   try{
    const r=await publicGet(C.HOST+route,{probeBytes:route===C.FIXED_IMAGE?4096:0});
    if(route.startsWith('/blog/')){
     if(route===C.FIXED_IMAGE){assert.ok([200,206].includes(r.status));assert.match(r.contentType||'',/^image\//);r.imageAvailabilityOnly=true;}
     else{assert.equal(r.status,200);assert.deepEqual(C.svgMarkers(r.text),expectedMarkers);r.exactSvgMarkers=true;}
    }
    if(route==='/blog/categories/')r.categories=C.categoryMarkers(r.text);
    if(route===C.FIXED_POST)r.fixedImageLink=C.repairedPostMarker(r.text);
    if(route.startsWith('/tutorials/'))r.preview=r.text.slice(0,500);
    delete r.text;report.http.push(r);
   }catch(error){report.http.push({url:C.HOST+route,error:error.message});report.errors.push(route+': '+error.message);}
   write('summary.json',report);await sleep(250);
  }
  const{chromium}=require('playwright');const browser=await chromium.launch({headless:true,executablePath:process.env.THEME_BROWSER_EXECUTABLE||'/opt/google/chrome/chrome'});report.browser=await browser.version();
  try{for(const width of[1440,390]){report.tutorials.push(await tutorialCase(browser,width,before.toString(),after.toString()));write('summary.json',report);}for(const width of[320,390])for(const blocked of[false,true]){report.blog.push(await blogCase(browser,width,blocked,expectedMarkers));write('summary.json',report);}}finally{await browser.close();}
 }catch(error){report.errors.push(error.message);}
 finally{report.finished=new Date().toISOString();report.screenshotFailures=screenshotFailures;write('summary.json',report);}
 if(report.errors.length||screenshotFailures.length||report.tutorials.some(c=>c.status!=='passed')||report.blog.some(c=>c.status!=='passed')||report.tutorials.length!==2||report.blog.length!==4)process.exitCode=2;
 console.log(JSON.stringify({tutorials:report.tutorials.map(({name,status})=>({name,status})),blog:report.blog.map(({name,status})=>({name,status})),errors:report.errors},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
