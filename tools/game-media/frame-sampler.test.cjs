'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {installFrameSampler,summarizeFrames}=require('./frame-sampler.cjs');
function fixture(change=()=>{}){
 const records=[],players=Array.from({length:12},(_,i)=>({id:i+1,generation:0,source:'clip-'+i,total:100,dropped:10,currentTime:2,paused:false,connected:true,src:'clip-'+i,documentHidden:false,visibilityState:'visible'}));
 const add=(at,reason,player,extra={})=>records.push({at,reason,...structuredClone(player),...extra});
 const all=(at,reason)=>{players.forEach(p=>add(at,reason,p));records.push({at,reason:'census:'+reason,attached:12,playing:12,ids:players.filter(p=>p.connected&&p.src).map(p=>p.id),documentHidden:false,visibilityState:'visible'});};
 all(0,'begin');
 for(let at=250;at<=5000;at+=250){players.forEach(p=>{p.total+=8;p.currentTime+=.25;});change({at,players,add,records});all(at,at===5000?'end':'poll');}
 records.forEach((r,i)=>r.sequence=i+1);return{start:{at:0,sequence:1},end:{at:5000,sequence:records.length},records,errors:[]};
}
const summary=change=>summarizeFrames(fixture(change));
test('stable all-twelve cohort counts monotonic interval deltas',()=>{const s=summary();assert.equal(s.frames,1920);assert.equal(s.drops,0);assert.equal(s.status,'valid');assert.equal(s.passesPerformanceGate,true);});
test('rotation retains retiring tails and counts new load/source generations',()=>{
 const s=summary(({at,players,add})=>{if(at!==4500)return;for(const p of players.slice(0,3)){add(at,'before:load',p,{terminal:true});p.generation++;p.source=null;p.src=null;p.total=0;p.dropped=0;add(at,'after:load',p,{knownZero:true});add(at,'before:src-property',p,{terminal:true});p.generation++;p.source='new-'+p.id;p.src=p.source;add(at,'after:src-property',p,{knownZero:true});}});
 assert.equal(s.status,'valid');assert.equal(s.frames,1920);assert.equal(s.generations.length,18);assert.equal(s.generations.filter(g=>g.generation===0).reduce((n,g)=>n+g.frames,0),1872);
});
test('actual element replacement never subtracts the removed element baseline',()=>{
 const s=summary(({at,players,add})=>{if(at!==4500)return;const old=players[0];old.paused=true;old.connected=false;add(at,'before:remove-element',old);players.push(old);players[0]={...old,id:99,generation:0,source:'replacement',src:'replacement',paused:false,connected:true,total:0,dropped:0};add(at,'discovered',players[0],{knownZero:true});});
 assert.equal(s.status,'valid');assert.equal(s.generations.length,13);assert.ok(s.frames>1920);assert.ok(s.generations.some(g=>g.id===1&&g.last.reason==='end'));
});
for(const sameSource of [false,true])test((sameSource?'same-source reload':'same-element different-source change')+' starts a known-zero generation',()=>{
 const s=summary(({at,players,add})=>{if(at!==2500)return;const p=players[0];add(at,'before:src-property',p,{terminal:true});p.generation++;if(!sameSource)p.source=p.src='changed';p.total=p.dropped=0;add(at,'after:src-property',p,{knownZero:true});});assert.equal(s.status,'valid');assert.equal(s.frames,1920);
});
test('src removal retains old identity and counts increment up to explicit load',()=>{
 const s=summary(({at,players,add})=>{if(at!==2500)return;const p=players[0];add(at,'before:remove-src',p);p.src=null;add(at,'after:remove-src',p);p.total+=2;p.dropped++;add(at,'before:load',p,{terminal:true});p.generation++;p.source=null;p.total=p.dropped=0;add(at,'after:load',p,{knownZero:true});add(at,'before:src-property',p,{terminal:true});p.generation++;p.source=p.src='restarted';add(at,'after:src-property',p,{knownZero:true});});assert.equal(s.status,'valid');assert.equal(s.frames,1922);assert.equal(s.drops,1);
});
for(const kind of ['total','dropped'])test(kind+' counter regression invalidates rather than clamps',()=>{const s=summary(({at,players})=>{if(at===2500)players[0][kind]=0;});assert.equal(s.status,'invalid');assert.equal(s.passesPerformanceGate,false);assert.ok(s.issues.some(x=>x.kind==='counter-regression'));});
test('drop delta cannot exceed total delta even when lifetime counters look valid',()=>{const s=summary(({at,players})=>{if(at===2500)players[0].dropped+=9;});assert.equal(s.status,'invalid');assert.ok(s.issues.some(x=>x.kind==='drop-delta-exceeds-total-delta'));});
test('looping currentTime with monotonic counters does not create an epoch',()=>{const s=summary(({at,players})=>{if(at===3000)players.forEach(p=>p.currentTime=0);});assert.equal(s.status,'valid');assert.equal(s.frames,1920);assert.equal(s.generations.length,12);});
test('missing retirement coverage is invalid',()=>{const s=summary(({at,players,add})=>{if(at===2500){players[0].generation++;players[0].total=players[0].dropped=0;add(at,'after:load',players[0],{knownZero:true});}});assert.ok(s.issues.some(x=>x.kind==='missing-retirement-snapshot'));assert.equal(s.passesPerformanceGate,false);});
test('nonzero post-reset/newborn counters remain invalid',()=>{for(const reason of ['after:src-property','discovered']){const s=summary(({at,players,add})=>{if(at===2500){const p=players[0];add(at,'before:load',p,{terminal:true});p.generation++;add(at,reason,p,{knownZero:false,coverageGap:true});}});assert.equal(s.status,'invalid');assert.ok(s.issues.some(x=>x.kind==='new-generation-without-zero-baseline'));}});
test('no frames is invalid, not a zero-percent pass',()=>{const t=fixture();t.records.filter(r=>r.id).forEach(r=>r.total=100);const s=summarizeFrames(t);assert.equal(s.status,'invalid');assert.equal(s.dropPercent,null);assert.ok(s.issues.some(x=>x.kind==='no-frame-progress'));});
test('visibility loss is retained and invalidates the workload',()=>{const s=summary(({at,players,add})=>{if(at===2500)add(at,'event:visibilitychange',players[0],{documentHidden:true,visibilityState:'hidden'});});assert.equal(s.status,'invalid');assert.ok(s.issues.some(x=>x.kind==='document-not-visible'));});
test('long poll gap, missing end, and missing twelve-player evidence cannot pass',()=>{
 for(const mutate of [t=>t.records=t.records.filter(r=>r.at<1000||r.at>2500),t=>t.end=null,t=>t.records.filter(r=>r.reason==='census:end').forEach(r=>r.attached=11)]){const t=fixture();mutate(t);assert.equal(summarizeFrames(t).passesPerformanceGate,false);}
});
test('real high drops remain a red performance gate with valid accounting',()=>{const s=summary(({players})=>players.forEach(p=>p.dropped+=4));assert.equal(s.status,'valid');assert.equal(s.dropPercent,50);assert.equal(s.passesPerformanceGate,false);});
test('duplicate snapshots do not double count frames',()=>{const s=summary(({at,players,add})=>{players.forEach(p=>{add(at,'event:pause',p);add(at,'before:remove-element',p);});});assert.equal(s.status,'valid');assert.equal(s.frames,1920);});

