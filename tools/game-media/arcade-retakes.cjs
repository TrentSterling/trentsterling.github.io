// Longer action takes from the original demos. Ignored copies expose inspection
// handles; input, vehicle physics, enemy compute shaders and Pong AI stay original.
const fs=require('node:fs'),path=require('node:path');
const {takes,run}=require('./takes.cjs');
const {root}=require('./server.cjs');
function expose(slug,needle,hook,filename='portfolio-action.html'){
 const source=path.join(root,'.local/sources',slug,'index.html');
 const copy=path.join(path.dirname(source),filename);
 const html=fs.readFileSync(source,'utf8');
 if(html.split(needle).length!==2)throw Error('Ambiguous inspection location: '+slug);
 fs.writeFileSync(copy,html.replace(needle,hook+'\n'+needle));
 return {url:'/capture/'+slug+'/'+filename,source:copy};
}
const carHook=`window.__carCapture={
 stage:(position,eye)=>{resetCar();carBody.position.set(...position);carBody.velocity.set(0,0,0);carBody.angularVelocity.set(0,0,0);camera.position.set(...eye);orbitControls.target.set(...position);orbitControls.update();},
 state:()=>({at:performance.now(),position:[carBody.position.x,carBody.position.y,carBody.position.z],velocity:[carBody.velocity.x,carBody.velocity.y,carBody.velocity.z],quaternion:[carBody.quaternion.x,carBody.quaternion.y,carBody.quaternion.z,carBody.quaternion.w],contacts:wheelInfos.filter(w=>w.isInContact).length,boxes:boxes.map(b=>({p:[b.body.position.x,b.body.position.y,b.body.position.z],initial:[b.initialPosition.x,b.initialPosition.y,b.initialPosition.z]})),controls:{...controls}})
};`;
const car=expose('vibecar','        initializeTuningParams();',carHook);
const carFollow=expose('vibecar','        initializeTuningParams();',carHook.replace('window.__carCapture={',`window.__carCapture={
 heading:yaw=>{carBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0),yaw);},
 follow:offset=>{camera.fov=60;camera.updateProjectionMatrix();const tick=()=>{camera.position.set(carBody.position.x+offset[0],carBody.position.y+offset[1],carBody.position.z+offset[2]);requestAnimationFrame(tick);};tick();},`),'portfolio-follow.html');
const duders=expose('vibeduders',"        window.addEventListener('load', initWebGPU);",`window.__dudersCapture={state:()=>({at:performance.now(),ready:!!renderPipeline,enemies:NUM_ENEMIES,kills:totalKills,zoom:cameraZoomLevel,target:{...playerTarget},attack:{...attackState},adapter:adapter?.info?{vendor:adapter.info.vendor,architecture:adapter.info.architecture,isFallbackAdapter:adapter.info.isFallbackAdapter}:null})};`);
const pong=expose('vibepong','        init();',`window.__pongCapture={state:()=>({at:performance.now(),ready:!!ball&&!!font,serving:gameState.isServing,speed:gameState.gameSpeed,ball:ball?{p:ball.position.toArray(),v:gameState.ballVelocity.toArray(),impact:ball.userData.impact}:null,paddles:[p1,p2].filter(Boolean).map(p=>({p:p.position.toArray(),scale:p.scale.y,impact:p.userData.impact})),scores:[p1Score,p2Score],ghosts:ghostBalls.map(b=>({p:b.position.toArray(),active:b.userData.active})),powerup:spawnedPowerup?.userData.type.name||null})};`);
async function samples(p,handle,seconds){
 await p.evaluate(({handle})=>{window.__arcadeSamples=[];window.__arcadeStart=performance.now();window.__arcadeTimer=setInterval(()=>__arcadeSamples.push({t:(performance.now()-__arcadeStart)/1000,...window[handle].state()}),80);},{handle});
 await p.waitForTimeout(seconds*1000);await p.evaluate(()=>clearInterval(__arcadeTimer));
}
for(const mode of ['boxes','ramp','turn'])takes['vibecar-'+mode]={game:'vibecar',...car,seconds:14,ready:()=>!!window.__carCapture,
 setup:async p=>{await p.evaluate(mode=>{const poses={boxes:[[-10,1.5,-9],[-23,9,-10]],ramp:[[0,1.5,-36],[-13,10,-27]],turn:[[-30,1.5,-8],[-39,9,-20]]};__carCapture.stage(...poses[mode]);window.__arcadeSamples=[];},mode);await p.waitForTimeout(650);},
 action:async p=>{const collecting=samples(p,'__carCapture',12.5);await p.keyboard.down('KeyW');await p.waitForTimeout(mode==='turn'?1900:4000);if(mode==='turn'){await p.keyboard.down('KeyD');await p.keyboard.down('Space');await p.waitForTimeout(650);await p.keyboard.up('Space');await p.waitForTimeout(900);await p.keyboard.up('KeyD');}await p.waitForTimeout(1800);await p.keyboard.up('KeyW');await collecting;},
 telemetry:()=>({state:__carCapture.state(),samples:window.__arcadeSamples})};
for(const mode of ['boxes','ramp','turn'])takes['vibecar-follow-'+mode]={...takes['vibecar-'+mode],...carFollow,
 setup:async p=>{await p.evaluate(mode=>{const pos=mode==='ramp'?[0,1.5,3]:mode==='boxes'?[-10,1.5,-9]:[-30,1.5,-8];const offset=mode==='ramp'?[-10,5,8]:[-9,5,-10];__carCapture.stage(pos,pos.map((v,i)=>v+offset[i]));if(mode==='ramp')__carCapture.heading(Math.PI);__carCapture.follow(offset);window.__arcadeSamples=[];},mode);await p.waitForTimeout(650);}};
for(const mode of ['wide-blasts','close-blasts'])takes['vibeduders-'+mode]={game:'vibeduders',...duders,seconds:18,ready:()=>window.__dudersCapture?.state().ready,
 setup:async p=>{await p.locator('#infoButton').click();await p.mouse.move(640,360);if(mode==='close-blasts')await p.mouse.wheel(0,1100);await p.mouse.click(690,410);await p.waitForTimeout(1800);},
 action:async p=>{const collecting=samples(p,'__dudersCapture',16.5);for(const [x,y] of [[660,400],[790,300],[530,410],[720,470],[600,290]]){await p.mouse.click(x,y);await p.waitForTimeout(1500);await p.mouse.click(x,y,{button:'right'});await p.waitForTimeout(1400);}await collecting;},
 telemetry:()=>({state:__dudersCapture.state(),samples:window.__arcadeSamples})};
for(const mode of ['rallies','powerups'])takes['vibepong-'+mode]={game:'vibepong',...pong,seconds:42,ready:()=>window.__pongCapture?.state().ready,
 setup:async p=>{await p.waitForTimeout(4000);await p.evaluate(mode=>{const s=document.getElementById('speed-slider');s.value=mode==='rallies'?'2.4':'3.2';s.dispatchEvent(new Event('input',{bubbles:true}));for(const id of ['debug-target-toggle','debug-data-toggle']){const e=document.getElementById(id);if(e.checked)e.click();}window.__arcadeSamples=[];},mode);},
 action:async p=>samples(p,'__pongCapture',40.5),telemetry:()=>({state:__pongCapture.state(),samples:window.__arcadeSamples})};
if(require.main===module)run(process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
