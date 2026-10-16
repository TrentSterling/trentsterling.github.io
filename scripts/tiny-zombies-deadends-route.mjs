import fs from 'node:fs';
export async function run({ev,page,key,pointer,sleep,shot}){
 const report={rendering:'SwiftShader software WebGPU, no hardware performance comparison',timerPolicy:'Input holds and route stall budgets use observed simulation time; no clock/state writes',method:'Ordinary keyboard and pointer input, with read-only GPU telemetry and source-map waypoints. No teleporting, damage injection, autoplay or win-state writes.',started:new Date().toISOString(),telemetry:[],milestones:[]};
 const save=()=>fs.writeFileSync(process.env.TINY_QA_OUTPUT+'/route-report.json',JSON.stringify(report,null,2));
 const press=async k=>{await key(k,true);await key(k,false);};let firing=false;const held=new Set();
 const hold=async list=>{const next=new Set(list);for(const k of held)if(!next.has(k)){await key(k,false);held.delete(k);}for(const k of next)if(!held.has(k)){await key(k,true);held.add(k);}};
 const aim=async(p,shoot)=>{await page('Input.dispatchMouseEvent',{type:'mouseMoved',x:p[0],y:p[1],buttons:firing?1:0});if(shoot!==firing){await pointer(...p,'left',shoot);firing=shoot;}};
 const read=()=>ev(`(async()=>{const p=await __tiny.readState(),z=new Float32Array(await readBuffer(zParity?zB:zA,0,Math.min(settings.zombies,245)*ZOMBIE_BYTES13)),ob=new Uint32Array(await readBuffer(O,0,OCC_SIZE*4)),pr=new Float32Array(await readBuffer(Props,0,world.propCount*64));
 const clear=(a,b)=>{let d=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let t=.2;t<d-.2;t+=.125){let x=a[0]+(b[0]-a[0])*t/d,y=a[1]+(b[1]-a[1])*t/d,addr=occAddress(Math.floor((x+96)*4),2,Math.floor((y+96)*4),ob);if(addr>=0&&ob[addr])return false;for(let j=0;j<world.propCount;j++){let o=j*16;if((pr[o+3]===9||pr[o+3]===10)&&pr[o+4]>0&&pr[o+1]<2&&Math.abs(x-pr[o])<pr[o+8]/2&&Math.abs(y-pr[o+2])<pr[o+10]/2)return false;}}return true;};
 let target=null,visible=0,alive=0;for(let i=0;i<z.length/ZOMBIE_FLOATS13;i++){const o=i*ZOMBIE_FLOATS13,d=Math.hypot(z[o]-p[0],z[o+2]-p[2]);if(z[o+3]<=0)continue;alive++;if(d<12&&clear([p[0],p[2]],[z[o],z[o+2]])){const q=screenPoint(z[o],z[o+2],.5);if(q[0]>20&&q[0]<width-20&&q[1]>20&&q[1]<height-20){visible++;const score=d-(z[o+10]>=2&&d<3?.5:0);if(!target||score<target.score)target={score,d,p:q,id:i,hp:z[o+3],kind:z[o+10]};}}}
 let hazard=false;for(let k=0;k<16;k++){for(const base of [L13.acid,L7.heat6]){let o=base+k*4;if(p[o+3]>p[24]&&Math.hypot(p[0]-p[o],p[2]-p[o+1])<p[o+2]+.5)hazard=true;}}return {stage,fuel:p[447],relay:p.slice(440,444),shortObjective:shortObjective9(),blockedAttack:p[L12.flags]>.5,hazard,t:p[24],frame,position:p.slice(0,4),down:p[L7.player7],goal:p[67],mission:p[448],interaction:p[449],channel:p[451],upgrades:p.slice(L13.upgrades,L13.upgrades+4),gear:p.slice(L12.gear,L12.gear+4),reload:p.slice(L12.reload,L12.reload+4),mag:p.slice(L12.mag,L12.mag+3),reserve:p.slice(L12.reserve,L12.reserve+3),items:p.slice(L12.items,L12.items+4),team:Array.from({length:3},(_,i)=>{let o=L7.team7+i*128;return {p:p.slice(o,o+4),action:p[o+9],life:p.slice(L13.botLife+i*4,L13.botLife+i*4+4),mag:p.slice(L13.botMag+i*4,L13.botMag+i*4+4)};}),gate:pr[world.gate13*16+5],door:pr[world.final13*16+5],director:p.slice(452,456),progress:p[2190],alive,visible,target,fps,gpuMs,errors:diagnostics.errors,stopped};})()`);
 const record=async name=>{await shot(name);report.milestones.push({name,state:await read()});save();};
 const basis=await ev('({right:[right[0],right[2]],forward:(()=>{const f=norm([up[0],0,up[2]]);return[f[0],f[2]]})()})');
 const options=[['KeyD',1,0],['KeyA',-1,0],['KeyW',0,1],['KeyS',0,-1],['KeyD,KeyW',1,1],['KeyD,KeyS',1,-1],['KeyA,KeyW',-1,1],['KeyA,KeyS',-1,-1]].map(([ks,x,y])=>{let v=[basis.right[0]*x+basis.forward[0]*y,basis.right[1]*x+basis.forward[1]*y],d=Math.hypot(...v);return {keys:ks.split(','),v:v.map(x=>x/d)};});
 const move=(x,y)=>options.reduce((a,b)=>a.v[0]*x+a.v[1]*y>b.v[0]*x+b.v[1]*y?a:b).keys;
 let lastDown=false,waitingSince=0,combatWaitStart=0,combatMoveUntil=0;const deadline=Date.now()+Number(process.env.TINY_ROUTE_WALL_MS||480000);
 const waitReady=async expectedStage=>{while(Date.now()<deadline){if(await ev(`!!window.__TINY_READY__&&!seedRequested&&!resetRequested&&(${expectedStage===undefined?'true':`stage===${expectedStage}&&world.source13?.map.id==='burnout'`})`))return;await sleep(100);}throw Error('Observation window ended while waiting for host transition readiness');};

 const observe=async()=>{const s=await read();if(s.stopped||s.errors.length)throw Error('Game error');report.telemetry.push(s);if(s.down&&!lastDown)await record('natural-down');if(!s.down&&lastDown&&s.position[3]>0&&s.goal===0)await record('natural-revive');lastDown=!!s.down;return s;};
 let lastThrow=-100;
 const fight=async s=>{
  if(s.blockedAttack){await aim(s.target?.p||[450,150],false);return;}
  if(!s.down&&s.fuel!==1&&(s.items[0]>0||s.items[1]>0)&&s.target&&s.visible>=5&&s.target.d>3.1&&s.t-lastThrow>5){await aim(s.target.p,false);await press(s.items[0]>0?'Digit4':'KeyC');await aim(s.target.p,true);await dwell(100,false);await aim(s.target.p,false);lastThrow=s.t;await press('KeyQ');return;}
  const loaded=k=>s.mag[k]+s.reserve[k]>0;
  const pumpRange=(s.upgrades[0]&1)?(s.gear[0]===1?5.5:3.5):(s.gear[0]===1?9.5:7.5);
  let desired=(s.down||s.fuel===1)?2:s.target&&s.target.d<pumpRange&&loaded(1)?1:loaded(0)?0:loaded(1)?1:2;
  if(!s.down&&s.reload?.[0]>0)desired=s.gear[0];
  if(s.gear[0]!==desired){await aim(s.target?.p||[450,150],false);await press('Digit'+(desired+1));}
  if(!s.down&&!s.target&&s.gear[0]<2&&s.reload?.[0]<=0&&s.mag[s.gear[0]]<((s.gear[0]===0)?((s.upgrades[0]&1)?14:30):8)&&s.reserve[s.gear[0]]>0)await press('KeyR');
  await aim(s.target?.p||[450,150],!!s.target);await key('Space',!!s.target&&s.target.d<1.55);
 };
 const dwell=async(ms,shoot=true)=>{const start=(await read()).t;while(Date.now()<deadline){let s=await observe();if(s.goal||s.t-start>=ms/1000)break;if(shoot)await fight(s);await sleep(50);}};
 const route=[[-38.4,15,'axe-rack'],[-36.8,15.18],[-31.7,15.1,'start-door'],[-29.6,15.1],[-28,16.3],[-24,16.3],[-19,15.5],[-19,10],[-19,5],[-19,2.5],[-14,2.5],[-9,2.5],[-4,2.5],[.5,2.5],[3.4,-2.5,'service-gate'],[4.4,-2,'freight-door'],[6.5,-2],[8,-2.5],[11.05,-2.78,'heavy-rifle'],[8,-2.5],[6.5,-2],[4.4,-2],[.5,-2.5],[.5,-6],[.5,-11.5],[6,-11.5],[12,-11.5],[17,-11.5],[22.5,-11.5,null,.2],[22.5,-18.7,null,.2],[24.8,-18.7,null,.2],[29.9,-18.7,null,.2],[29.9,-17.3,'safehouse-door'],[35.5,-17.0,'gather'],[31.9,-17,'seal']];report.route=route;
 try{
  await pointer(450,150,'left',true);await pointer(450,150,'left',false);await sleep(300);await record('01-source-chapter1-start');
  const follow=async route=>{
  for(let ri=0;ri<route.length&&Date.now()<deadline;ri++){
   let [x,y,action,arrival]=route[ri],best=Infinity,lastProgress=(await read()).t,arrived=false;
   while(Date.now()<deadline){let s=await observe();if(s.goal)break;if(s.down){await hold([]);await fight(s);await sleep(100);continue;}let dx=x-s.position[0],dy=y-s.position[2],d=Math.hypot(dx,dy);if(d<(arrival??.45)){arrived=true;break;}if(d<best-.08){best=d;lastProgress=s.t;}if(s.t-lastProgress>8){report.blocked={waypoint:ri,d,position:s.position};break;}
    if(s.fuel!==1&&s.position[3]<55&&s.items[2]>0&&!s.hazard&&(!s.target||s.target.d>5)){await hold([]);await aim([450,150],false);await press('KeyF');await aim([450,150],true);await dwell(2100,false);await aim([450,150],false);continue;}
    const lag=Math.max(...s.team.filter(a=>a.life[1]<.5&&a.p[3]>0).map(a=>Math.hypot(a.p[0]-s.position[0],a.p[2]-s.position[2])),0);const combatPause=!!s.target&&s.visible>5&&s.target.d>2.5&&s.target.d<7;if(combatPause&&!combatWaitStart)combatWaitStart=s.t;if(!combatPause)combatWaitStart=0;if(combatWaitStart&&s.t-combatWaitStart>2){combatMoveUntil=s.t+4;combatWaitStart=0;}if(!s.hazard&&(combatPause&&s.t>combatMoveUntil)){if(!waitingSince)waitingSince=s.t;if(s.t-waitingSince>14&&!s.target){report.blocked={waypoint:ri,reason:'squad did not catch up within 14 seconds',lag,position:s.position};break;}await hold([]);await fight(s);lastProgress=s.t;await sleep(100);continue;}waitingSince=0;await fight(s);await hold([...move(dx,dy),...(!s.target&&lag<3.5&&s.items[3]>8?['ShiftLeft']:[])]);await sleep(d<1?30:80);
   }
   await hold([]);if(!arrived)break;if(action){await record(action+'-prompt');if(action==='gather'){await dwell(14000);}else if(action==='shutter-wait'){await dwell(11500);}else{await key('KeyE',true);await dwell(action==='service-gate'?4600:action==='fuel-pour'?2350:action==='seal'?4000:500);await key('KeyE',false);await aim([450,150],false);}await record(action+'-used');}
  }
  };
  await follow(route);
  await hold([]);await aim([450,150],false);await key('Space',false);await record('route-end');report.result=await read();report.completed=report.result.goal===1;
  if(report.completed){
   await sleep(500);report.earnedCheckpoint=await ev('({stage,save:savedCheckpoint,raw:localStorage.getItem(checkpointKey),won:playerValues[67]})');await shot('earned-extraction');
   const boundary=()=>ev('(async()=>{const s=await __tiny.readState();return {stage,seed:runSeed,map:world.source13?.map.id,pos:s.slice(0,4),hp:[s[3],...Array.from({length:3},(_,i)=>s[L7.team7+i*128+3])],items:s.slice(L12.items,L12.items+3),upgrades:s.slice(L13.upgrades,L13.upgrades+4),errors:diagnostics.errors,save:savedCheckpoint};})()');
   await press('Enter');await waitReady(2);await press('Escape');report.continued=await boundary();await shot('earned-burnout-continued');
   await press('Escape');await hold(['KeyD']);await sleep(600);await hold([]);await press('Backspace');await waitReady(2);await press('Escape');report.retried=await boundary();await shot('earned-burnout-retried');
   await page('Page.reload',{ignoreCache:true});await waitReady();await press('Enter');await waitReady(2);await press('Escape');report.reloaded=await boundary();await shot('earned-burnout-reloaded');
   report.continuationPassed=report.earnedCheckpoint.won===1&&report.earnedCheckpoint.save?.map===1&&[report.continued,report.retried,report.reloaded].every(x=>x.stage===2&&x.map==='burnout'&&!x.errors.length)&&JSON.stringify(report.continued.hp)===JSON.stringify(report.retried.hp)&&JSON.stringify(report.continued.hp)===JSON.stringify(report.reloaded.hp)&&[report.retried,report.reloaded].every(x=>JSON.stringify(x.items)===JSON.stringify(report.continued.items)&&JSON.stringify(x.upgrades)===JSON.stringify(report.continued.upgrades));

   if(report.continuationPassed){
    await press('Escape');lastDown=false;waitingSince=combatWaitStart=combatMoveUntil=0;lastThrow=-100;
    const burnout=[[-35.8,16.2],[-31.3,16,'burnout-start-door'],[-29.2,16.5],[-25,16.5],[-22.5,16.5],[-22.5,10],[-22.5,6],[-22.5,1.8],[-26.5,1,'first-fuel'],[-22.5,1.8],[-18,1.8],[-13,1.8],[-7,1.8],[-1,1.8],[3.5,1.5],[3.5,-3.8],[5.4,-4,'fuel-pour'],[3.5,1.8],[-1,1.8],[-11,1.8],[-11,-2.8],[-11,-4.5],[-8,-5.5,'second-fuel'],[-11,-4.5],[-11,1.8],[-1,1.8],[3.5,1.8],[3.5,-3.8],[5.4,-4,'fuel-pour'],[3.5,-3.8,'shutter-wait'],[3.5,-7.5],[3.5,-12.5],[8,-12.5],[13,-12.5],[18,-12.5],[24.5,-12.5],[24.5,-19.5],[29,-19.5],[35.5,-19.5,'gather'],[31.9,-19.5,'seal']];
    report.burnoutRoute=burnout;await record('burnout-normal-start');await follow(burnout);await hold([]);await aim([450,150],false);await key('Space',false);await record('burnout-route-end');report.burnoutResult=await read();report.burnoutCompleted=report.burnoutResult.goal===1;
    if(report.burnoutCompleted){
     await sleep(500);report.burnoutCheckpoint=await ev('({stage,save:savedCheckpoint,raw:localStorage.getItem(checkpointKey),won:playerValues[67]})');await shot('burnout-earned-extraction');await press('Enter');await sleep(400);report.reviewBoundary=await ev('({stage,completedBoundary15,save:savedCheckpoint,seedRequested,errors:diagnostics.errors})');await shot('burnout-review-boundary');
     await page('Page.reload',{ignoreCache:true});await waitReady();await press('Enter');await waitReady();report.reviewReloaded=await ev('({stage,completedBoundary15,save:savedCheckpoint,seedRequested,errors:diagnostics.errors})');await shot('burnout-completion-reloaded');
     await press('Backspace');await waitReady(2);await press('Escape');report.burnoutRetried=await boundary();await shot('burnout-earned-retry');
     report.burnoutPersistencePassed=report.burnoutCheckpoint.save?.map===2&&report.reviewBoundary.completedBoundary15&&report.reviewReloaded.completedBoundary15&&report.reviewReloaded.save?.map===2&&report.burnoutRetried.stage===2&&report.burnoutRetried.map==='burnout'&&JSON.stringify(report.burnoutRetried.hp)===JSON.stringify(report.continued.hp)&&JSON.stringify(report.burnoutRetried.upgrades)===JSON.stringify(report.continued.upgrades)&&JSON.stringify(report.burnoutRetried.items)===JSON.stringify(report.continued.items)&&report.burnoutRetried.seed===report.continued.seed&&report.burnoutCheckpoint.save.entry?.seed===report.continued.seed;
    }
   }
  }
 }finally{await hold([]);await aim([450,150],false);await key('Space',false);report.finished=new Date().toISOString();report.windowExpired=Date.now()>=deadline;save();}
 const milestone=name=>report.milestones.find(m=>m.name===name&&m.state.stage===2)?.state;
 const pours=report.milestones.filter(m=>m.name==='fuel-pour-used'&&m.state.stage===2).map(m=>m.state);
 const fuel1=milestone('first-fuel-used'),fuel2=milestone('second-fuel-used'),shutter=milestone('shutter-wait-used');
 const burn=report.telemetry.filter(s=>s.stage===2),opened=burn.find(s=>s.relay[2]>.5),lastClosed=opened?burn.filter(s=>s.t<=opened.t&&s.relay[2]<.5&&s.relay[0]>.5).at(-1):null;
 report.fuelContract={firstPickup:fuel1?.fuel===1&&fuel1?.relay[3]===0,firstPour:pours[0]?.fuel===0&&pours[0]?.relay[3]===1&&pours[0]?.relay[0]===0,secondPickup:fuel2?.fuel===1&&fuel2?.relay[3]===1,secondPour:pours[1]?.fuel===0&&pours[1]?.relay[3]===2&&pours[1]?.relay[0]===1&&pours[1]?.gate>.5,shutterDelay:!!opened&&!!lastClosed&&lastClosed.relay[1]<11&&opened.relay[1]>=11&&burn.every(s=>s.relay[2]<.5||s.relay[1]>=11),shutterOpened:shutter?.gate<.5&&shutter?.relay[2]===1,extracted:report.burnoutResult?.goal===1&&report.burnoutResult?.relay[3]===2};
 report.shutterTimingObserved={lastClosed:lastClosed?{t:lastClosed.t,elapsed:lastClosed.relay[1]}:null,firstOpen:opened?{t:opened.t,elapsed:opened.relay[1]}:null,method:'Opening flag and timer from the same State readback; separate prop gate is supplemental'};report.fuelContractPassed=Object.values(report.fuelContract).every(Boolean);save();
 console.log(JSON.stringify({completed:report.completed,burnoutCompleted:report.burnoutCompleted,blocked:report.blocked,t:report.result?.t,windowExpired:report.windowExpired}));return report;
}
