const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/trontstack/tmp/card-refresh/tools/node_modules/playwright');
const {createServer,root}=require('./server.cjs');
const {localBuilds}=require('./local-builds.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(8968,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=d3d11','--mute-audio']});
 const output=path.join(root,'.local/inspection');fs.mkdirSync(output,{recursive:true});
 try{for(const entry of process.argv.slice(2)){
  const [slug,sub='']=entry.split(':');
  const c=await browser.newContext({viewport:{width:1280,height:720}});await localBuilds(c);
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto('http://127.0.0.1:8968/capture/'+slug+'/'+(sub?sub+'/':'')+'?room=local-gallery#solo=1',{waitUntil:'domcontentloaded',timeout:40000});await p.waitForTimeout(4000);
   const state=await p.evaluate(()=>({title:document.title,body:document.body.innerText.slice(0,6000),canvases:[...document.querySelectorAll('canvas')].map(c=>({id:c.id,w:c.width,h:c.height})),iframes:[...document.querySelectorAll('iframe')].map(f=>f.getAttribute('src')),globals:Object.keys(window).filter(k=>k.startsWith('__')||/^[A-Z][A-Z_]+$/.test(k)),buddy:window.__buddy?.state,buttons:[...document.querySelectorAll('button,input[type=button]')].map(b=>({id:b.id,text:b.textContent.slice(0,80)}))}));
   await p.screenshot({path:path.join(output,slug+'.png')});fs.writeFileSync(path.join(output,slug+'.json'),JSON.stringify({...state,errors},null,2));
   console.log(slug,JSON.stringify({title:state.title,canvases:state.canvases,iframes:state.iframes,globals:state.globals,errors}));
  }catch(e){console.log('INSPECT FAILED',slug,e.message);}finally{await c.close();}
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
})();
