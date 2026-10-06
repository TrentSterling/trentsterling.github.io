// Original movement and built-in material/shader controls, recorded for card edits.
const {takes,run}=require('./takes.cjs');
const {specs}=require('./capture.cjs');

async function sample(p,expression,seconds){
 await p.evaluate(()=>{window.__detailSamples=[];window.__detailStart=performance.now();});
 const start=Date.now();while(Date.now()-start<seconds*1000){await p.evaluate(expression);await p.waitForTimeout(120);}
}
for(const game of ['wolfenstein','vibemaze'])for(const mode of ['route','far-route'])takes[game+'-'+mode]={game,dom:true,seconds:24,
 setup:async p=>{
  await specs[game].setup(p);
  await p.addStyleTag({content:`body{margin:0!important;padding:0!important;background:#000!important;overflow:hidden!important}body *{visibility:hidden!important}#gameScreen{visibility:visible!important;position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;line-height:1!important;font-size:${game==='wolfenstein'?'17.5':'12'}px!important;font-family:'Courier New',monospace!important;font-weight:normal!important;letter-spacing:0!important;background:#000!important;color:#fff!important}`});
  await p.evaluate(({game,mode})=>{
   const maze=game==='vibemaze',grid=maze?mazeMap:map,step=maze?MAP_SCALE:1;
   const world=(x,z)=>maze?[(x-(grid[0].length-1)/2)*step,(z-(grid.length-1)/2)*step]:[x+.5,z+.5];
   const getCell=()=>maze?[Math.round(camera.pos.x/step+(grid[0].length-1)/2),Math.round(camera.pos.z/step+(grid.length-1)/2)]:[Math.floor(player.x),Math.floor(player.y)];
   if(mode==='far-route'){
    const start=maze?[13,13]:[22,22],pos=world(...start);if(grid[start[1]][start[0]]===1)throw Error('Staged start is a wall');
    if(maze){camera.pos.x=pos[0];camera.pos.z=pos[1];}else{player.x=pos[0];player.y=pos[1];}
   }
   const bfs=start=>{const q=[start],paths=new Map([[start.join(','),[start]]]);for(let i=0;i<q.length;i++){const [x,z]=q[i];for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1]]){const n=[x+dx,z+dz],key=n.join(',');if(grid[n[1]]?.[n[0]]===undefined||grid[n[1]][n[0]]===1||paths.has(key))continue;paths.set(key,[...paths.get([x,z].join(',')),n]);q.push(n);}}return paths;};
   let cell=getCell(),route=[cell],remaining=[];
   for(let z=0;z<grid.length;z++)for(let x=0;x<grid[z].length;x++)if(grid[z][x]>1)remaining.push([x,z]);
   if(maze){while(remaining.length){const paths=bfs(cell);remaining.sort((a,b)=>(paths.get(a.join(','))?.length||1e9)-(paths.get(b.join(','))?.length||1e9));const target=remaining.shift(),segment=paths.get(target.join(','));if(!segment)continue;route.push(...segment.slice(1));cell=target;}}
   else{const paths=[...bfs(cell).values()].sort((a,b)=>b.length-a.length);route=paths[0];}
   const points=route.map(c=>world(...c));let index=1;
   const angleFor=(dx,dz)=>maze?Math.atan2(-dx,dz):Math.atan2(dz,dx);
   const initial=angleFor(points[1][0]-points[0][0],points[1][1]-points[0][1]);if(maze){camera.yaw=initial;camera.pitch=0;}else player.angle=initial;
   window.__routeCapture={game,grid,points,index:1,done:false};window.__detailSamples=[];
   window.__routePilot=()=>{const x=maze?camera.pos.x:player.x,z=maze?camera.pos.z:player.y;
    while(index<points.length&&Math.hypot(points[index][0]-x,points[index][1]-z)<(maze?.28:.18))index++;
    __routeCapture.index=index;if(index>=points.length){keysPressed.w=false;__routeCapture.done=true;return;}
    const dx=points[index][0]-x,dz=points[index][1]-z,angle=maze?camera.yaw:player.angle,desired=angleFor(dx,dz),error=Math.atan2(Math.sin(desired-angle),Math.cos(desired-angle));
    const next=angle+Math.max(-.13,Math.min(.13,error));if(maze)camera.yaw=next;else player.angle=next;keysPressed.w=Math.abs(error)<.25;
   };
  },{game,mode});await p.waitForTimeout(300);
 },
 action:async p=>{await p.evaluate(()=>window.__routeTimer=setInterval(__routePilot,33));await sample(p,()=>{const maze=__routeCapture.game==='vibemaze',pos=maze?[camera.pos.x,camera.pos.z]:[player.x,player.y];__detailSamples.push({t:(performance.now()-__detailStart)/1000,pos,angle:maze?camera.yaw:player.angle,index:__routeCapture.index,walking:!!keysPressed.w,wall:maze?isWallAtWorldPos(...pos):isWall(...pos),score:maze?score:null,remaining:maze?collectibles.length:null});},22.5);await p.evaluate(()=>{clearInterval(__routeTimer);keysPressed.w=false;});},
 telemetry:()=>({route:window.__routeCapture,samples:window.__detailSamples})};

