'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {runComparison}=require('./frame-comparison.cjs');
const root=path.resolve(__dirname,'../..');
test('fresh browser control still runs after full-sequence failure and retains both reports',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gallery-accounting-fixture-'));let calls=0;
 const report=runComparison({root:dir,run(executable,args){calls++;assert.equal(args.includes('--wide-only'),calls===2);fs.mkdirSync(path.join(dir,'.local'),{recursive:true});for(const [file,data]of [['gallery-playback-load.json',{measurement:{status:'valid',issues:[]},frames:1800,drops:calls===1?900:0,dropPercent:calls===1?50:0}],['gallery-verification.json',{status:calls===1?'failed':'passed'}]]){const p=path.join(dir,'.local',file);fs.writeFileSync(p,JSON.stringify(data));fs.utimesSync(p,1000+calls,1000+calls);}return{status:calls===1?1:0,stdout:'',stderr:''};}});
 assert.equal(calls,2);assert.equal(report.status,'failed');assert.equal(report.cases[0].measurement.dropPercent,50);assert.equal(report.cases[1].measurement.dropPercent,0);
 for(const name of ['original-full-suite','fresh-browser-wide'])assert.ok(fs.existsSync(path.join(dir,'.local/gallery-frame-comparison',name,'gallery-playback-load.json')));
 fs.rmSync(dir,{recursive:true,force:true});
});
test('aborted or missing evidence cannot be reported as a comparable pass',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gallery-accounting-fixture-'));let calls=0;
 const report=runComparison({root:dir,run(){calls++;return{status:null,signal:'SIGTERM',stdout:'',stderr:''};}});assert.equal(calls,2);assert.equal(report.status,'failed');assert.equal(report.comparable,false);assert.ok(report.cases.every(c=>!c.complete));fs.rmSync(dir,{recursive:true,force:true});
});
test('CI uses two sequential browser processes and always retains raw evidence',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/site-checks.yml'),'utf8'),wide=fs.readFileSync(path.join(__dirname,'frame-wide.cjs'),'utf8'),verify=fs.readFileSync(path.join(__dirname,'verify.cjs'),'utf8');
 for(const text of ['node --test tools/game-media/frame-*.test.cjs','node tools/game-media/frame-comparison.cjs','.local/gallery-frame-comparison/**','GALLERY_EXPECTED_SHA: ${{ github.event.pull_request.head.sha }}'])assert.ok(workflow.includes(text));
 assert.ok(wide.indexOf('report.browserAfter=await browserEvidence(browser);save();')<wide.indexOf("check('A large desktop"));
 assert.ok(wide.includes('finally{'));assert.ok(verify.includes("finally{writeReport(root,'gallery-verification.json'"));
 for(const text of ['width:2560,height:1440','wp.waitForTimeout(2000)','wp.waitForTimeout(5000)','frames>300&&drops/frames<.10'])assert.ok(wide.includes(text));
 assert.ok(verify.includes("await c.close();"));assert.ok(verify.indexOf('await c.close();')<verify.indexOf('await runWide('));
 assert.ok(verify.includes("{channel:'chrome'}"));
});
test('unexpected runner errors are saved as failed',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gallery-accounting-fixture-'));assert.throws(()=>runComparison({root:dir,run(){throw Error('runner fixture failure');}}),/runner fixture failure/);const saved=JSON.parse(fs.readFileSync(path.join(dir,'.local/gallery-frame-comparison.json'),'utf8'));assert.equal(saved.status,'failed');assert.match(saved.error,/runner fixture failure/);fs.rmSync(dir,{recursive:true,force:true});
});
test('an error after a passing measurement cannot leave the wide report passed',async()=>{
 const {runWide}=require('./frame-wide.cjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'gallery-accounting-fixture-'));
 const records=[];for(let at=0;at<=5000;at+=250){for(let id=1;id<=12;id++)records.push({at,reason:at===0?'begin':at===5000?'end':'poll',id,generation:0,source:'clip-'+id,src:'clip-'+id,total:at/25,dropped:0,connected:true,paused:false,documentHidden:false,visibilityState:'visible'});records.push({at,reason:'census:'+(at===0?'begin':at===5000?'end':'poll'),ids:Array.from({length:12},(_,i)=>i+1),attached:12,playing:12,documentHidden:false,visibilityState:'visible'});}records.forEach((r,i)=>r.sequence=i+1);
 const trace={start:{at:0,sequence:1},end:{at:5000,sequence:records.length},records,errors:[]},session={async send(){return{};},async detach(){},on(){}},browser={version:()=> 'fixture',newBrowserCDPSession:async()=>session};
 const page={async goto(){},locator(){return{async scrollIntoViewIfNeeded(){}};},async waitForTimeout(){},async evaluate(fn){return fn.toString().includes('finish')?trace:null;},async screenshot(){throw Error('screenshot fixture failure');}};
 const context=async()=>({async addInitScript(){},newPage:async()=>page,newCDPSession:async()=>session,async close(){}}),state=async()=>({playing:12,attached:12,visible:true,stats:Array.from({length:12},()=>({total:0,dropped:0}))});
 await assert.rejects(runWide({browser,context,state,root:dir,check(){},mode:'fixture'}),/screenshot fixture failure/);
 const saved=JSON.parse(fs.readFileSync(path.join(dir,'.local/gallery-playback-load.json'),'utf8'));assert.equal(saved.status,'failed-after-measurement');assert.equal(saved.measurement.status,'valid');assert.equal(saved.measurement.passesPerformanceGate,true);assert.match(saved.error,/screenshot fixture failure/);assert.ok(saved.trace.records.length);fs.rmSync(dir,{recursive:true,force:true});
});
test('quota evidence reads the actual process cgroup and its ancestors',()=>{const {cgroupEvidence}=require('./frame-diagnostics.cjs'),seen=[];const r=cgroupEvidence('0::/system.slice/hosted-compute-agent.service',file=>{seen.push(file);return file.endsWith('cpu.max')?'max 100000':'fixture';});assert.deepEqual(r.hierarchy.map(h=>h.directory),['/sys/fs/cgroup/system.slice/hosted-compute-agent.service','/sys/fs/cgroup/system.slice','/sys/fs/cgroup']);assert.ok(seen.includes('/sys/fs/cgroup/system.slice/hosted-compute-agent.service/cpu.max'));assert.equal(r.incomplete,undefined);});
test('invalid or unavailable cgroup membership is explicit and never traverses outside the hierarchy',()=>{const {cgroupEvidence}=require('./frame-diagnostics.cjs');for(const membership of [{unavailable:'ENOENT'},'0::/../etc','1:cpu:/legacy'])assert.ok(cgroupEvidence(membership,()=>{throw Error('must not read');}).unavailable);});
