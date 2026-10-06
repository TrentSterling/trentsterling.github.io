// Photography copies expose controls; terrain, movement and lighting remain original.
const fs=require('node:fs'),path=require('node:path');
const {takes,run}=require('./takes.cjs');
const {root}=require('./server.cjs');
function hook(game,original,needle,insertion,outputName='portfolio-action.html'){
 const dir=path.join(root,'.local/sources',game),source=path.join(dir,original);
 const html=fs.readFileSync(source,'utf8');if(!html.includes(needle))throw Error('Missing capture hook: '+game);
 const output=path.join(dir,outputName);fs.writeFileSync(output,html.replace(needle,insertion+needle));return output;
}

const terrain=hook('terrainlab','index.html','window.__earthworks={',`window.__photoTerrain={
 aim(p,t){closeControls(true);nav='fly';walk.paused=false;motion.velocity.set(0,0,0);camera.position.fromArray(p);camera.lookAt(...t);const e=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');flyYaw=e.y;flyPitch=e.x;updateCamera();stream(true);},
 resize, get camera(){return camera;},get edits(){return edits.length;}
};\n`);
for(const mode of ['carve','build'])takes['terrainlab-'+mode]={game:'terrainlab',url:'/capture/terrainlab/portfolio-action.html',source:terrain,seconds:16,
 ready:()=>!!window.__photoTerrain,
 setup:async p=>{
  await p.addStyleTag({content:'#viewport{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important}#scene{width:100%!important;height:100%!important}.tront-about{display:none!important}'});
  await p.evaluate(async()=>{__photoTerrain.resize();await __surfaceWorld.whenIdle();});
  await p.evaluate(mode=>{const q=__surfaceWorld,points=[];
   for(let x=-8;x<=24;x+=4)for(let z=-8;z<=24;z+=4){const h=q.groundAt(x,z);if(h&&h.point[1]>4)points.push(h.point);}
   points.sort((a,b)=>b[1]-a[1]);if(!points.length)throw Error('No dry terrain found');
   const t=mode==='carve'?points[0]:points[Math.floor(points.length/2)];window.__terrainTarget=t;window.__terrainActions=[];
   __photoTerrain.aim([t[0]+32,t[1]+22,t[2]+36],[t[0],t[1]+(mode==='build'?5:-3),t[2]]);
  },mode);await p.evaluate(()=>__surfaceWorld.whenIdle());await p.waitForTimeout(600);
 },
 action:async p=>{await p.waitForTimeout(400);
  if(mode==='carve'){
   for(let i=0;i<16;i++){await p.evaluate(i=>{const t=__terrainTarget,point=[t[0]+Math.sin(i*.35)*4,t[1]-2-i*.25,t[2]+10-i*1.5];
    const ok=__surfaceWorld.stampAt(point,false,'sphere',6);__terrainActions.push({point,ok,time:performance.now()});},i);await p.waitForTimeout(450);}
  }else{
   for(let i=0;i<12;i++){await p.evaluate(i=>{const t=__terrainTarget,side=i%2?-1:1,point=[t[0]+side*11,t[1]+Math.floor(i/2)*2,t[2]];
    const ok=__surfaceWorld.stampAt(point,true,'sphere',4.3);__terrainActions.push({point,ok,time:performance.now()});},i);await p.waitForTimeout(400);}
   await p.evaluate(()=>{const t=__terrainTarget;const ok=__earthworks.buildBridge([t[0]-11,t[1]+13,t[2]],[t[0]+11,t[1]+13,t[2]],6);__terrainActions.push({bridge:true,ok,time:performance.now()});});
  }
 },
 telemetry:()=>({target:__terrainTarget,actions:__terrainActions,edits:__photoTerrain.edits,camera:__photoTerrain.camera.position.toArray(),sculpt:__surfaceWorld.sculptReport(),earth:__earthworks.report(),stats:__surfaceWorld.stats()})};

