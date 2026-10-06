// Photograph the published V16 build through its existing grab and paint controls.
const path=require('node:path');
const {takes,run}=require('./takes.cjs');
const {root}=require('./server.cjs');
const source=path.join(root,'.local/sources/smear-v16/index.html');
for(const mode of ['curl-wide','curl-close','curl-overhead'])takes['smear-v16-'+mode]={game:'smear',source,url:'/capture/smear-v16/',seconds:19,
 setup:async p=>{
  await p.evaluate(async mode=>{
   const a=__smear;a.manual(true);a.preset('default');a.reset();a.tune({walking:false,recover:false});await a.step(180);
   if((await a.state()).player.mode!=='fly')a.fly();a.tool(0);await a.grab(0,'Right foot');
   a.view(mode==='curl-wide'?[3.8,4.2,5.4]:mode==='curl-close'?[2.7,3.9,4.1]:[.8,7.2,4.8],[0,0,.5]);
   window.__paintSamples=[];window.__paintTargets=[];window.__paintRunning=false;
   window.__paintBefore=await a.state();a.manual(false);
  },mode);await p.waitForTimeout(250);
 },
 action:async p=>{
  await p.evaluate(()=>{
   const start=performance.now();window.__paintRunning=true;
   const tick=now=>{if(!__paintRunning)return;const t=(now-start)/1000;
    if(t<14){const point=[Math.sin(t*.61)*1.9,.14,.6+Math.cos(t*.75)*1.4];__smear.target(point);if(!__paintTargets.length||t-__paintTargets.at(-1).t>.12)__paintTargets.push({t,point});requestAnimationFrame(tick);}
    else{__smear.release();__paintRunning=false;}
   };requestAnimationFrame(tick);window.__paintStart=start;
  });
  for(let i=0;i<34;i++){await p.waitForTimeout(500);await p.evaluate(()=>__paintSamples.push({t:(performance.now()-__paintStart)/1000,status:__smear.compute.status()}));}
  await p.evaluate(()=>{__paintRunning=false;__smear.release();});
 },
 telemetry:async()=>({state:await __smear.state(),status:__smear.compute.status(),before:window.__paintBefore,samples:window.__paintSamples,targets:window.__paintTargets,work:Array.from(await __smearGPU.readWork())})};
if(require.main===module)run(process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
