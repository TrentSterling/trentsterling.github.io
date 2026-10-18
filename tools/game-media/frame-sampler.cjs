'use strict';

// Test instrumentation only. Installed before the gallery script in the wide case.
// Native methods run exactly once; no play, pause, seek, source or scheduling policy
// is added here. Source removal does not reset the quality counters; load() does.
function installFrameSampler({intervalMs = 250} = {}) {
  const videos = new Map(), ids = new WeakMap(), records = [], errors = [];
  let nextId = 0, sequence = 0, timer, start = null, end = null, stopped = false;
  const isVideo = value => value instanceof HTMLVideoElement && value.matches('.gameplay-preview');
  const safely = fn => { try { return fn(); } catch (error) { errors.push({at:performance.now(),message:String(error)}); } };
  function register(video) {
    if (!ids.has(video)) {
      ids.set(video, ++nextId);
      const q = video.getVideoPlaybackQuality();
      videos.set(video, {id:nextId, generation:0, source:video.getAttribute('src'), attribute:video.getAttribute('src')});
      record('discovered', video, {knownZero:q.totalVideoFrames === 0 && q.droppedVideoFrames === 0}, q);
      for (const type of ['loadstart','emptied','loadedmetadata','loadeddata','canplay','playing','pause','waiting','stalled','ended','error','abort']) {
        video.addEventListener(type, () => safely(() => record('event:'+type, video)));
      }
    }
    return videos.get(video);
  }
  function record(reason, video, detail = {}, quality) {
    const item = videos.get(video), q = quality || video.getVideoPlaybackQuality(), r = video.getBoundingClientRect();
    records.push({sequence:++sequence, at:performance.now(), reason, ...detail,
      id:item.id, generation:item.generation, source:item.source,
      src:video.getAttribute('src'), currentSrc:video.currentSrc,
      card:video.closest('[data-preview]')?.id || null,
      total:q.totalVideoFrames, dropped:q.droppedVideoFrames, qualityCreatedAt:q.creationTime,
      currentTime:video.currentTime, paused:video.paused, ended:video.ended,
      readyState:video.readyState, networkState:video.networkState,
      videoWidth:video.videoWidth, videoHeight:video.videoHeight,
      connected:video.isConnected, documentHidden:document.hidden, visibilityState:document.visibilityState,
      rect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height},
      visible:video.isConnected && r.bottom>64 && r.top<innerHeight && r.right>0 && r.left<innerWidth && r.width>0 && r.height>0});
  }
  function sample(reason) {
    if (stopped) return;
    document.querySelectorAll('.gameplay-preview').forEach(register);
    for (const [video, item] of videos) {
      if (video.getAttribute('src') !== item.attribute) {
        record('unobserved-source-change',video,{coverageGap:true});
        item.attribute=video.getAttribute('src');
      }
      record(reason,video);
    }
    const attached=[...document.querySelectorAll('.gameplay-preview[src]')];
    records.push({sequence:++sequence,at:performance.now(),reason:'census:'+reason,
      attached:attached.length,playing:attached.filter(v=>!v.paused).length,
      documentHidden:document.hidden,visibilityState:document.visibilityState,
      ids:attached.map(v=>ids.get(v))});
  }
  function boundary(video, reason, operation) {
    if (!isVideo(video) || stopped) return operation();
    safely(() => {register(video);record('before:'+reason,video,{terminal:true});});
    try { return operation(); }
    finally {
      safely(() => {
        const item=videos.get(video);item.generation++;item.source=video.getAttribute('src');item.attribute=item.source;
        const q=video.getVideoPlaybackQuality();
        record('after:'+reason,video,{knownZero:q.totalVideoFrames===0&&q.droppedVideoFrames===0,
          coverageGap:q.totalVideoFrames!==0||q.droppedVideoFrames!==0}, q);
      });
    }
  }
  const media=HTMLMediaElement.prototype, element=Element.prototype;
  const load=media.load, src=Object.getOwnPropertyDescriptor(media,'src');
  media.load=function(...args){return boundary(this,'load',()=>Reflect.apply(load,this,args));};
  Object.defineProperty(media,'src',{...src,set(value){return boundary(this,'src-property',()=>Reflect.apply(src.set,this,[value]));}});
  const setAttribute=element.setAttribute, removeAttribute=element.removeAttribute, remove=element.remove;
  element.setAttribute=function(name,...args){
    if (String(name).toLowerCase()==='src') return boundary(this,'src-attribute',()=>Reflect.apply(setAttribute,this,[name,...args]));
    return Reflect.apply(setAttribute,this,[name,...args]);
  };
  element.removeAttribute=function(name,...args){
    const watched=isVideo(this)&&String(name).toLowerCase()==='src'&&!stopped;
    if(watched)safely(()=>{register(this);record('before:remove-src',this);});
    try{return Reflect.apply(removeAttribute,this,[name,...args]);}
    finally{if(watched)safely(()=>{videos.get(this).attribute=this.getAttribute('src');record('after:remove-src',this);});}
  };
  element.remove=function(...args){
    if(isVideo(this)&&!stopped)safely(()=>{register(this);record('before:remove-element',this);});
    // Removal is not a reset. Retain the actual object and sample it through end,
    // even if a future loader removes it while it is still playing.
    return Reflect.apply(remove,this,args);
  };
  const observer=new MutationObserver(()=>safely(()=>sample('mutation')));
  observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  document.addEventListener('visibilitychange',()=>safely(()=>sample('visibilitychange')),true);
  window.addEventListener('pagehide',()=>safely(()=>sample('pagehide')),true);
  timer=setInterval(()=>safely(()=>sample('poll')),intervalMs);
  window.__galleryFrameSampler={
    begin(){start={at:performance.now(),sequence:sequence+1};sample('begin');return start;},
    finish(){if(!end){sample('end');end={at:performance.now(),sequence};clearInterval(timer);observer.disconnect();stopped=true;}
      return {version:1,intervalMs,start,end,records,errors};}
  };
}

