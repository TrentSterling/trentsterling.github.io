// Additional gameplay photography. All actions use the games' existing controls.
const fs=require('node:fs'),path=require('node:path');
const {takes,run}=require('./takes.cjs');
const {specs}=require('./capture.cjs');
const {root}=require('./server.cjs');

for(const weapon of ['Crater Maker','Laser Battery','Fireworks']){
 const name='treads-'+weapon.toLowerCase().replaceAll(' ','-');
 takes[name]={game:'tinytreads',seconds:16,
  setup:async p=>{await p.evaluate(weapon=>{POCKET.settings.sound=false;POCKET.startPractice();POCKET.setWeapon(weapon);POCKET.autoAim();window.__shotSamples=[];},weapon);await p.waitForTimeout(500);},
  action:async p=>{await p.waitForTimeout(350);if(!await p.evaluate(()=>POCKET.fire()))throw Error('Weapon did not fire');
   for(let i=0;i<70;i++){await p.waitForTimeout(200);await p.evaluate(()=>{const s=POCKET.state;__shotSamples.push({t:s.shotAge,projectiles:s.projectiles,particles:s.particles,blasts:s.blasts,terrain:s.terrainRevision,score:s.players[0].score});});}
  },
  telemetry:()=>({state:POCKET.state,terrainHash:POCKET.terrainHash(),checks:POCKET.validate(),samples:__shotSamples})};
}

for(const preset of ['roller','yard'])takes['inkride-'+preset]={game:'inkride',seconds:18,
 setup:async p=>{await p.evaluate(preset=>{INKRIDE.preset(preset);INKRIDE.setCamera({z:1.15});INKRIDE.focus(INKRIDE.id,true);window.__rideSamples=[];},preset);await p.waitForTimeout(250);},
 action:async p=>{await p.waitForTimeout(250);await p.evaluate(()=>INKRIDE.command('ride'));
  for(let i=0;i<65;i++){await p.waitForTimeout(250);await p.evaluate(()=>{const r=INKRIDE.riders.find(r=>r.id===INKRIDE.id);__rideSamples.push({time:INKRIDE.physicsTime,state:r.state,air:r.air,point:r.points[0]});});}
 },
 telemetry:()=>({riders:INKRIDE.riders,props:INKRIDE.props,events:INKRIDE.events,samples:__rideSamples,session:INKRIDE.session})};

for(const detail of [false,true])takes['fellswoop-'+(detail?'close-reactions':'wide-sweep')]={game:'fellswoop',seconds:12,
 setup:async p=>{await specs.fellswoop.setup(p);
  await p.waitForFunction(()=>__fellswoop.trees().some(t=>t.state==='alive'),null,{timeout:15000});
  await p.evaluate(detail=>{
   const q=__fellswoop,trees=q.trees().filter(t=>t.state==='alive');
   trees.sort((a,b)=>([2,4,5].includes(b.kind)?10:0)-([2,4,5].includes(a.kind)?10:0)+Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
   const t=trees[0];window.__groveCenter=detail?{x:t.x,z:t.z}:{x:0,z:0};window.__groveTargets=[];
   q.shotCamera(detail?7.7:13,__groveCenter.x,__groveCenter.z);q.closeBoard();
  },detail);await p.waitForTimeout(400);},
 action:async p=>{for(let i=0;i<25;i++){
   const point=await p.evaluate(i=>{const c=__groveCenter,q=__fellswoop,trees=q.trees().filter(t=>t.state==='alive'&&Math.hypot(t.x-c.x,t.z-c.z)<4.5);
    trees.sort((a,b)=>([2,4,5].includes(b.kind)?8:0)-([2,4,5].includes(a.kind)?8:0)+Math.hypot(a.x-c.x,a.z-c.z)-Math.hypot(b.x-c.x,b.z-c.z));
    const t=trees[0];if(!t)return q.screen(c.x+Math.sin(i)*2,c.z+Math.cos(i)*2);
    __groveTargets.push({id:t.id,kind:t.kind,x:t.x,z:t.z});return q.screen(t.x,t.z);
   },i);
   await p.mouse.move(point.x,point.y);if(i%3===0)await p.mouse.click(point.x,point.y);await p.waitForTimeout(350);
  }},
 telemetry:()=>({snapshot:__fellswoop.snapshot(),checks:__fellswoop.check(),targets:__groveTargets,center:__groveCenter})};

const aquaOriginal='C:/trontstack/aqua-empire/aqua_empire_v2_5.html';
const aquaDir=path.join(root,'.local/sources/aqua-photo');fs.mkdirSync(aquaDir,{recursive:true});
const aquaSource=path.join(aquaDir,'clean.html'),aquaHTML=fs.readFileSync(aquaOriginal,'utf8');
const needle='window.AQUAQA={';if(!aquaHTML.includes(needle))throw Error('Aqua photography hook missing');
let aquaCopy=aquaHTML.replace(needle,needle+'cleanCapture(){ui.captureClean=true;ui.text=()=>{};ui.hud=()=>{};},');
for(const guard of ["if(state.mode==='play'&&!broodship&&wallTime<warningUntil)","if(state.mode==='play'&&wallTime<toastUntil)","if(state.mode==='play'&&!this.panel&&!state.paused&&!broodship&&wallTime>=warningUntil)"]){
 if(!aquaCopy.includes(guard))throw Error('Aqua presentation guard missing');
 aquaCopy=aquaCopy.replace(guard,guard.replace('if(','if(!this.captureClean&&'));
}
fs.writeFileSync(aquaSource,aquaCopy);
for(const finale of [false,true])takes['aqua-'+(finale?'broodship-clean':'feeding-meals')]={game:'aqua-empire',url:'/capture/aqua-photo/clean.html',source:aquaSource,seconds:14,
 setup:async p=>{await p.evaluate(finale=>{const q=AQUAQA;q.setManual(true);q.start(finale?3:0,4);q.addMoney(10000);q.invincible(true);
   if(finale){if(!q.finaleFixture(42))throw Error('Finale fixture failed');q.uiAction('feedAll');q.advance(8);}
   else{for(let i=0;i<18;i++)q.buy('guppy');q.buy('nursery');q.buy('food');q.buy('food');q.advance(3);}
   q.cleanCapture();q.setManual(false);window.__aquaSamples=[];
  },finale);await p.waitForTimeout(700);},
 action:async p=>{for(let i=0;i<55;i++){
   await p.evaluate(({i,finale})=>{const q=AQUAQA,s=q.summary();
    if(finale&&i%2===0)q.shootBoss();
    if(!finale&&i%3===0){const f=q.fishData().filter(f=>f.kind!==1).sort((a,b)=>a.hunger-b.hunger)[0];if(f)q.feed(f.x,Math.min(s.bounds.top,f.y+.6));}
    if(i%8===0)q.collectAll();__aquaSamples.push({frame:s.stats.frames.length,fish:s.fish,foods:s.foods,boss:s.boss?{hp:s.boss.hp,phase:s.boss.phase,attack:s.boss.attack}:null,run:s.run});
   },{i,finale});await p.waitForTimeout(220);
  }},
 telemetry:()=>({summary:AQUAQA.summary(),checks:AQUAQA.errorCheck(),ui:AQUAQA.uiState(),samples:__aquaSamples})};

if(require.main===module)run(process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
