const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/trontstack/tmp/card-refresh/tools/node_modules/playwright');
const {root,createServer}=require('./server.cjs'),{recordDOM}=require('./capture.cjs');
const source=path.join(root,'.local/sources/splitter/index.html'),receipt=path.join(root,'.local/splitter');fs.mkdirSync(receipt,{recursive:true});
const text=fs.readFileSync('C:/share/SpeedSlap/README.md','utf8').repeat(25).slice(0,48000);
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(8968,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  await context.addInitScript(()=>{window.__copiedChunks=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>window.__copiedChunks.push(value)}});});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.fulfill({status:200,body:''}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8968/capture/splitter/');
  const framing='#header,#faq,#footer,.tront-about{display:none!important}';await page.addStyleTag({content:framing});
  await page.waitForTimeout(500);const recording=recordDOM(page,'splitter',9);await page.waitForFunction(()=>window.__captureStarted);const began=Date.now(),steps=[];
  async function mark(label){steps.push({label,seconds:(Date.now()-began)/1000,chunks:await page.locator('.chunk-box:visible').count()});}
  await page.waitForTimeout(300);await page.locator('#text-box').fill(text);await page.waitForTimeout(450);await mark('Paste 48000 characters');
  await page.waitForTimeout(450);await page.locator('#chunk-size').selectOption('10000');await mark('Choose 10000-character chunks');
  await page.waitForTimeout(550);await page.mouse.wheel(0,365);await page.waitForTimeout(450);await mark('Scroll to chunk grid');
  await page.locator('.chunk-box:visible').nth(0).click();await mark('Copy first chunk into isolated preview clipboard');
  await page.waitForTimeout(650);await page.locator('.chunk-box:visible').nth(1).click();await mark('Copy second chunk');
  await page.waitForTimeout(650);await page.locator('#chunk-size').selectOption('CUSTOM');await page.locator('#custom-size').fill('5000');await page.locator('#apply-button').click();await mark('Apply 5000-character chunks');
  await page.waitForTimeout(650);await page.locator('.chunk-box:visible').nth(2).click();await mark('Copy third smaller chunk');
  await page.waitForTimeout(600);await page.mouse.wheel(0,270);await mark('Show remaining chunks');
  const capture=await recording;if(errors.length)throw Error(errors.join('\n'));const copied=await page.evaluate(()=>__copiedChunks.map(s=>({length:s.length,hasStart:s.includes('[START PART'),hasEnd:s.includes('[END PART')})));
  if(copied.length!==3||copied.some(c=>!c.hasStart||!c.hasEnd))throw Error('Copy feedback did not contain original multipart output');
  if(steps.at(-1).seconds>capture.wallSeconds)throw Error('Actions exceed recorded duration');
  fs.writeFileSync(path.join(receipt,'capture.json'),JSON.stringify({at:new Date().toISOString(),sourceUrl:'https://tront.xyz/splitter/',sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),capture,steps,copied,errors,framing,method:'Original HTML and chunking script; public project README input; noninteractive promotional sections hidden; clipboard destination isolated in page memory'},null,2));
  console.log('COMPLETE Splitter4GPT original interactions',JSON.stringify({capture,steps,copied,errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