function hookHarness(){
 const document={hidden:false,visibilityState:'visible',querySelectorAll(){return list.filter(v=>v.isConnected);},addEventListener(){}};
 class Element{setAttribute(k,v){this.attrs[k]=String(v);}removeAttribute(k){delete this.attrs[k];}remove(){this.isConnected=false;}matches(){return true;}getAttribute(k){return this.attrs[k]??null;}getBoundingClientRect(){return{top:100,bottom:300,left:0,right:400,width:400,height:200};}closest(){return{id:'card'};}addEventListener(){}}
 class HTMLMediaElement extends Element{constructor(){super();this.attrs={};this.total=0;this.dropped=0;this.isConnected=true;this.paused=true;this.currentSrc='';this.currentTime=0;this.calls={load:0,src:0};}load(){this.calls.load++;if(this.throwLoad)throw new Error('native load failed');this.total=this.dropped=0;return 'native-load';}set src(v){this.calls.src++;if(this.throwSource)throw new Error('native src failed');this.attrs.src=String(v);this.currentSrc=String(v);this.total=this.dropped=0;}get src(){return this.attrs.src||'';}}
 class HTMLVideoElement extends HTMLMediaElement{getVideoPlaybackQuality(){return{totalVideoFrames:this.total,droppedVideoFrames:this.dropped,creationTime:now};}}
 const list=[],window={},intervals=[];let now=0;
 const context={document,window,HTMLMediaElement,HTMLVideoElement,Element,innerWidth:2560,innerHeight:1440,performance:{now:()=>now++},MutationObserver:class{observe(){}disconnect(){}},setInterval:f=>{intervals.push(f);return 1;},clearInterval(){}};
 window.addEventListener=()=>{};vm.runInNewContext('('+installFrameSampler.toString()+')()',context);
 return {video(){const v=new HTMLVideoElement();list.push(v);return v;},finish:()=>window.__galleryFrameSampler.finish(),poll:()=>intervals[0](),begin:()=>window.__galleryFrameSampler.begin(),HTMLMediaElement};
}
test('hooks preserve native calls/returns, src removal identity and detached final samples',()=>{
 const h=hookHarness(),v=h.video();v.src='old';assert.equal(v.calls.src,1);v.total=50;v.dropped=5;h.begin();v.removeAttribute('src');v.total=52;v.dropped=6;assert.equal(v.load(),'native-load');assert.equal(v.calls.load,1);v.remove();v.src='new';assert.equal(v.calls.src,2);h.poll();const t=h.finish(),removed=t.records.find(r=>r.reason==='after:remove-src'),before=t.records.find(r=>r.reason==='before:load');assert.equal(removed.source,'old');assert.equal(before.total,52);assert.equal(before.dropped,6);assert.equal(before.generation,removed.generation);assert.ok(t.records.some(r=>r.reason==='end'&&!r.connected));assert.equal(t.errors.length,0);
});
test('src property descriptor preserves get/enumerability/configurability',()=>{const h=hookHarness(),d=Object.getOwnPropertyDescriptor(h.HTMLMediaElement.prototype,'src');assert.equal(typeof d.get,'function');assert.equal(d.enumerable,false);assert.equal(d.configurable,true);});
test('a claimed zero with nonzero counters is invalid, never silently discarded',()=>{const s=summary(({at,players,add})=>{if(at===2500){const p=players[0];add(at,'before:load',p,{terminal:true});p.generation++;p.total=2;p.dropped=1;add(at,'after:load',p,{knownZero:true});}});assert.equal(s.status,'invalid');assert.ok(s.issues.some(x=>x.kind==='inconsistent-zero-baseline'));});
test('newborn frames after an actual zero snapshot count in full',()=>{const s=summary(({at,players,add})=>{if(at===2500){const p=players[0];add(at,'before:load',p,{terminal:true});p.generation++;p.total=p.dropped=0;add(at,'after:load',p,{knownZero:true});p.total=3;p.dropped=1;add(at,'event:playing',p);}});assert.equal(s.status,'valid');assert.equal(s.frames,1923);assert.equal(s.drops,1);});
test('all census identities must be unique and covered by actual element snapshots',()=>{
 for(const mutate of [t=>t.records=t.records.filter(r=>r.id!==12),t=>t.records.filter(r=>r.reason.startsWith('census:')).forEach(r=>r.ids[11]=1),t=>t.records.filter(r=>r.reason.startsWith('census:')).forEach(r=>delete r.ids)]){const t=fixture();mutate(t);const s=summarizeFrames(t);assert.equal(s.status,'invalid');assert.equal(s.passesPerformanceGate,false);}
});
test('load and src wrapper preserve native thrown errors and invoke once',()=>{const h=hookHarness(),v=h.video();v.throwLoad=true;v.throwSource=true;assert.throws(()=>v.load(),/native load failed/);assert.throws(()=>v.src='failed',/native src failed/);assert.equal(v.calls.load,1);assert.equal(v.calls.src,1);});
