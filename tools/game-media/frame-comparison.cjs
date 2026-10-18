'use strict';
// Each child launches its own browser. Always run the fresh-browser control,
// including when the original full sequence fails, without making a red gate green.
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {root:defaultRoot}=require('./server.cjs');
const {hostEvidence,writeReport}=require('./frame-diagnostics.cjs');
function runComparison({root=defaultRoot,run=spawnSync}={}){
const report={at:new Date().toISOString(),hostBefore:hostEvidence(root),cases:[]};
let failed=false;
try{
 for(const [name,args]of [['original-full-suite',[]],['fresh-browser-wide',['--wide-only']]]){
  const dir=path.join(root,'.local','gallery-frame-comparison',name);fs.mkdirSync(dir,{recursive:true});
  // Avoid attributing stale evidence to a child that fails before creating it.
  const priorFiles=new Map(['gallery-playback-load.json','gallery-verification.json','gallery-wide.png'].map(file=>{const source=path.join(root,'.local',file);return[file,fs.existsSync(source)?fs.statSync(source).mtimeMs:null];}));
  const before=hostEvidence(root),started=performance.now();
  const child=run(process.execPath,[path.join(__dirname,'verify.cjs'),...args],{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,env:process.env});
  fs.writeFileSync(path.join(dir,'stdout.log'),child.stdout||'');fs.writeFileSync(path.join(dir,'stderr.log'),child.stderr||'');
  process.stdout.write(child.stdout||'');process.stderr.write(child.stderr||'');
  const item={name,exitCode:child.status,signal:child.signal,error:child.error?.message,elapsedMs:performance.now()-started,hostBefore:before,hostAfter:hostEvidence(root),files:[]};
  for(const [file,mtime]of priorFiles){const source=path.join(root,'.local',file);if(fs.existsSync(source)&&fs.statSync(source).mtimeMs!==mtime){fs.copyFileSync(source,path.join(dir,file));item.files.push(file);}}
  if(item.files.includes('gallery-playback-load.json')){const wide=JSON.parse(fs.readFileSync(path.join(dir,'gallery-playback-load.json'),'utf8'));item.measurement=wide.measurement&&{status:wide.measurement.status,frames:wide.frames,drops:wide.drops,dropPercent:wide.dropPercent,issues:wide.measurement.issues};}
  item.complete=!!item.measurement&&item.files.includes('gallery-verification.json');
  failed ||= child.status!==0||!item.complete;
  report.cases.push(item);writeReport(root,'gallery-frame-comparison.json',report);
 }
}catch(error){failed=true;report.error=error.stack;throw error;}finally{
 const commits=report.cases.map(c=>c.hostBefore.commit);
 report.sameCommit=commits.length===2&&commits.every(commit=>typeof commit==='string'&&commit===commits[0]);
 report.expectedCommit=process.env.GALLERY_EXPECTED_SHA||null;
 report.comparable=report.sameCommit&&report.cases.every(c=>c.complete&&c.measurement.status==='valid'&&!c.signal&&!c.error)&&(!report.expectedCommit||commits[0]===report.expectedCommit);
 failed ||= !report.comparable;
 report.status=failed?'failed':'passed';report.hostAfter=hostEvidence(root);writeReport(root,'gallery-frame-comparison.json',report);
}
return report;
}
module.exports={runComparison};
if(require.main===module){try{if(runComparison().status!=='passed')process.exitCode=1;}catch(error){console.error(error);process.exitCode=1;}}
