const {chromium}=require('playwright');const fs=require('fs');fs.mkdirSync('tiny-zombies-qa',{recursive:true});
(async()=>{const results=[];for(const mode of ['clear','post','ui','both'])for(const offscreen of [0,1]){let browser;const label=mode+'-'+offscreen;try{
browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--use-angle=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--disable-gpu-watchdog']});
const page=await browser.newPage({viewport:{width:640,height:360}});page.on('console',m=>console.log(label,m.text()));await page.goto('http://127.0.0.1:8080/tiny-zombies/render-probe.html?mode='+mode+'&offscreen='+offscreen+'&frames=2&w=640&h=360');await page.waitForTimeout(10000);
const report=await page.evaluate(()=>window.__RENDER_PROBE__);results.push({label,report});console.log('RESULT',label,JSON.stringify(report));await page.screenshot({path:'tiny-zombies-qa/'+label+'.png'});
}catch(e){results.push({label,error:String(e)});console.log('CASE ERROR',label,String(e))}finally{await browser?.close();fs.writeFileSync('tiny-zombies-qa/render-matrix.json',JSON.stringify(results,null,2));}}
})().catch(e=>{console.error(e);process.exit(1)});