for(const mode of ['sunny','paper','avenue'])takes['asciicity-'+mode]={game:'asciicity',seconds:14,
 setup:async p=>{await p.waitForTimeout(1800);await p.evaluate(async mode=>{const [core,post,pm]=await Promise.all([import('./src/core.js'),import('./src/post/ascii.js'),import('./src/player.js')]);window.__cityCapture={core,post,pm};Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>core.renderer.domElement});document.dispatchEvent(new Event('pointerlockchange'));
  Object.assign(post.P,post.PRESETS[mode==='paper'?'paper print':'sunny dense'],{cellW:mode==='paper'?10:12,exposure:1.5});post.view.mode=1;post.resize();post.syncParams();
  pm.player.yaw=-Math.PI/2;pm.player.pitch=.03;if(mode==='avenue'){pm.player.pos.x+=52.4;pm.player.pos.z-=52.4;pm.player.yaw=0;}
  window.__detailSamples=[];
 },mode);await p.waitForTimeout(600);},
 action:async p=>{await p.keyboard.down('KeyW');await sample(p,()=>{const c=__cityCapture;__detailSamples.push({t:(performance.now()-__detailStart)/1000,position:c.pm.player.pos.toArray(),velocity:c.pm.player.vel.toArray(),yaw:c.pm.player.yaw,view:c.post.view.mode});},12.5);await p.keyboard.up('KeyW');},
 telemetry:()=>({player:__cityCapture.pm.player.pos.toArray(),params:__cityCapture.post.P,mode:__cityCapture.post.view.mode,samples:window.__detailSamples})};

for(const mode of ['island','masonry','macro','woodland'])takes['vixels-'+mode]={game:'vixels',seconds:10,
 setup:async p=>{await p.evaluate(mode=>{VIXELS.setMode(mode==='island'?'chunk':mode==='masonry'?'block':'surface');if(mode!=='island')VIXELS.select(mode==='masonry'?'masonry':mode==='woodland'?'woodland':'logEnd');VIXELS.fit();if(mode==='macro'||mode==='woodland')VIXELS.macro();window.__detailSamples=[];},mode);if(mode==='woodland'){const r=await p.locator('#view').boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);for(let i=0;i<2;i++){await p.mouse.wheel(0,400);await p.waitForTimeout(150);}}await p.waitForTimeout(300);},
 action:async p=>{const collecting=sample(p,()=>__detailSamples.push({t:(performance.now()-__detailStart)/1000,camera:VIXELS.camera,state:VIXELS.state}),8.5);const r=await p.locator('#view').boundingBox(),surface=mode==='macro'||mode==='woodland';await p.mouse.move(r.x+r.width*.5,r.y+r.height*.5);await p.mouse.down();for(let i=0;i<425;i++){await p.mouse.move(r.x+r.width*.5+i*(surface?.11:.22),r.y+r.height*.5+Math.sin(i*.007)*(surface?25:12));await p.waitForTimeout(16);}await p.mouse.up();await collecting;},
 telemetry:()=>({camera:VIXELS.camera,state:VIXELS.state,statistics:VIXELS.statistics,errors:VIXELS.errors,samples:window.__detailSamples})};
for(const mode of ['island','masonry','woodland'])takes['vixels-'+mode+'-smooth']={...takes['vixels-'+mode]};

for(const [i,mode] of ['colors','texture','radar','lava'].entries())takes['spheres-'+mode]={game:'spheres',seconds:9,
 setup:async p=>{await specs.spheres.setup(p);await p.evaluate(({i,mode})=>{controls.seed.value=1713+i*419;controls.seed.dispatchEvent(new Event('input',{bubbles:true}));shaderModeSelect.value=mode;shaderModeSelect.dispatchEvent(new Event('change',{bubbles:true}));window.__detailSamples=[];},{i,mode});await p.waitForTimeout(350);},
 action:async p=>sample(p,()=>__detailSamples.push({t:(performance.now()-__detailStart)/1000,mode:shaderModeSelect.value,seed:+controls.seed.value,width:webGLCanvas.width,height:webGLCanvas.height}),7.5),
 telemetry:()=>({mode:shaderModeSelect.value,seed:+controls.seed.value,width:webGLCanvas.width,height:webGLCanvas.height,samples:window.__detailSamples})};
if(require.main===module)run(process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