takes['terrainlab-meteors']={...takes['terrainlab-carve'],seconds:10,
 setup:async p=>{await takes['terrainlab-carve'].setup(p);await p.evaluate(()=>{const t=__terrainTarget;__photoTerrain.aim([t[0]+26,t[1]+22,t[2]+32],[t[0],t[1]-2,t[2]]);});await p.evaluate(()=>__surfaceWorld.whenIdle());await p.evaluate(()=>{const t=__terrainTarget;window.__meteorTargets=[[0,0],[-16,6],[12,-5]].map(([dx,dz])=>{const h=__surfaceWorld.groundAt(t[0]+dx,t[2]+dz);if(!h)throw Error('Meteor target missing before recording');return h.point;});});},
 action:async p=>{await p.waitForTimeout(600);for(let i=0;i<3;i++){await p.evaluate(i=>{const point=__meteorTargets[i],ok=__terrainPlay.callMeteor(point,12);__terrainActions.push({point,ok,time:performance.now()});},i);await p.waitForTimeout(2200);}},
 telemetry:()=>({target:__terrainTarget,actions:__terrainActions,edits:__photoTerrain.edits,wild:__terrainPlay.report(),camera:__photoTerrain.camera.position.toArray()})};

const mega=hook('megabunk','play/index.html','        animate();',`window.__megaCapture={THREE,scene,camera,player,params,keys,getTerrainHeight,getMaxTerrainH,
 get size(){return worldSize;},pose(yaw,pitch,distance){camYaw=yaw;camPitch=pitch;camDist=distance;},
 spawn(x,z){player.position.set(x,getMaxTerrainH(x,z)+.5,z);playerVelY=0;},
 get velocityY(){return playerVelY;}
};\n`);
for(const close of [false,true])takes['megabunk-'+(close?'close-traverse':'ridge-traverse')]={game:'megabunk',url:'/capture/megabunk/portfolio-action.html',source:mega,seconds:16,
 ready:()=>!!window.__megaCapture,
 setup:async p=>{await p.evaluate(close=>{
  const g=__megaCapture,N=g.size,nodes=new Map();
  for(let x=2;x<N-2;x++)for(let z=2;z<N-2;z++){const y=g.getMaxTerrainH(x+.5,z+.5);if(Number.isFinite(y)&&y>g.params.waterLevel+.5)nodes.set(x+','+z,{x:x+.5,z:z+.5,y});}
  const walk=start=>{const seen=new Map([[start,null]]),queue=[start];for(let i=0;i<queue.length;i++){
   const key=queue[i],a=nodes.get(key);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const other=(Math.floor(a.x)+dx)+','+(Math.floor(a.z)+dz),b=nodes.get(other);
    if(b&&!seen.has(other)&&Math.abs(a.y-b.y)<1.15){seen.set(other,key);queue.push(other);}
   }
  }return {seen,last:queue.at(-1),count:queue.length};};
  let best=null;for(const key of [...nodes.keys()].filter((_,i)=>i%113===0)){const component=walk(key);if(!best||component.count>best.count)best=component;}
  if(!best||best.count<25)throw Error('No useful traversable terrain component');
  const routeEnd=walk(best.last),route=[];for(let key=routeEnd.last;key;key=routeEnd.seen.get(key))route.push(nodes.get(key));route.reverse();
  if(route.length<20)throw Error('Route too short');
  g.spawn(route[0].x,route[0].z);g.pose(0,.62,close?6.5:10);g.scene.fog.near=18;g.scene.fog.far=90;
  window.__megaRoute=route;window.__megaSamples=[];window.__megaAt=1;window.__megaPilot=false;
  window.__startMegaPilot=()=>{__megaPilot=true;let frames=0;const tick=()=>{
   if(!__megaPilot)return;const p=g.player.position;
   while(__megaAt<route.length-1&&Math.hypot(route[__megaAt].x-p.x,route[__megaAt].z-p.z)<.4)__megaAt++;
   const t=route[__megaAt],dx=t.x-p.x,dz=t.z-p.z,dist=Math.hypot(dx,dz),yaw=Math.atan2(-dx,-dz);
   g.pose(yaw,.62,close?6.5:10);g.keys.KeyW=dist>.25;
   const ahead=g.getMaxTerrainH(p.x+dx/Math.max(dist,.01)*.45,p.z+dz/Math.max(dist,.01)*.45);
   g.keys.Space=Number.isFinite(ahead)&&ahead>g.getMaxTerrainH(p.x,p.z)+.15;
   if(frames++%6===0)__megaSamples.push({at:__megaAt,position:p.toArray(),ground:g.getMaxTerrainH(p.x,p.z),jump:g.keys.Space,velocityY:g.velocityY});
   requestAnimationFrame(tick);
  };tick();};
 },close);await p.waitForTimeout(600);},
 action:async p=>{await p.waitForTimeout(250);await p.evaluate(()=>__startMegaPilot());await p.waitForTimeout(14500);await p.evaluate(()=>{__megaPilot=false;__megaCapture.keys.KeyW=__megaCapture.keys.Space=false;});},
 telemetry:()=>({route:__megaRoute,at:__megaAt,samples:__megaSamples,position:__megaCapture.player.position.toArray(),ground:__megaCapture.getMaxTerrainH(__megaCapture.player.position.x,__megaCapture.player.position.z)})};

