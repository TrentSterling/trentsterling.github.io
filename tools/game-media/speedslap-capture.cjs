// Record the unchanged extension content script over an actual local video.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/trontstack/tmp/card-refresh/tools/node_modules/playwright');
const {root,createServer}=require('./server.cjs'),{recordDOM}=require('./capture.cjs');
const source='C:/share/SpeedSlap',dest=path.join(root,'.local/sources/speedslap');fs.mkdirSync(dest,{recursive:true});
for(const name of ['content.js','injected.js','app_icon.png','manifest.json'])fs.copyFileSync(path.join(source,name),path.join(dest,name));
fs.writeFileSync(path.join(dest,'player.html'),'<!doctype html><meta charset="utf-8"><title>SpeedSlap local playback capture</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#101018}video{width:100%;height:100%;object-fit:cover}</style><video autoplay loop muted playsinline src="/.local/native/ducktoy/ducktoy-flock.mp4"></video><script src="./content.js"></script>');
const receipt=path.join(root,'.local/speedslap');fs.mkdirSync(receipt,{recursive:true});
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(8968,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  await context.addInitScript(()=>{
   localStorage.setItem('uiX','40px');localStorage.setItem('uiY','80px');
   const listeners=[],data={enableCaptions:false,minSpeed:.5,maxSpeed:10,toggleSpeed:3};
   const area={get:(keys,cb)=>setTimeout(()=>cb(Object.fromEntries(keys.filter(k=>k in data).map(k=>[k,data[k]]))),0),set:(values,cb)=>{Object.assign(data,values);if(cb)setTimeout(cb,0);}};
   window.chrome={runtime:{getURL:name=>'/capture/speedslap/'+name},storage:{sync:area,local:area,onChanged:{addListener:fn=>listeners.push(fn)}}};
  });
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8968/capture/speedslap/player.html');await page.waitForFunction(()=>document.querySelector('video').currentTime>.1);await page.mouse.move(100,150);await page.waitForTimeout(400);
  const recording=recordDOM(page,'speedslap',9);await page.waitForFunction(()=>window.__captureStarted);const started=Date.now(),steps=[];
  async function check(label,expected){const rate=await page.locator('video').evaluate(v=>v.playbackRate);if(rate!==expected)throw Error(label+': rate '+rate);steps.push({label,rate,seconds:(Date.now()-started)/1000});}
  await page.waitForTimeout(450);await page.getByRole('button',{name:'SLAP OFF',exact:true}).click();await check('Toggle SLAP',3);
  await page.waitForTimeout(650);await page.mouse.move(150,150);await page.mouse.wheel(0,-120);await check('Wheel speed up',3.5);
  await page.waitForTimeout(600);await page.keyboard.press('BracketRight');await check('Keyboard speed up',4);
  await page.waitForTimeout(650);await page.keyboard.press('BracketLeft');await check('Keyboard slow down',3.5);
  await page.waitForTimeout(650);await page.keyboard.press('Backquote');await check('Reset',1);
  await page.waitForTimeout(650);await page.mouse.move(250,92);await page.mouse.down();await page.mouse.move(820,92,{steps:30});await page.mouse.up();await check('Drag original overlay',1);
  await page.waitForTimeout(650);await page.getByRole('button',{name:'SLAP OFF',exact:true}).click();await check('Toggle at new position',3);
  await page.waitForTimeout(650);await page.keyboard.press('Backquote');await check('Reset at new position',1);
  const capture=await recording;if(errors.length)throw Error(errors.join('\n'));
  const position=await page.getByRole('button',{name:'SLAP OFF',exact:true}).evaluate(b=>{const r=b.parentElement.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
  if(position.x<500)throw Error('Overlay drag did not move');
  const hashes=['content.js','injected.js','app_icon.png','manifest.json'].map(name=>({name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dest,name))).digest('hex')}));
  fs.writeFileSync(path.join(receipt,'capture.json'),JSON.stringify({at:new Date().toISOString(),source,hashes,capture,steps,position,errors,method:'Unchanged extension content script; real HTML video playback-rate changes; page-local input and isolated in-memory extension storage; captions disabled'},null,2));
  console.log('COMPLETE SpeedSlap original controls',JSON.stringify({capture,steps,position,errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
