'use strict';
// Controlled loading fixture, not real-user timings. Font-ready screenshot waits
// are bypassed only so held-font states cannot silently turn into settled states.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit,request}=require('playwright');
const {file:htmlFile,tokens,options,css,staticNav,newRuntime,defectControl}=require('./minecraft-initial.cjs');
const root=path.resolve(__dirname,'../..');assert.ok(process.env.THEME_BASELINE_ROOT);
const baseline=path.resolve(process.env.THEME_BASELINE_ROOT),out=path.resolve(process.env.THEME_SCREENSHOTS||'.local/theme-review');fs.mkdirSync(out,{recursive:true});
const origin='https://tront.xyz',routePath='/minecraft-modding/',started=Date.now();
const report={status:'running',cases:[],note:'Controlled local-source rendering; no precise real-user first-paint timing claim. Font-swap reflow is retained.',downloads:0};
const assets=new Map(),types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const saved={'tront-theme':'tront-cyan','tront-theme-editor-v1':JSON.stringify({version:1,preset:'light',mode:'light'}),'mcmod-exercises':'{"ex1":true}'};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const candidateHtml=fs.readFileSync(path.join(root,htmlFile),'utf8'),controlHtml=defectControl(candidateHtml);
const baselineHtml=fs.readFileSync(path.join(baseline,htmlFile),'utf8'),baselineHasFix=[css,staticNav,newRuntime].some(part=>baselineHtml.includes(part));
if(baselineHasFix)defectControl(baselineHtml);
report.baselineHasFix=baselineHasFix;
report.negativeControl=baselineHasFix?'Exact three-region reversal served separately; actual fixed PR base remains compared.':'Actual pre-fix PR base.';
function measure(){const box=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,background:s.backgroundColor,font:s.font};};const root=document.documentElement,nav=document.querySelector('#nav');return{body:box(document.body),nav:box(nav),heading:box(document.querySelector('h1')),links:[...nav.querySelectorAll('a,summary')].map(e=>({href:e.getAttribute('href'),text:e.textContent,...box(e)})),navHTML:nav.innerHTML,mode:root.dataset.mode,theme:root.dataset.theme||null,tokens:Object.fromEntries([...getComputedStyle(root)].filter(k=>k.startsWith('--')).map(k=>[k,getComputedStyle(root).getPropertyValue(k).trim()])),scrollWidth:root.scrollWidth,storage:Object.fromEntries(Object.entries(localStorage))};}
(async()=>{
 if(process.env.NAV_FONT_CACHE)for(const [url,value]of Object.entries(JSON.parse(fs.readFileSync(process.env.NAV_FONT_CACHE))))assets.set(url,{body:fs.readFileSync(value.file),contentType:value.contentType});
 const client=await request.newContext({timeout:20000});const cssUrl=fs.readFileSync(path.join(root,'minecraft-modding/index.html'),'utf8').match(/href="(https:\/\/fonts.googleapis.com\/css2[^"]+)"/)[1];
 async function cache(url,type){if(assets.has(url))return;const response=await client.get(url);assert.equal(response.status(),200,url);assets.set(url,{body:await response.body(),contentType:type||response.headers()['content-type']});}
 await cache(cssUrl,'text/css');for(const m of assets.get(cssUrl).body.toString().matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))await cache(m[1]);await client.dispose();
 const browser=await(process.env.NAV_BROWSER==='webkit'?webkit:chromium).launch({headless:true,executablePath:process.env.NAV_BROWSER_EXECUTABLE||process.env.THEME_BROWSER_EXECUTABLE||undefined});
 async function open(source,width,kind='normal',video=false,negativeControl=false){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block',javaScriptEnabled:kind!=='no-js',acceptDownloads:false,...(video?{recordVideo:{dir:out,size:{width,height:900}}}:{})});
  if(kind!=='no-js')await context.addInitScript(values=>{for(const[k,v]of Object.entries(values))localStorage.setItem(k,v);},saved);
  let released=false;const pending=[],errors=[],missing=[];const targetKind=kind.startsWith('script')?'script':kind.startsWith('fonts')?'fonts':null;
  await context.route('**/*',async route=>{const u=new URL(route.request().url());const type=u.pathname.endsWith('/tront-system.js')?'script':u.hostname==='fonts.gstatic.com'?'fonts':'other';
   const serve=async()=>{if(kind===type+'-failed')return route.abort();if(assets.has(u.href))return route.fulfill(assets.get(u.href));if(u.origin!==origin)return route.abort();if(/\.(zip|exe)$/.test(u.pathname)){report.downloads++;return route.abort();}let f=path.resolve(source,'.'+u.pathname);assert.ok(f===source||f.startsWith(source+path.sep));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){missing.push(u.pathname);return route.fulfill({status:404,body:'Missing fixture'});}return route.fulfill({body:negativeControl&&path.relative(source,f)===htmlFile?controlHtml:fs.readFileSync(f),contentType:types[path.extname(f)]||'application/octet-stream'});};
   if(kind===targetKind+'-held'&&type===targetKind&&!released){pending.push(serve);return;}return serve();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('download',()=>report.downloads++);await page.goto(origin+routePath,{waitUntil:'commit'});
  return{page,context,errors,missing,pending,release:async()=>{released=true;await Promise.all(pending.map(fn=>fn()));},video:page.video()};
 }
 async function capture(item,name,waitFonts=true){
  await item.page.bringToFront();await item.page.locator('h1').waitFor({state:'attached'});
  // Trigger native layout, then poll synchronously: disabled-script documents
  // must not depend on injected font or animation callbacks to complete.
  await item.page.screenshot({animations:'disabled'});
  if(waitFonts){let ready=false;for(let i=0;i<100;i++){ready=await item.page.evaluate(()=>document.fonts.status==='loaded');if(ready)break;await delay(50);}assert.ok(ready,'native fonts finish for the settled comparison');}
  // This wait belongs only to settled comparisons. Held/failed/no-JS captures
  // below still prove the initial CSS state independently of the theme engine.
  if(await item.page.evaluate(()=>!!(window.Tront&&Tront.scale))){let ready=false;for(let i=0;i<100;i++){ready=await item.page.evaluate(()=>getComputedStyle(document.querySelector('h1')).color===getComputedStyle(document.body).color);if(ready)break;await delay(50);}assert.ok(ready,'settled inherited heading color reaches the applied palette');}
  const png=await item.page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});return{png,state:await item.page.evaluate(measure)};
 }
 function themed(state){for(const[k,v]of Object.entries(tokens))assert.equal(state.tokens[k],v,k);assert.equal(state.body.background,'rgb(1, 20, 5)');assert.equal(state.body.color,'rgb(223, 245, 226)');assert.equal(state.mode,'dark');assert.equal(state.theme,null);assert.ok(state.nav.height>0);assert.ok(state.navHTML.includes('The sword'));}
 async function parity(page){assert.equal(await page.locator('#nav').getAttribute('class'),'t-nav t-nav--product');assert.equal(await page.evaluate(opts=>{const t=document.createElement('template');t.innerHTML=Tront.nav(opts);return document.querySelector('#nav').innerHTML===t.innerHTML;},options),true,'parsed static/runtime DOM parity');}
 async function fontState(page){return page.evaluate(()=>({status:document.fonts.status,faces:[...document.fonts].map(face=>({family:face.family,weight:face.weight,style:face.style,status:face.status})),checks:['body','h1','#nav .t-nav__link'].map(selector=>{const font=getComputedStyle(document.querySelector(selector)).font;return{selector,font,loaded:document.fonts.check(font,'Minecraft')};})}));}
 function assertFontsReleased(held,released){
  assert.equal(held.status,'loading');assert.equal(released.status,'loaded');
  assert.ok(released.checks.every(check=>check.loaded),'every used font finishes loading');
  // WebKit may report a held CSS face as error while its request is still
  // pending, then loaded after release. Require that full unavailable-to-loaded
  // transition; do not confuse never-requested unloaded weights with requests.
  const requested=held.faces.filter(face=>face.status==='loading'||face.status==='error');assert.ok(requested.length>0,'held stylesheet faces are actually unavailable');
  for(const face of requested)assert.ok(released.faces.some(next=>next.family===face.family&&next.weight===face.weight&&next.style===face.style&&next.status==='loaded'),'every held requested face finishes loading');
 }
 async function keyboard(page){await page.locator('#nav .t-nav__mark').focus();await page.keyboard.press('Tab');const focus=await page.evaluate(()=>{const a=document.activeElement,s=getComputedStyle(a);return{href:a.getAttribute('href'),visible:a.matches(':focus-visible'),outline:s.outlineStyle,width:parseFloat(s.outlineWidth)};});assert.equal(focus.href,'#lesson-0');assert.ok(focus.visible);assert.notEqual(focus.outline,'none');assert.ok(focus.width>0);await Promise.all([page.waitForURL(origin+routePath+'#lesson-0'),page.keyboard.press('Enter')]);await page.goBack({waitUntil:'commit'});return focus;}
 try{
  for(const width of[320,390,1440]){
   const before=await open(baseline,width),after=await open(root,width);await before.page.waitForLoadState('load');await after.page.waitForLoadState('load');
   const b=await capture(before,'minecraft-normal-'+width+'-before'),a=await capture(after,'minecraft-normal-'+width+'-after');themed(a.state);assert.deepEqual(a.state,b.state,'settled geometry, colors, nav and preferences unchanged');assert.deepEqual(a.png,b.png,'settled viewport pixels unchanged');await parity(after.page);assert.equal(await after.page.locator('#ex1').isChecked(),true);assert.equal(await after.page.locator('#railProg').textContent(),'1/10');await keyboard(after.page);await after.page.reload({waitUntil:'load'});await parity(after.page);assert.deepEqual(await after.page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),saved);report.cases.push({kind:'normal',width,pixelIdentical:true,state:a.state});assert.deepEqual(before.errors,[]);assert.deepEqual(after.errors,[]);assert.deepEqual(before.missing,[]);assert.deepEqual(after.missing,[]);await before.context.close();await after.context.close();console.log('PASS Minecraft settled',width);
  }
  for(const kind of['script-held','script-failed','no-js','fonts-held','fonts-failed'])for(const width of[320,1440]){
   const before=await open(baseline,width,kind),after=await open(root,width,kind);const hold=kind.endsWith('-held');
   if(!hold){await before.page.waitForLoadState('load');await after.page.waitForLoadState('load');}
   if(kind==='fonts-held'){await before.page.waitForLoadState('domcontentloaded');await after.page.waitForLoadState('domcontentloaded');}
   const b=await capture(before,'minecraft-'+kind+'-'+width+'-before',!kind.startsWith('fonts')),a=await capture(after,'minecraft-'+kind+'-'+width+'-after',!kind.startsWith('fonts'));themed(a.state);
   let controlState=null;
   if(['script-held','script-failed','no-js'].includes(kind)){
    if(baselineHasFix){
     themed(b.state);assert.deepEqual(a.state,b.state,'already-fixed actual PR base retains identical initial appearance');
     const control=await open(root,width,kind,false,true);if(!hold)await control.page.waitForLoadState('load');
     controlState=(await capture(control,'minecraft-'+kind+'-'+width+'-defect-control')).state;
     if(hold)await control.release();assert.deepEqual(control.errors,[]);assert.deepEqual(control.missing,[]);await control.context.close();
    }else controlState=b.state;
    assert.throws(()=>themed(controlState),'defect fixture must fail the positive initial-render contract');assert.equal(controlState.nav.height,0,'negative control reproduces missing navigation');assert.equal(controlState.body.background,'rgb(11, 18, 14)','negative control reproduces fallback palette');
   }
   else{assert.deepEqual(a.state,b.state,'font loading behavior remains unchanged');assert.deepEqual(a.png,b.png,'font-controlled viewport pixels match the actual base');}
   let focusPreserved=null,settled=null,fontLoading=null;
   if(kind==='script-held'){
    assert.ok(after.pending.length>0);await after.page.locator('#nav summary').focus();await after.page.keyboard.press('Enter');await after.page.keyboard.press('Tab');await after.page.evaluate(()=>window.__initialNavFocus=document.activeElement);
    assert.equal(await after.page.locator('#nav details').getAttribute('open'),'');await after.release();await after.page.waitForLoadState('load');
    focusPreserved=await after.page.evaluate(()=>document.activeElement===window.__initialNavFocus&&document.querySelector('#nav details').open);assert.ok(focusPreserved,'delayed JavaScript retains focus and open More');
    await after.page.locator('#nav summary').focus();await after.page.keyboard.press('Enter');await parity(after.page);await after.page.evaluate(()=>document.activeElement.blur());await after.page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    settled=(await capture(after,'minecraft-'+kind+'-'+width+'-released')).state;assert.deepEqual(settled.nav,a.state.nav,'no script-induced nav geometry jump');assert.deepEqual(settled.heading,a.state.heading,'no script-induced heading jump');await before.release();
   }else if(kind==='fonts-held'){
    assert.ok(after.pending.length>0&&before.pending.length>0,'both fixtures hold real font requests');
    const heldAfter=await fontState(after.page),heldBefore=await fontState(before.page);assert.deepEqual(heldAfter,heldBefore,'held font readiness is identical');
    await after.release();await before.release();await after.page.waitForLoadState('load');await before.page.waitForLoadState('load');const ar=await capture(after,'minecraft-fonts-'+width+'-released'),br=await capture(before,'minecraft-fonts-'+width+'-released-before');themed(ar.state);assert.deepEqual(ar.state,br.state,'font release retains original settled behavior');assert.deepEqual(ar.png,br.png,'released-font viewport pixels match the actual base');assert.notDeepEqual(ar.png,a.png,'held font negative control changes glyph pixels after release');settled=ar.state;
    const releasedAfter=await fontState(after.page),releasedBefore=await fontState(before.page);assertFontsReleased(heldAfter,releasedAfter);assertFontsReleased(heldBefore,releasedBefore);assert.deepEqual(releasedAfter,releasedBefore,'released font readiness is identical');
    // Rewrapping is engine/font-metric dependent. Preserve the actual baseline's
    // measured delta rather than require Chrome to match WebKit's line breaks.
    const navDelta=settled.nav.height-a.state.nav.height;assert.equal(navDelta,br.state.nav.height-b.state.nav.height,'font-swap geometry delta remains identical');
    fontLoading={held:heldAfter,released:releasedAfter,navHeightDelta:navDelta};
   }else await keyboard(after.page);
   assert.deepEqual(after.errors,[]);assert.deepEqual(before.errors,[]);assert.deepEqual(after.missing,[]);assert.deepEqual(before.missing,[]);
   if(kind!=='no-js')assert.deepEqual(await after.page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),saved);
   report.cases.push({kind,width,initial:a.state,baseline:b.state,control:controlState,settled,focusPreserved,fontLoading});await before.context.close();await after.context.close();console.log('PASS Minecraft initial rendering',kind,width);
  }
  // Independent footage: do not inspect styles, geometry or take screenshots
  // during these held-script recordings. Frames can be reviewed without the
  // screenshot synchronization path perturbing first visible content.
  report.videos=[];
  for(const width of[320,1440])for(const [source,label,negativeControl]of[[baseline,'before',false],[root,'after',false],...(baselineHasFix?[[root,'defect-control',true]]:[])]){const item=await open(source,width,'script-held',true,negativeControl);await delay(3000);await item.release();await item.page.waitForLoadState('load');await delay(1200);await item.context.close();const file='minecraft-script-held-'+width+'-'+label+'.webm';fs.renameSync(await item.video.path(),path.join(out,file));report.videos.push(file);}
  assert.equal(report.downloads,0);report.status='passed';
 }catch(error){report.status='failed';report.error=error.stack;throw error;}
 finally{report.durationMs=Date.now()-started;fs.writeFileSync(path.join(out,'minecraft-initial-report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
