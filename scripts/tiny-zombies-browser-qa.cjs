'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const expected='39f5c2be80e58b80a94b89026e3d47ebf61e58b5f82ca35b6d37d90371cd7957';
(async()=>{
 const output=path.resolve('tiny-zombies-qa');fs.mkdirSync(output,{recursive:true});process.env.TINY_QA_OUTPUT=output;
 const bytes=fs.readFileSync('tiny-zombies/deadends-candidate.html'),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 if(hash!==expected)throw Error('Candidate hash mismatch: '+hash);
 const started=Date.now(),errors=[],report={candidateSha256:hash,coverage:'Real Chromium WebGPU, SwiftShader software rendering. Ordinary keyboard/pointer inputs and read-only telemetry. No hardware performance comparison.',started:new Date().toISOString(),errors,steps:[]};
 const write=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 const browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--use-angle=swiftshader','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--disable-gpu-watchdog','--mute-audio']});
 const page=await browser.newPage({viewport:{width:640,height:360}});page.setDefaultTimeout(180000);
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());console.log('BROWSER',m.type(),m.text())});
 await page.route('**/*',r=>{let u=new URL(r.request().url());if(u.pathname==='/favicon.ico')return r.fulfill({status:204,body:''});return u.hostname==='127.0.0.1'?r.continue():r.abort();});
 const ev=async expression=>page.evaluate(expression),sleep=ms=>page.waitForTimeout(ms);
 const key=async(code,down)=>{const k=/^Key[A-Z]$/.test(code)?code.slice(3).toLowerCase():/^Digit[0-9]$/.test(code)?code.slice(5):({ShiftLeft:'Shift',Space:' '})[code]||code;await page.keyboard[down?'down':'up'](k);};
 const pointer=async(x,y,button,down)=>{await page.mouse.move(x,y);await page.mouse[down?'down':'up']({button});};
 const pageAction=async(method,args)=>{if(method==='Input.dispatchMouseEvent'&&args.type==='mouseMoved')return page.mouse.move(args.x,args.y);if(method==='Page.reload')return page.reload({waitUntil:'domcontentloaded'});throw Error('Unsupported route action: '+method);};
 async function shot(label){await page.screenshot({path:path.join(output,label+'.png'),timeout:120000});const state=await ev('({ready:window.__TINY_READY__,stats:window.__tiny?.stats,settings:window.__tiny?.settings,errors:window.__tiny?.diagnostics?.errors,body:document.body.innerText})');report.steps.push({label,state,wallSeconds:(Date.now()-started)/1000});write();console.log('MILESTONE',label,JSON.stringify({frame:state.stats?.frame,stopped:state.stats?.stopped,errors:state.errors}));}
 const heartbeat=setInterval(async()=>{try{const progress=await ev('({ready:!!window.__TINY_READY__,frame:window.__tiny?.stats.frame,stage:window.__tiny?.stats.stage,simSeconds:typeof playerValues!=="undefined"?playerValues[24]:null,stopped:window.__tiny?.stats.stopped})');report.progress={wallSeconds:Math.round((Date.now()-started)/1000),...progress};write();console.log('PROGRESS',JSON.stringify(report.progress));}catch(e){console.log('Progress read unavailable:',String(e));}},30000);
 try{
  await page.goto('http://127.0.0.1:8080/tiny-zombies/deadends-candidate.html');await page.waitForFunction(()=>window.__TINY_READY__||document.querySelector('textarea'),null,{timeout:180000});await shot('00-startup');
  if(!await ev('!!window.__TINY_READY__'))throw Error('Game did not become ready');
  const {run}=await import('./tiny-zombies-deadends-route.mjs');const route=await run({ev,page:pageAction,key,pointer,sleep,shot});report.route={chapter1:!!route.completed,continued:!!route.continuationPassed,burnout:!!route.burnoutCompleted,persistence:!!route.burnoutPersistencePassed,fuelContract:route.fuelContract,blocked:route.blocked,windowExpired:route.windowExpired,t:route.result?.t};
  report.outcome=route.burnoutPersistencePassed&&route.fuelContractPassed?'passed':route.windowExpired?'observation-window-ended':'route-incomplete';if(errors.length){report.outcome='browser-error';throw Error('Browser errors observed');}
  if(!route.burnoutPersistencePassed||!route.fuelContractPassed)throw Error(route.windowExpired?'Bounded CI observation window ended before earned Burnout completion':'Ordinary route did not reach earned Burnout completion');
  report.passed=true;
 }catch(e){report.failure=String(e);try{await shot('failure');}catch(s){report.screenshotFailure=String(s);}throw e;}
 finally{clearInterval(heartbeat);report.finished=new Date().toISOString();write();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
