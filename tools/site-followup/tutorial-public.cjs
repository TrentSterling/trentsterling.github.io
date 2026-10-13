#!/usr/bin/env node
'use strict';
// Three exact public GETs only. No browser, script evaluation, redirects or link discovery.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('./contract.cjs');
const INDEX_SHA256='d0d642615d7baab76a62149d1adfb14dc05d2eac652fed800fb9e4f0165971f0';
const ROUTES=Object.freeze(['/tutorials/','/tutorials/gemini.md','/tutorials/gemini.html']);
const MAX_BYTES=1024*1024;
function allowed(url){C.assertPublic(url);assert.ok(ROUTES.some(route=>url===C.HOST+route),'only the three exact tutorial URLs are allowed');return url;}
function checkBody(url,{status,contentType,bytes}){
 allowed(url);assert.equal(status,200,'public endpoint must return 200 without redirect');assert.ok(bytes.length<=MAX_BYTES,'response byte cap');
 const text=bytes.toString(),sha256=C.sha256(bytes);assert.equal(C.unavailable(text),false,'no intermediary error page');
 const result={url,status,contentType,bytes:bytes.length,sha256};
 if(url.endsWith('/gemini.md')){assert.match(contentType||'',/^text\/markdown\b/i);assert.equal(sha256,C.GEMINI_MARKDOWN_SHA256,'authentic public roadmap Markdown');result.exactReviewedMarkdown=true;}
 else{
  assert.match(contentType||'',/^text\/html\b/i);assert.match(text,/<\/html>\s*$/i,'complete HTML document');
  if(url===C.HOST+'/tutorials/'){assert.equal(sha256,INDEX_SHA256,'public hub exactly matches browser-tested candidate');result.exactBrowserTestedCandidate=true;}
  else{
   const canonicalTags=[...text.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]).filter(tag=>/\brel\s*=\s*["']canonical["']/i.test(tag));
   assert.equal(canonicalTags.length,1);assert.match(canonicalTags[0],/\bhref\s*=\s*["']https:\/\/tront\.xyz\/tutorials\/gemini\.html["']/i);
   assert.match(text,/<h1\b[^>]*>\s*Game Development Tutorials\s*<\/h1>/i);assert.match(text,/<h2\b[^>]*>\s*Roadmap\s*<\/h2>/i);
   result.standaloneMarkers={canonical:C.HOST+'/tutorials/gemini.html',h1:'Game Development Tutorials',h2:'Roadmap'};
  }
 }
 return result;
}
async function publicGet(url,fetcher=fetch){
 allowed(url);const started=Date.now(),response=await fetcher(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Accept-Encoding':'identity','User-Agent':'Tront-tutorial-release-check/1.0'}});
 assert.equal(response.status,200,'public endpoint must return 200');const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const{value,done}=await reader.read();if(done)break;size+=value.length;assert.ok(size<=MAX_BYTES,'response exceeds 1 MiB cap');chunks.push(value);}}finally{await reader.cancel();}
 const bytes=Buffer.concat(chunks),length=response.headers.get('content-length');if(length!==null&&!response.headers.get('content-encoding'))assert.equal(size,Number(length),'complete declared response body');
 return{...checkBody(url,{status:response.status,contentType:response.headers.get('content-type'),bytes}),elapsedMs:Date.now()-started};
}
async function main(){
 assert.equal(process.env.GITHUB_ACTIONS,'true','public requests run only in the reviewed GitHub runner');
 const out=path.resolve(process.env.SITE_FOLLOWUP_OUTPUT||'.local/site-followup');fs.mkdirSync(out,{recursive:true});
 const report={mode:'tutorial-public-get-only',started:new Date().toISOString(),tutorialMerge:'2e612cc80eac788d8b69215018af6009d4a25a15',browserTestedCandidate:'49e8e17db8375c3afc00a94fb476397bd7a6fbe1',expectedIndexSha256:INDEX_SHA256,bounds:{requests:3,concurrency:1,timeoutMs:12000,bytesPerResponse:MAX_BYTES,redirects:0,browser:false},results:[],errors:[]};
 try{for(const route of ROUTES){report.results.push(await publicGet(C.HOST+route));await new Promise(r=>setTimeout(r,250));}}catch(error){report.errors.push(error.message);process.exitCode=1;}
 report.finished=new Date().toISOString();report.status=report.errors.length?'failed':'passed';fs.writeFileSync(path.join(out,'tutorial-public.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
module.exports={INDEX_SHA256,ROUTES,MAX_BYTES,allowed,checkBody,publicGet};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