// Select a straight, visible section before recording. The original follow camera,
// keyboard movement, jumping and collision still run for every recorded frame.
const megaFramed=hook('megabunk','play/index.html','        animate();',`window.__megaCapture={THREE,scene,camera,player,params,keys,getTerrainHeight,getMaxTerrainH,generateWorld,
 get size(){return worldSize;},pose(yaw,pitch,distance){camYaw=yaw;camPitch=pitch;camDist=distance;},
 spawn(x,z){player.position.set(x,getMaxTerrainH(x,z)+.5,z);playerVelY=0;},get velocityY(){return playerVelY;}
};\n`,'portfolio-framed.html');
for(const view of [{close:false,summit:false},{close:true,summit:false},{close:false,summit:true},{close:true,summit:true}])takes['megabunk-'+(view.summit?'summit':'clear')+'-'+(view.close?'detail':'wide')]={game:'megabunk',url:'/capture/megabunk/portfolio-framed.html',source:megaFramed,seconds:10,
 ready:()=>!!window.__megaCapture,
 setup:async p=>{await p.evaluate(({close,summit})=>{
  const g=__megaCapture,dist=close?3.5:6,pitch=.85;
  g.params.hilliness=.06;g.params.straightChance=.94;g.params.gapChance=0;g.generateWorld();
  const candidates=[];
  for(let x=3;x<g.size-3;x++)for(let z=3;z<g.size-3;z++)for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1]]){
   const route=[];let last=g.getMaxTerrainH(x+.5,z+.5),clear=true;
   for(let i=0;i<24;i++){
    const px=x+.5+dx*i,pz=z+.5+dz*i,h=g.getMaxTerrainH(px,pz);
    if(px<2||pz<2||px>g.size-2||pz>g.size-2||!Number.isFinite(h)||h<1||Math.abs(h-last)>1.1)break;
    // Behind the player is the unmodified follow-camera location.
    for(let s=1;s<=16;s++){const t=s/16,ground=g.getTerrainHeight(px-dx*dist*t,pz-dz*dist*t),ray=h+1+(dist*pitch+1.5)*t;if(ground>ray-.2){clear=false;break;}}
    if(!clear)break;route.push({x:px,z:pz,y:h});last=h;
   }
   if(route.length>=(summit?8:12)){
    if(summit)route.splice(12);
    const floor=Math.min(...route.map(p=>p.y));
    candidates.push({route,dx,dz,score:summit?floor*20+route.length:route.length+route[0].y*.04});
   }
  }
  candidates.sort((a,b)=>b.score-a.score);if(!candidates.length)throw Error('No clear traversal shot found');
  const chosen=candidates[0],route=chosen.route,yaw=Math.atan2(-chosen.dx,-chosen.dz);
  window.__megaRoute=route;window.__megaSamples=[];window.__megaAt=1;window.__megaPilot=false;
  g.spawn(route[0].x,route[0].z);g.pose(yaw,pitch,dist);g.scene.fog.near=18;g.scene.fog.far=90;
  window.__startMegaPilot=()=>{__megaPilot=true;let frames=0;const tick=()=>{
   if(!__megaPilot)return;const p=g.player.position;
   while(__megaAt<route.length-1&&Math.hypot(route[__megaAt].x-p.x,route[__megaAt].z-p.z)<.4)__megaAt++;
   const t=route[__megaAt],remaining=Math.hypot(t.x-p.x,t.z-p.z),move=remaining>.25;
   g.keys.KeyW=move&&frames%2===0;const ahead=g.getMaxTerrainH(p.x+chosen.dx*.5,p.z+chosen.dz*.5);
   g.keys.Space=move&&((frames%125<2)||ahead>g.getMaxTerrainH(p.x,p.z)+.15);
   if(frames++%6===0)__megaSamples.push({at:__megaAt,position:p.toArray(),ground:g.getMaxTerrainH(p.x,p.z),jump:g.keys.Space,velocityY:g.velocityY,camera:g.camera.position.toArray()});
   requestAnimationFrame(tick);
  };tick();};
 },view);await p.waitForTimeout(600);},
 action:async p=>{await p.waitForTimeout(250);await p.evaluate(()=>__startMegaPilot());await p.waitForTimeout(8500);await p.evaluate(()=>{__megaPilot=false;__megaCapture.keys.KeyW=__megaCapture.keys.Space=false;});},
 telemetry:()=>({route:__megaRoute,at:__megaAt,samples:__megaSamples,position:__megaCapture.player.position.toArray(),ground:__megaCapture.getMaxTerrainH(__megaCapture.player.position.x,__megaCapture.player.position.z)})};

