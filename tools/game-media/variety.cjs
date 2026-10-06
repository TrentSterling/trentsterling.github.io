// More distinct gameplay moments and scene views, using existing game controls.
const {takes,run}=require('./takes.cjs');
const {specs}=require('./capture.cjs');
const fs=require('node:fs'),path=require('node:path');
const {root}=require('./server.cjs');

takes['slopeloop-full-run']={game:'slopeloop',seconds:38,
 setup:specs.slopeloop.setup,
 telemetry:()=>slopeloop.telemetry()};

for(const scene of [1,2])takes['froxel-scene-'+scene]={game:'froxel',seconds:10,
 setup:async p=>{await p.evaluate(scene=>{FROXEL.setScene(scene);FROXEL.state.clean=true;FROXEL.state.paused=false;FROXEL.state.tour=true;},scene);await p.waitForTimeout(800);},
 action:async p=>{await p.waitForTimeout(1000);await p.evaluate(()=>FROXEL.addLight([0,2,-6],[0,0,-1]));},
 telemetry:()=>({scene:FROXEL.state.scene,title:FROXEL.world.title,time:FROXEL.state.time,camera:FROXEL.camera.position.toArray(),frames:FROXEL.getFrame()})};

takes['ltc-studio']={game:'ltc',seconds:10,
 setup:async p=>{await p.evaluate(()=>{__LTC.setScene('studio');__LTC.setParam('quality',1);if(!__LTC.state.photo)__LTC.togglePhoto();__LTC.applySceneCamera('close',true);});await p.waitForTimeout(800);},
 action:async p=>{await p.waitForTimeout(3200);await p.evaluate(()=>__LTC.scenePrimary());},
 telemetry:()=>({frames:__LTC.frameCount,scene:__LTC.state.scene,camera:__LTC.camera.position.toArray(),time:__LTC.exhibitTime})};

takes['ltc-shadows']={game:'ltc',seconds:10,
 setup:async p=>{await p.evaluate(()=>{__LTC.setScene('shadows');__LTC.setParam('quality',1);if(!__LTC.state.photo)__LTC.togglePhoto();__LTC.applySceneCamera('close',true);});await p.waitForTimeout(800);},
 action:async p=>{for(let i=0;i<80;i++){await p.evaluate(i=>{const input=document.querySelector('#block-x');if(!input)throw Error('Shadow-stage position control unavailable');input.value=String(Math.sin(i*.07)*2.4);input.dispatchEvent(new Event('input',{bubbles:true}));},i);await p.waitForTimeout(100);}},
 telemetry:()=>({frames:__LTC.frameCount,scene:__LTC.state.scene,camera:__LTC.camera.position.toArray(),shadow:__LTC.v5.shadow})};

takes['ltc-gallery']={game:'ltc',seconds:10,
 setup:async p=>{await p.evaluate(()=>{__LTC.setScene('gallery');__LTC.setParam('quality',1);if(!__LTC.state.photo)__LTC.togglePhoto();__LTC.applySceneCamera('close',true);});await p.waitForTimeout(800);},
 action:async p=>{await p.waitForTimeout(2100);await p.evaluate(()=>__LTC.scenePrimary());await p.waitForTimeout(2500);await p.evaluate(()=>__LTC.sceneSecondary());},
 telemetry:()=>({frames:__LTC.frameCount,scene:__LTC.state.scene,camera:__LTC.camera.position.toArray(),time:__LTC.exhibitTime})};

takes['senddudes-frontline']={game:'senddudes',seconds:12,
 setup:async p=>{await specs.senddudes.setup(p);await p.evaluate(()=>{SendDudes.frontline();Object.assign(SendDudes.view,{s:58,x:0,y:0});});await p.waitForTimeout(500);},
 action:async p=>{await p.waitForTimeout(1200);await p.evaluate(()=>{SendDudes.gpu.cooldown=0;SendDudes.cast(0,0);});},
 telemetry:()=>({report:SendDudes.report(),view:{...SendDudes.view}})};

takes['senddudes-detail']={...takes['senddudes-frontline'],
 setup:async p=>{await takes['senddudes-frontline'].setup(p);await p.evaluate(()=>{SendDudes.view.s=140;});await p.waitForTimeout(300);}};

takes['colony-mining']={game:'colony',seconds:20,
 setup:async p=>{await specs.colony.setup(p);await p.evaluate(()=>{
  gameTime=dayLen*.43;cam.zoom=3.1;cam.x=100;cam.y=Math.floor(surfHeights[100])+1;tool='dig';
  for(let x=95;x<=105;x++)for(let dy=0;dy<4;dy++){
   const y=Math.floor(surfHeights[x])-dy,point=w2s(x+.5,y-.5);
   handleTool({clientX:point.x,clientY:point.y});
  }
 });await p.waitForTimeout(400);},
 action:undefined,
 telemetry:()=>({day:gameTime/dayLen,camera:{...cam},dwarves:dwarves.map(d=>({x:d.x,y:d.y,state:d.state})),tasks:tasks.length,changes:blockChanges.size,resources:{...res}})};

const vibeDir=path.join(root,'.local/sources/vibecraft');
const vibeOriginal=fs.readFileSync(path.join(vibeDir,'index.html'),'utf8');
const vibeHook=`window.__galleryPhoto={camera,controls,getTerrainHeight,get chunks(){return loadedChunks.size;},day(){sunAngle=1.25;updateDayNightCycle(0);const original=updateDayNightCycle;updateDayNightCycle=()=>original(0);},stop(){playerVelocity.set(0,0,0);for(const k in movement)movement[k]=false;},fly(){isFlying=true;}};\n        init();`;
if(!vibeOriginal.includes('        init();'))throw Error('VibeCraft photography hook insertion unavailable');
fs.writeFileSync(path.join(vibeDir,'portfolio.html'),vibeOriginal.replace('        init();',vibeHook));
takes['vibecraft-landscape']={game:'vibecraft',url:'/capture/vibecraft/portfolio.html',source:path.join(vibeDir,'portfolio.html'),seconds:10,
 setup:async p=>{
  await p.waitForFunction(()=>window.__galleryPhoto?.chunks>30);await p.waitForTimeout(2000);
  await p.evaluate(()=>{const g=__galleryPhoto;g.day();g.stop();g.fly();let highest=0;for(let x=-20;x<=30;x+=4)for(let z=-45;z<=20;z+=4)highest=Math.max(highest,g.getTerrainHeight(x,z));g.camera.position.set(8,highest+7,16);g.camera.lookAt(0,g.getTerrainHeight(0,-24)+1,-24);});
  await p.waitForTimeout(1200);
 },
 action:async p=>{for(let i=0;i<70;i++){await p.evaluate(()=>{__galleryPhoto.camera.rotation.y+=.003;});await p.waitForTimeout(100);}},
 telemetry:()=>({position:__galleryPhoto.camera.position.toArray(),rotation:__galleryPhoto.camera.rotation.toArray(),chunks:__galleryPhoto.chunks,photo:'Local daylight photography camera over the original generated terrain'})};

if(require.main===module)run(process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
