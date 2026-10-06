// Directly verify selected revised cards in the local gallery.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/trontstack/tmp/card-refresh/tools/node_modules/playwright');
const {root}=require('./server.cjs');
const keys=process.argv.slice(2);
if(!keys.length||keys.some(k=>!/^[a-z0-9-]+$/.test(k)))throw Error('Supply card slugs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1920,height:1080}});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.fulfill({status:200,body:''}));
  const page=await context.newPage();await page.goto('http://127.0.0.1:8965/games/');
  const rows=[];
  for(const key of keys){
   const selector='#preview-'+key;
   await page.locator(selector).evaluate(e=>e.scrollIntoView({block:'center'}));
   await page.waitForFunction(s=>{const v=document.querySelector(s+' video');return v&&!v.paused&&v.readyState>=2&&v.currentTime>.2&&v.getVideoPlaybackQuality().totalVideoFrames>8;},selector,{timeout:10000});
   rows.push({key,...await page.locator(selector+' video').evaluate(v=>({src:v.currentSrc,width:v.videoWidth,height:v.videoHeight,duration:v.duration,currentTime:v.currentTime,frames:v.getVideoPlaybackQuality().totalVideoFrames,error:v.error?.message||null}))});
   await page.screenshot({path:path.join(root,'.local/review/gallery-selected-'+key+'.png')});
  }
  fs.writeFileSync(path.join(root,'.local/selected-cards-browser-check.json'),JSON.stringify({at:new Date().toISOString(),rows},null,2));
  console.log('COMPLETE all '+rows.length+' selected cards autoplay and advance in Chrome');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
