#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const {isIntermediary}=require('./readiness.cjs');
const {blogContract}=require('./release-contract.cjs');
const root=path.resolve(process.env.PAINT_AUDIT_OUTPUT||'.local/paint-audit');
const main=process.env.PAINT_EXPECT_MAIN_ROOT,monke=process.env.PAINT_EXPECT_MONKE_ROOT,blog=process.env.PAINT_EXPECT_BLOG_ROOT;
const base=process.env.PAINT_AUDIT_BASE||'https://tront.xyz';
const files=[['/', 'index.html'],['/discord/','discord/index.html'],['/games/','games/index.html'],['/assets/js/tront-theme-editor.js','assets/js/tront-theme-editor.js'],['/assets/css/tront-theme-editor.css','assets/css/tront-theme-editor.css']].map(([url,file])=>({url:base+url,expected:main&&path.join(main,file)}));
files.push({url:'https://monke.tront.xyz/',expected:monke&&path.join(monke,'index.htm')});
files.push({url:base+'/blog/assets/css/tront-theme-bridge.css',expected:blog&&path.join(blog,'assets/css/tront-theme-bridge.css'),contract:'blog-css'}, {url:base+'/blog/',contract:'blog-page'}, {url:base+'/blog/posts/trontop/',contract:'blog-page'});
if(process.env.PAINT_HTTP_ROUTES)files.push(...JSON.parse(fs.readFileSync(process.env.PAINT_HTTP_ROUTES,'utf8')).map(r=>({url:r.url,expectedStatus:r.expectedStatus||200})));
async function mainRun(){
 if(process.env.GITHUB_ACTIONS!=='true')throw Error('Use the approved CI runner.');
 const report={started:new Date().toISOString(),requests:[],note:'Expected-byte comparisons only apply to directly served static files. Blog HTML needs a matching Jekyll production build; no guessed byte equality.'};
 for(const file of [...new Map([...files].reverse().map(f=>[f.url,f])).values()]){
  const u=new URL(file.url);if(!['tront.xyz','monke.tront.xyz','127.0.0.1','localhost'].includes(u.hostname))throw Error('Unexpected host');
  const record={url:file.url};
  try{
   const response=await fetch(file.url,{signal:AbortSignal.timeout(20000),redirect:'follow',headers:{'User-Agent':'Tront-public-site-read-only-audit'}});
   const bytes=Buffer.from(await response.arrayBuffer()),text=bytes.toString('utf8');
   Object.assign(record,{finalUrl:response.url,status:response.status,bytes:bytes.length,sha256:hash(bytes),contentType:response.headers.get('content-type'),etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified'),intermediary:isIntermediary(text)});
   if(file.expected){const expected=fs.readFileSync(file.expected);record.expectedSha256=hash(expected);record.expectedBytes=expected.length;record.match=record.sha256===record.expectedSha256;}
   if(file.contract)record.contract=blogContract(file.contract,text);
   record.ok=(!record.contract||Object.values(record.contract).every(Boolean))&&response.status===(file.expectedStatus||200)&&!record.intermediary&&record.match!==false;
  }catch(e){record.ok=false;record.error=e.message;}
  report.requests.push(record);fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'http-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(record));
 }
 fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'http-verification.json'),JSON.stringify(report,null,2));
 if(report.requests.some(r=>!r.ok))process.exitCode=1;
}
mainRun().catch(e=>{console.error(e);process.exitCode=1;});