function summarizeFrames(trace) {
  const issues=[], observations=[], generations=new Map(), byElement=new Map();
  let frames=0,drops=0,coveredPlayerMs=0,previousCensus=null;
  const issue=(kind,row,extra={})=>issues.push({kind,sequence:row?.sequence,id:row?.id,generation:row?.generation,...extra});
  if(!trace.start||!trace.end)issue('missing-measurement-boundary');
  for(const error of trace.errors||[])issue('instrumentation-error',null,error);
  const rows=(trace.records||[]).filter(r=>r.sequence>=trace.start?.sequence&&r.sequence<=trace.end?.sequence);
  const censuses=[];
  for(const row of rows){
    if(row.documentHidden||row.visibilityState!=='visible')issue('document-not-visible',row);
    if(row.reason.startsWith('census:')){
      censuses.push(row);
      if(!Array.isArray(row.ids)||row.ids.length!==row.attached||new Set(row.ids).size!==row.attached)issue('invalid-census-identities',row);
      for(const id of row.ids||[]){const generation=byElement.get(id);if(!generation||generation.last.at>row.at||!generation.last.connected||!generation.last.src)issue('uncovered-census-element',row,{missingId:id});}
      if(row.attached>12||row.playing>12)issue('slot-cap-exceeded',row);
      if(previousCensus&&row.at-previousCensus.at>1000)issue('observation-gap',row,{elapsedMs:row.at-previousCensus.at});
      previousCensus=row;continue;
    }
    if(!Number.isInteger(row.total)||!Number.isInteger(row.dropped)||row.total<0||row.dropped<0||row.dropped>row.total){issue('invalid-counters',row);continue;}
    if(row.coverageGap)issue('unobserved-reset-or-source-transition',row);
    if(row.knownZero&&(row.total!==0||row.dropped!==0))issue('inconsistent-zero-baseline',row);
    const key=row.id+':'+row.generation;
    let generation=generations.get(key);
    if(!generation){
      const prior=byElement.get(row.id);
      if(prior&&(!prior.last.terminal||prior.last.sequence>=row.sequence))issue('missing-retirement-snapshot',row);
      const baseline=row.reason==='begin';
      if(!baseline&&!row.knownZero)issue('new-generation-without-zero-baseline',row);
      generation={id:row.id,generation:row.generation,source:row.source,frames:0,drops:0,first:row,last:row,snapshots:0};
      generations.set(key,generation);byElement.set(row.id,generation);
    }else{
      const before=generation.last,dt=row.total-before.total,dd=row.dropped-before.dropped;
      if(dt<0||dd<0)issue('counter-regression',row,{previousTotal:before.total,previousDropped:before.dropped});
      else{
        // Chromium may count a decoded/queued frame before it is later dropped.
        // Preserve this timing observation AND both monotonic increments. Only
        // complete generation/window totals are used for ratio consistency.
        if(dd>dt)observations.push({kind:'drop-delta-exceeds-total-delta',sequence:row.sequence,
          previousSequence:before.sequence,id:row.id,generation:row.generation,totalDelta:dt,dropDelta:dd});
        frames+=dt;drops+=dd;generation.frames+=dt;generation.drops+=dd;
        if(before.connected&&before.src&&!before.paused)coveredPlayerMs+=row.at-before.at;
      }
      if(row.source!==generation.source)issue('source-identity-changed-within-generation',row);
    }
    generation.snapshots++;generation.last=row;
  }
  for(const generation of generations.values()){
    const next=byElement.get(generation.id);
    if(generation.drops>generation.frames)issue('generation-window-drop-excess',generation.last,{frames:generation.frames,drops:generation.drops});
    if(generation.frames!==generation.last.total-generation.first.total||generation.drops!==generation.last.dropped-generation.first.dropped)issue('generation-sum-does-not-telescope',generation.last);
    if(next===generation&&generation.last.reason!=='end')issue('missing-final-snapshot',generation.last);
  }
  if(drops>frames)issue('window-drop-excess',null,{frames,drops});
  if(!frames)issue('no-frame-progress');
  const endpoints=censuses.filter(r=>r.reason==='census:begin'||r.reason==='census:end');
  if(endpoints.length!==2||endpoints.some(r=>r.attached!==12||r.playing!==12))issue('twelve-player-endpoint-workload-not-observed');
  const elapsedMs=trace.start&&trace.end?trace.end.at-trace.start.at:null;
  if(elapsedMs===null||elapsedMs<5000)issue('sample-shorter-than-five-seconds');
  return {status:issues.length?'invalid':'valid',frames,drops,dropPercent:frames?100*drops/frames:null,
    elapsedMs,coveredPlayerMs,issues,observations,censuses,
    generations:[...generations.values()].map(({first,last,...g})=>({...g,first,last})),
    passesPerformanceGate:issues.length===0&&frames>300&&drops/frames<.10};
}
module.exports={installFrameSampler,summarizeFrames};
