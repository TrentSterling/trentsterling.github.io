const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/trontstack/tmp/card-refresh/tools/node_modules/playwright');
const {root,createServer}=require('./server.cjs');const {recordDOM}=require('./capture.cjs');
const source='C:/trontstack/device-history/dist',dest=path.join(root,'.local/sources/device-history');
fs.mkdirSync(dest,{recursive:true});fs.cpSync(source,dest,{recursive:true});
const index=path.join(dest,'index.html');fs.writeFileSync(index,fs.readFileSync(index,'utf8').replaceAll('"/assets/','"./assets/'));
const receipt=path.join(root,'.local/device-history');fs.mkdirSync(receipt,{recursive:true});
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(8968,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-background-timer-throttling']});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  await context.addInitScript({path:path.join(__dirname,'device-history-fixture.js')});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8968/capture/device-history/');await page.getByText('Monitoring 7 devices').waitFor();
  await page.waitForTimeout(600);await page.screenshot({path:path.join(receipt,'before.png')});
  if(process.argv.includes('--inspect')){console.log(await page.locator('body').innerText());return;}
  const recording=recordDOM(page,'device-history',10.5);
  await page.waitForFunction(()=>window.__captureStarted);const steps=[];const began=Date.now();
  async function mark(label){steps.push({label,seconds:(Date.now()-began)/1000});}
  await page.waitForTimeout(450);await page.evaluate(()=>{__deviceFixture.emit(1,false);setTimeout(()=>{const log=document.querySelector('.event-log');log.scrollTo({top:log.scrollHeight,behavior:'smooth'});},50);});await mark('Audio device disconnect');
  await page.waitForTimeout(650);await page.evaluate(()=>{__deviceFixture.emit(1,true);setTimeout(()=>{const log=document.querySelector('.event-log');log.scrollTo({top:log.scrollHeight,behavior:'smooth'});},50);});await mark('Audio device reconnect');
  await page.waitForTimeout(650);await page.getByRole('button',{name:/Known Devices/}).click();await mark('Known devices');
  await page.waitForTimeout(650);await page.getByPlaceholder('Search by name, class, manufacturer, VID:PID...').pressSequentially('USB',{delay:110});await mark('Search USB');
  await page.waitForTimeout(550);await page.locator('.known-card').filter({hasText:'USB Backup Drive'}).click();await mark('Open drive details');
  await page.waitForTimeout(500);await page.locator('.device-list-container').evaluate(e=>e.scrollTo({top:300,behavior:'smooth'}));await page.waitForTimeout(400);await mark('Drive capacity detail');
  await page.screenshot({path:path.join(receipt,'detail.png')});
  await page.waitForTimeout(1100);await page.getByRole('button',{name:'Mocha',exact:true}).click();await mark('Mocha theme');
  await page.waitForTimeout(750);await page.getByRole('button',{name:/Monitor/}).click();await mark('Return monitor');
  await page.waitForTimeout(700);await page.evaluate(()=>__deviceFixture.emit(6,false));await mark('Webcam disconnect');
  const capture=await recording;const state=await page.evaluate(()=>__deviceFixture.report());
  if(errors.length)throw Error(errors.join('\n'));
  if(steps.at(-1).seconds>capture.wallSeconds)throw Error('Actions exceeded capture duration');
  const sourceHashes=fs.readdirSync(path.join(source,'assets')).map(name=>({file:'assets/'+name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(source,'assets',name))).digest('hex')}));
  fs.writeFileSync(path.join(receipt,'capture.json'),JSON.stringify({at:new Date().toISOString(),source,sourceHashes,capture,steps,state,errors,method:'Original compiled Svelte frontend with in-memory sample-device IPC; page-local interactions; no native backend'},null,2));
  console.log('COMPLETE Device History original frontend',JSON.stringify({capture,steps,state,errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
