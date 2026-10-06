// Read-only caching of public game assets. No telemetry or multiplayer transport.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {root,mounts}=require('./server.cjs');
const cache=path.join(root,'.local/dependencies');fs.mkdirSync(cache,{recursive:true});
const allowed=new Set(['tront.xyz','cdn.jsdelivr.net','unpkg.com','esm.sh','esm.run','cdnjs.cloudflare.com','threejs.org','cdn.rawgit.com','raw.githubusercontent.com','pmndrs.github.io','fonts.googleapis.com','fonts.gstatic.com']);
async function localBuilds(context){
 await context.addInitScript(()=>{Element.prototype.requestPointerLock=()=>Promise.resolve();});
 await context.routeWebSocket('**',ws=>ws.close());
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(['data:','blob:'].includes(u.protocol))return route.continue();
  if(/analytics|gtag|googletag|discord|nostr|tracker/i.test(u.href))return route.abort();
  let target=u.href,local;
  if(u.hostname==='127.0.0.1'){
   const m=u.pathname.match(/^\/capture\/([^/]+)\/(.*)$/);
   if(!m)return route.continue();
   const relative=!m[2]||m[2].endsWith('/')?m[2]+'index.html':m[2];
   const mounted=path.join(mounts[m[1]]||path.join(root,'.local/sources',m[1]),relative);
   if(fs.existsSync(mounted))return route.continue();
   // Downloaded fallbacks stay in the ignored copy, never a mounted game repo.
   local=path.join(root,'.local/sources',m[1],relative);
   target='https://tront.xyz/'+m[1]+'/'+m[2];
  }else if(!allowed.has(u.hostname))return route.abort();
  const id=crypto.createHash('sha256').update(target).digest('hex'),file=path.join(cache,id),meta=file+'.json';
  try{
   let info;
   if(fs.existsSync(meta)&&fs.existsSync(file))info=JSON.parse(fs.readFileSync(meta));
   else{
    const response=await fetch(target,{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error(response.status+' '+target);
    const body=Buffer.from(await response.arrayBuffer());
    info={url:target,redirect:response.url!==target?response.url:null,contentType:response.headers.get('content-type')||'application/octet-stream',bytes:body.length};
    fs.writeFileSync(file,body);fs.writeFileSync(meta,JSON.stringify(info));
   }
   if(!local&&info.redirect)return route.fulfill({status:302,headers:{Location:info.redirect,'Access-Control-Allow-Origin':'*'},body:''});
   if(local){fs.mkdirSync(path.dirname(local),{recursive:true});fs.copyFileSync(file,local);}
   return route.fulfill({path:file,contentType:info.contentType,headers:{'Access-Control-Allow-Origin':'*'}});
  }catch(e){console.log('ASSET UNAVAILABLE',target,e.message);return route.abort();}
 });
}
module.exports={localBuilds};
