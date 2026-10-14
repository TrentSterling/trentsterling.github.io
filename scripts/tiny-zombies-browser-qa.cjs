const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 fs.mkdirSync('tiny-zombies-qa',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--use-angle=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface']});
 const page=await browser.newPage({viewport:{width:960,height:540}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const report={coverage:'Real Chromium WebGPU with software rendering. No hardware FPS claim.',errors,steps:[]};
 async function snap(label){let state=await page.evaluate(async()=>({ready:window.__TINY_READY__,body:document.body.innerText,stats:window.__tiny?.stats,settings:window.__tiny?.settings,diagnostics:window.__tiny?.diagnostics,state:window.__tiny?await window.__tiny.readState():null,ballistics:window.__tiny?await window.__tiny.readBallistics():null}));report.steps.push({label,...state});fs.writeFileSync('tiny-zombies-qa/report.json',JSON.stringify(report,null,2));await page.screenshot({path:'tiny-zombies-qa/'+label+'.png'});console.log(label,JSON.stringify({ready:state.ready,frame:state.stats?.frame,stopped:state.stats?.stopped,pos:state.state?.slice(0,4),errors:state.diagnostics?.errors}));}
 try{
 await page.goto('http://127.0.0.1:8080/tiny-zombies/');await page.waitForFunction(()=>window.__TINY_READY__||document.querySelector('textarea'),{timeout:180000});await snap('01-startup');
 if(!await page.evaluate(()=>window.__TINY_READY__))throw new Error('Game failed startup');
 await page.mouse.click(600,220);await page.waitForTimeout(4000);await snap('02-click-start');
 await page.keyboard.down('w');await page.waitForTimeout(3000);await page.keyboard.up('w');await page.keyboard.press('e');await page.waitForTimeout(2000);await snap('03-move-interact');
 await page.mouse.move(700,220);await page.mouse.down();await page.waitForTimeout(10000);await page.mouse.up();await snap('04-fire');
 await page.keyboard.press('Space');await page.keyboard.press('z');await page.waitForTimeout(5000);await snap('05-grenade-melee');
 await page.keyboard.press('Escape');await page.waitForTimeout(500);await snap('06-paused');await page.keyboard.press('Escape');await page.keyboard.press('Backspace');await page.waitForTimeout(5000);await snap('07-restart');
 await page.keyboard.press('t');await page.waitForTimeout(15000);await snap('08-demo');
 if(errors.length||report.steps.some(x=>x.diagnostics?.errors?.length))throw new Error('Runtime errors observed');
 }catch(e){report.failure=String(e);try{await snap('failure')}catch{};throw e;}finally{fs.writeFileSync('tiny-zombies-qa/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
