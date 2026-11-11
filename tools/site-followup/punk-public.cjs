'use strict';
// Seven pinned public GETs. No browser, redirects, script execution, or crawling.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ORIGIN='https://punk.tront.xyz';
const EXPECTED=require('./punk-public-expected.json');
const MAX_BYTES=1024*1024;
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
function allowed(url){assert.ok(Object.keys(EXPECTED.files).some(route=>url===ORIGIN+route),'only seven pinned HackerPunk public URLs');return url;}
function checkBody(url,status,type,bytes){
 allowed(url);assert.equal(status,200,'no redirects or error responses');assert.ok(bytes.length<=MAX_BYTES,'response byte cap');
 const expected=EXPECTED.files[url.slice(ORIGIN.length)];assert.equal(sha256(bytes),expected.sha256,'served bytes must match the exact browser-tested source');assert.equal(bytes.length,expected.bytes);
 assert.match(type||'',expected.kind==='html'?/^text\/html\b/i:expected.kind==='css'?/^text\/css\b/i:/^(text|application)\/javascript\b/i);
 return {url,status,contentType:type,bytes:bytes.length,sha256:sha256(bytes)};
}
async function publicGet(url,fetcher=fetch){
 allowed(url);const started=Date.now(),response=await fetcher(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Accept-Encoding':'identity','User-Agent':'Tront-Punk-release-check/1.0'}});
 assert.equal(response.status,200);const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;assert.ok(size<=MAX_BYTES);chunks.push(part.value);}}finally{await reader.cancel();}
 return {...checkBody(url,response.status,response.headers.get('content-type'),Buffer.concat(chunks)),elapsedMs:Date.now()-started};
}
async function main(){
 assert.equal(process.env.GITHUB_ACTIONS,'true','public requests only in the reviewed runner');
 const report={mode:'punk-exact-public-get-only',candidate:EXPECTED.candidate,merge:EXPECTED.merge,started:new Date().toISOString(),bounds:{requests:7,concurrency:1,timeoutMs:12000,bytesPerResponse:MAX_BYTES,redirects:0,browser:false},results:[],errors:[]};
 for(const route of Object.keys(EXPECTED.files)){try{report.results.push(await publicGet(ORIGIN+route));}catch(error){report.errors.push({url:ORIGIN+route,error:error.message});}}
 report.finished=new Date().toISOString();report.pass=report.errors.length===0&&report.results.length===7;
 const out=path.resolve(process.env.SITE_FOLLOWUP_OUTPUT||'.local/site-followup');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'punk-public.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
}
module.exports={ORIGIN,EXPECTED,MAX_BYTES,allowed,checkBody,publicGet};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
