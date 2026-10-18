'use strict';
const path=require('node:path');
const {installFrameSampler,summarizeFrames}=require('./frame-sampler.cjs');
const {hostEvidence,browserEvidence,writeReport}=require('./frame-diagnostics.cjs');
async function runWide({browser,context,state,root,check,mode}){
 const report={at:new Date().toISOString(),mode,status:'running',configuration:{width:2560,height:1440,warmupMs:2000,sampleMs:5000,pollMs:250,slots:12,threshold:.10},hostBefore:hostEvidence(root),decoders:{},mediaEvents:[]};
 let wide,wp;
 const save=()=>writeReport(root,'gallery-playback-load.json',report);
 save();
 try{
  report.browserBefore=await browserEvidence(browser);
  wide=await context(browser,{viewport:{width:2560,height:1440}});
  await wide.addInitScript(installFrameSampler,{intervalMs:250});wp=await wide.newPage();
  const media=await wide.newCDPSession(wp);await media.send('Media.enable');
  for(const event of ['playerPropertiesChanged','playerEventsAdded','playerMessagesLogged','playerErrorsRaised','playersCreated']){
   media.on('Media.'+event,data=>{report.mediaEvents.push({at:performance.now(),event,data});
    if(event==='playerPropertiesChanged')for(const p of data.properties)if(/decoder|resolution|codec/i.test(p.name))(report.decoders[data.playerId]??={})[p.name]=p.value;
   });
  }
  await wp.goto('http://127.0.0.1:8967/games/');await wp.locator('#preview-slopeloop-2026').scrollIntoViewIfNeeded();await wp.waitForTimeout(2000);
  report.before=await state(wp);
  await wp.evaluate(()=>window.__galleryFrameSampler.begin());
  await wp.waitForTimeout(5000);
  report.trace=await wp.evaluate(()=>window.__galleryFrameSampler.finish());
  report.after=await state(wp);
  report.measurement=summarizeFrames(report.trace);
  const {frames,drops,dropPercent}=report.measurement;Object.assign(report,{frames,drops,dropPercent});
  // Retain the former positional result for diagnosis only. It never gates CI.
  const legacyFrames=report.after.stats.reduce((n,v,i)=>n+v.total-(report.before.stats[i]?.total||0),0);
  const legacyDrops=report.after.stats.reduce((n,v,i)=>n+v.dropped-(report.before.stats[i]?.dropped||0),0);
  report.legacyInvalidComparison={frames:legacyFrames,drops:legacyDrops,dropPercent:legacyFrames?100*legacyDrops/legacyFrames:null};
  report.status=report.measurement.status==='invalid'?'invalid':report.measurement.passesPerformanceGate?'passed':'failed-performance';
  report.hostAfter=hostEvidence(root);report.browserAfter=await browserEvidence(browser);save();
  await wp.screenshot({path:path.join(root,'.local/gallery-wide.png')});
  check('A large desktop runs more than three previews within the twelve-slot cap',report.after.playing>3&&report.after.attached<=12&&report.after.visible,report.after);
  check('Expanded desktop frame accounting covers every element and source generation',report.measurement.status==='valid',{status:report.measurement.status,issues:report.measurement.issues,elapsedMs:report.measurement.elapsedMs});
  check('Expanded desktop playback advances with fewer than ten percent dropped frames',frames>300&&drops/frames<.10,{frames,drops,dropPercent});
 }catch(error){
  report.error=error.stack;
  if(report.status==='running')report.status='failed-setup';
  else if(report.status==='passed')report.status='failed-after-measurement';
  throw error;
 }finally{
  if(wp&&!report.trace)try{report.trace=await wp.evaluate(()=>window.__galleryFrameSampler?.finish());if(report.trace)report.measurement=summarizeFrames(report.trace);}catch(error){report.traceError=error.message;}
  if(!report.hostAfter)report.hostAfter=hostEvidence(root);
  if(!report.browserAfter)try{report.browserAfter=await browserEvidence(browser);}catch(error){report.browserEvidenceError=error.message;}
  save();
  if(wide)await wide.close();
 }
 return report;
}
module.exports={runWide};
