#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {instrumentation,capture}=require('./capture.cjs');
const out=path.resolve(process.env.PAINT_AUDIT_OUTPUT||'.local/paint-audit');
const base=process.env.PAINT_AUDIT_BASE||'https://tront.xyz';
const light={version:1,preset:'light',mode:'light',count:4,angle:135,intensity:65,frost:88,pegs:['#75a1ce','#c5c0eb','#efd4b6','#8ec8c3'].map((color,i)=>({color,position:Math.round(i*100/3)}))};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function searchChecks(page,width,name){
 const input=page.locator('#search-input'),mobile=width<992;
 if(mobile)await page.locator('#search-trigger').click();else await input.focus();
 await input.pressSequentially('Trontop');await page.locator('#search-results article').first().waitFor();
 await page.screenshot({path:path.join(out,name+'-search-results.png')});
 await page.locator('#tront-theme-btn').click();
 const colors=[];
 for(const preset of ['light','dark']){
  const state=await page.locator('[name="preset"]').evaluate((select,preset)=>{
   select.value=preset;select.dispatchEvent(new Event('change',{bubbles:true}));
   const input=document.querySelector('#search-input'),css=getComputedStyle(input),api=window.TrontThemeEditor;
   const color=css.color.match(/[\d.]+/g).slice(0,3).map(Number),placeholder=getComputedStyle(input,'::placeholder').color.match(/[\d.]+/g).slice(0,3).map(Number);
   const bound=api.buildTokens(api.preset(preset)).bound;
   return {preset,color:css.color,background:css.backgroundColor,transition:css.transitionProperty,contrast:api.contrast(color,bound),placeholderContrast:api.contrast(placeholder,bound)};
  },preset);
  colors.push(state);assert.equal(state.background,'rgba(0, 0, 0, 0)');assert.equal(state.transition,'none');
  assert.ok(state.contrast>=4.5&&state.placeholderContrast>=4.5,'immediate search ink matches the new theme ground');
 }
 await page.keyboard.press('Escape');await input.focus();await input.press('Escape');
 assert.equal(await input.inputValue(),'');assert.equal(await page.locator('#search-result-wrapper').isVisible(),false);
 if(mobile){
  assert.equal(await page.locator('#search-trigger').evaluate(el=>el===document.activeElement),true);
  await page.locator('#search-trigger').click();assert.equal(await input.inputValue(),'');
  await input.pressSequentially('Trontop');await page.locator('#search-results article').first().waitFor();await page.locator('#search-cancel').click();
  assert.equal(await input.inputValue(),'');assert.equal(await page.locator('#search-result-wrapper').isVisible(),false);
  assert.equal(await page.locator('#search-trigger').evaluate(el=>el===document.activeElement),true);
  await page.locator('#sidebar-trigger').click();assert.equal(await page.locator('body').getAttribute('sidebar-display'),'');
  await page.locator('#mask').click();assert.equal(await page.locator('body').getAttribute('sidebar-display'),null);
 }else assert.equal(await input.evaluate(el=>el===document.activeElement),true);
 return {status:'passed',query:'Trontop',escape:true,cancel:mobile,sidebar:mobile,immediateContrast:colors};
}
async function main(){
 if(process.env.GITHUB_ACTIONS!=='true')throw Error('Use only the parent-approved read-only GitHub Actions runner.');
 if(!['tront.xyz','127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Unexpected audit origin');
 fs.mkdirSync(out,{recursive:true});
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,executablePath:process.env.THEME_BROWSER_EXECUTABLE||'/opt/google/chrome/chrome'});
 const report={started:new Date().toISOString(),browser:await browser.version(),scope:'Live released blog index/post only; cold and delayed-defer; isolated local preferences',cases:[],errors:[]};
 try{
  for(const route of ['/blog/','/blog/posts/trontop/'])for(const width of [390,1440])for(const savedLight of [false,true])for(const delayed of [false,true]){
   const name=`release-${route.includes('/posts/')?'post':'blog'}-${width}-${savedLight?'light':'dark'}-${delayed?'delay-defer':'cold'}`;
   const context=await browser.newContext({viewport:{width,height:900},colorScheme:'dark',serviceWorkers:'block'});
   try{
    await context.addInitScript(instrumentation,{saved:savedLight?light:null});
    const page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(20000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    if(delayed)await page.route('**/*',async r=>{if(new URL(r.request().url()).origin===base&&/\/assets\/js\/dist\/(home|post)\.min\.js$/.test(new URL(r.request().url()).pathname))await sleep(1200);await r.continue().catch(()=>{});});
    const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
    const result=await capture(page,cdp,name,()=>page.goto(base+route,{waitUntil:'domcontentloaded'}),delayed?'delay-defer':null);
    const raw=JSON.parse(fs.readFileSync(path.join(out,name,'report.json'),'utf8'));
    const fcp=raw.data?.paints.find(p=>p.name==='first-contentful-paint')?.startTime;
    const frames=raw.data?.frames.filter(f=>(fcp===undefined||f.t>=fcp)&&f.visible&&f.nav?.length===5)||[];
    assert.ok(Number.isFinite(fcp),'browser reported first contentful paint');
    assert.ok(frames.length,'real post-FCP navbar samples exist');
    const geometry=f=>f.nav.map(n=>({label:n.label,rect:n.rect})),final=geometry(frames.at(-1));
    for(const f of frames)assert.deepEqual(geometry(f),final,'Theme reveal must preserve live navbar geometry');
    assert.equal(frames.at(-1).theme.editor,savedLight?'light':'dark');
    assert.equal(raw.criticalFailures.length,0,'first-party scripts/styles must load');assert.deepEqual(errors,[]);
    assert.equal(raw.unavailable,false);assert.equal(raw.document.status,200);
    const entry={name,url:page.url(),geometryStable:true,postFCPSamples:frames.length,fontsStatus:raw.data.fontsStatus,paintSummary:result.summary,document:raw.document};
    if(route==='/blog/'&&!delayed)entry.search=await searchChecks(page,width,name);
    assert.deepEqual(errors,[],'no page errors after live search interactions');
    report.cases.push(entry);
   }catch(e){report.errors.push({name,message:e.message});}
   finally{await context.close();fs.writeFileSync(path.join(out,'post-release-summary.json'),JSON.stringify(report,null,2));}
  }
 }finally{await browser.close();report.finished=new Date().toISOString();fs.writeFileSync(path.join(out,'post-release-summary.json'),JSON.stringify(report,null,2));}
 if(report.errors.length||report.cases.some(c=>c.fontsStatus!=='loaded'||/blocked|inconclusive/.test(c.paintSummary.status)))process.exitCode=2;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
