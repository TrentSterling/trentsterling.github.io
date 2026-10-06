// Record the live demo interfaces with only presentation elements hidden.
const fs=require('node:fs'),path=require('node:path');
const {takes,run}=require('./takes.cjs');
const {root}=require('./server.cjs');

const lerpOriginal=path.join(root,'.local/sources/lerp/index.html'),lerpCopy=path.join(root,'.local/sources/lerp/portfolio.html');
const lerpSource=fs.readFileSync(lerpOriginal,'utf8'),lerpNeedle='            TIMESTEPS_FPS.forEach(fps => simulations.push(createSimulation(fps, true)));';
if(!lerpSource.includes(lerpNeedle))throw Error('Missing lerp export location');
fs.writeFileSync(lerpCopy,lerpSource.replace(lerpNeedle,`window.__lerpCapture={state:()=>({cycle:cycleTimer,simulations:simulations.map(s=>({fps:s.fps,isBad:s.isBad,x:s.currentX}))})};\n`+lerpNeedle));
takes['lerp-comparison']={game:'lerp',dom:true,url:'/capture/lerp/portfolio.html',source:lerpCopy,seconds:10,
 ready:()=>!!window.__lerpCapture&&document.querySelectorAll('canvas').length===6,
 setup:async p=>{await p.addStyleTag({content:`header,nav,footer,h1,.tront-about,.explanation-box,.author-card,.implementations-section,.demo-subtext,h2{display:none!important}
 body{overflow:hidden!important;margin:0!important;padding:0!important}.container{max-width:none!important;width:1200px!important;margin:0 auto!important;padding:0!important}
 .card-section{margin:35px 0!important;padding:20px!important}.sim-container{margin:0!important;gap:24px!important;flex-wrap:nowrap!important}
 .sim-wrapper p{font-size:22px!important;margin:0 0 10px!important}canvas{width:350px!important;height:160px!important}
 `});await p.evaluate(()=>{window.__lerpSamples=[];});await p.waitForFunction(()=>__lerpCapture.state().cycle<.1);},
 action:async p=>{for(let i=0;i<90;i++){await p.evaluate(()=>__lerpSamples.push({at:performance.now(),...__lerpCapture.state()}));await p.waitForTimeout(100);}},
 telemetry:()=>({state:__lerpCapture.state(),samples:__lerpSamples})};

takes['lerp-proportional']={...takes['lerp-comparison'],
 setup:async p=>{await takes['lerp-comparison'].setup(p);await p.addStyleTag({content:`
 .container{position:fixed!important;inset:0!important;height:100vh!important;display:flex!important;flex-direction:column!important;justify-content:center!important}
 .card-section{margin:12px 0!important;padding:24px!important}canvas{width:350px!important;height:93.333333px!important}
 `});await p.waitForFunction(()=>__lerpCapture.state().cycle<.1);}};

takes['vibeprime-full-sieve']={game:'vibeprime',dom:true,seconds:10,
 setup:async p=>{
  await p.locator('#limit-input').fill('300');await p.locator('#start-btn').click();
  await p.addStyleTag({content:`header,nav,footer,h1,.tront-about,.info-section,.links,.controls,#status-box,#stats-container{display:none!important}
 body{margin:0!important;padding:0!important;overflow:hidden!important}main{width:100vw!important;max-width:none!important}
 #grid-container{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important}
 .sieve-grid{grid-template-columns:repeat(25,43px)!important;gap:3px!important}.number-cell{width:43px!important;height:43px!important;box-sizing:border-box!important;font-size:20px!important}
 `});await p.evaluate(()=>{window.__primeSamples=[];});await p.waitForTimeout(350);
 },
 action:async p=>{await p.waitForTimeout(350);await p.evaluate(()=>document.getElementById('run-to-end-btn').click());
  for(let i=0;i<80;i++){await p.evaluate(()=>__primeSamples.push({at:performance.now(),state,currentP,prime:document.querySelectorAll('.is-prime').length,composite:document.querySelectorAll('.is-composite').length}));await p.waitForTimeout(100);}
 },telemetry:()=>({state,currentP,limit,primes:isPrimeList.map((v,i)=>v?i:0).filter(Boolean),samples:__primeSamples,primeCells:document.querySelectorAll('.is-prime').length,compositeCells:document.querySelectorAll('.is-composite').length})};

if(require.main===module)run(process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
