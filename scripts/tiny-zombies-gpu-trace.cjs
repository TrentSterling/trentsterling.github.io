const {chromium}=require('playwright');const fs=require('fs');
(async()=>{
fs.mkdirSync('tiny-zombies-qa',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--use-angle=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--disable-gpu-watchdog']});
const page=await browser.newPage({viewport:{width:640,height:360}});page.setDefaultTimeout(180000);
const messages=[];page.on('console',m=>{messages.push(m.text());console.log(m.text())});page.on('pageerror',e=>{messages.push(String(e));console.log('PAGEERROR',String(e))});
await page.addInitScript(()=>{
 let rafs=0;const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=(f)=>++rafs===1?raf(f):0;
 const requestAdapter=navigator.gpu.requestAdapter.bind(navigator.gpu);
 navigator.gpu.requestAdapter=async(...a)=>{let adapter=await requestAdapter(...a);const rd=adapter.requestDevice.bind(adapter);adapter.requestDevice=async(...b)=>{let device=await rd(...b);device.lost.then(()=>window.__deviceLost=true);const create=device.createCommandEncoder.bind(device);let sequence=0;
 device.createCommandEncoder=(opts)=>{let encoder=create(opts);return new Proxy({}, {get(_t,key){if(key==='beginComputePass'||key==='beginRenderPass')return (...args)=>{let pass=encoder[key](...args),label=args[0]?.label||key;return new Proxy(pass,{get(t,k){if(k==='end')return ()=>{pass.end();const id=++sequence;console.log('SUBMIT',id,label);device.queue.submit([encoder.finish()]);window.__tracePass=device.queue.onSubmittedWorkDone().then(()=>{console.log('DONE',id,label);if(window.__deviceLost)throw new Error('DEVICE LOST AT '+label)}).catch(e=>{console.log('FAIL',id,label,String(e));throw e});encoder=create({label:'continued '+label});};const v=t[k];return typeof v==='function'?v.bind(t):v;}})};const v=encoder[key];return typeof v==='function'?v.bind(encoder):v;}})};
 return device;};return adapter;};
});
try{await page.goto('http://127.0.0.1:8080/tiny-zombies/v9-serial-trace.html');await page.waitForTimeout(180000);console.log('STATE',JSON.stringify(await page.evaluate(()=>({ready:window.__TINY_READY__,stats:window.__tiny?.stats,diagnostics:window.__tiny?.diagnostics,body:document.body.innerText}))));await page.screenshot({path:'tiny-zombies-qa/v9-trace.png',timeout:30000});}finally{fs.writeFileSync('tiny-zombies-qa/trace.json',JSON.stringify(messages,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