const probes=hook('vibevoxelprobes','index.html','        init();animate();',`window.__probeCapture={THREE,params,get camera(){return camera;},get scene(){return scene;},get controls(){return controls;},get renderer(){return renderer;},get ambient(){return ambientLight;},get lights(){return lights;},get probe(){return movableProbeSphere;},get grid(){return voxelGrid;},get lines(){return visibleDirLinesCount;}};\n`);
for(const close of [false,true])takes['voxelprobes-'+(close?'detail':'field')]={game:'vibevoxelprobes',url:'/capture/vibevoxelprobes/portfolio-action.html',source:probes,seconds:12,
 ready:()=>!!window.__probeCapture?.camera,
 setup:async p=>{await p.evaluate(close=>{const g=__probeCapture,T=g.THREE;
  g.params.numActiveLights=close?12:8;g.params.sceneAmbientLight.intensity=.75;g.ambient.intensity=.75;
  g.params.voxelVisuals.intensityCap=18;g.params.voxelVisuals.maxOpacity=.3;g.params.voxelVisuals.emissiveStrength=.7;
  g.params.debugVisuals.directionMinIntensity=.6;g.params.debugVisuals.directionLineLength=.32;
  g.lights.forEach(l=>{l.intensity=4;l.range=4.6;});
  g.controls.enableDamping=false;g.controls.target.set(0,0,0);g.camera.fov=46;g.camera.updateProjectionMatrix();
  g.camera.position.set(...(close?[8,5,9]:[10,8,12]));g.controls.update();window.__probeAngle=Math.atan2(g.camera.position.x,g.camera.position.z);window.__probeRadius=Math.hypot(g.camera.position.x,g.camera.position.z);
  window.__probeSamples=[];
 },close);await p.waitForTimeout(500);},
 action:async p=>{for(let i=0;i<105;i++){await p.evaluate(i=>{const g=__probeCapture;__probeAngle+=.004;
   g.camera.position.x=Math.sin(__probeAngle)*__probeRadius;g.camera.position.z=Math.cos(__probeAngle)*__probeRadius;g.controls.update();
   g.probe.position.set(Math.sin(i*.045)*2,Math.sin(i*.029)*1.2,Math.cos(i*.045)*1.8);
   if(i%10===0)__probeSamples.push({position:g.probe.position.toArray(),color:g.probe.material.uniforms.uVoxelLightColor.value.toArray(),lines:g.lines});
  },i);await p.waitForTimeout(100);}},
 telemetry:()=>({camera:__probeCapture.camera.position.toArray(),lights:__probeCapture.params.numActiveLights,lines:__probeCapture.lines,probe:__probeCapture.probe.position.toArray(),color:__probeCapture.probe.material.uniforms.uVoxelLightColor.value.toArray(),samples:__probeSamples})};

takes['voxelprobes-balanced']={...takes['voxelprobes-detail'],
 setup:async p=>{await takes['voxelprobes-detail'].setup(p);await p.evaluate(()=>{const g=__probeCapture;
  g.params.numActiveLights=6;g.params.voxelVisuals.maxOpacity=.26;g.params.voxelVisuals.intensityCap=12;g.params.voxelVisuals.emissiveStrength=.7;
  g.params.debugVisuals.directionMinIntensity=.3;g.lights.forEach(l=>{l.intensity=2.4;l.range=4.6;});
  g.camera.position.set(7,4,8);g.controls.update();__probeAngle=Math.atan2(7,8);__probeRadius=Math.hypot(7,8);
 });await p.waitForTimeout(400);}};

if(require.main===module)run(process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
