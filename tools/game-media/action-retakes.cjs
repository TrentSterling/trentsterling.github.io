// Isolated gameplay takes using the original controls and simulation.
const {takes,run}=require('./takes.cjs');
const {specs}=require('./capture.cjs');

for(const weapon of ['BFG','ROCKET_LAUNCHER'])takes['craftmine-ground-'+weapon.toLowerCase()]={
 ...takes['craftmine-travel'],seconds:12,
 setup:async page=>{
  await specs.craftmine.setup(page);
  await page.evaluate(()=>{
   const game=__galleryGame,world=game.world,sites=[];
   // Scout the existing seeded world, then let the normal loader build its terrain.
   for(let x=-2048;x<=2048;x+=32)for(let z=-2048;z<=2048;z+=32){
    if(world.getBiome(x,z)!==1)continue;
    if([-32,0,32].some(dx=>[-32,0,32].some(dz=>world.getBiome(x+dx,z+dz)!==1)))continue;
    sites.push({x,z,distance:Math.hypot(x,z)});
   }
   sites.sort((a,b)=>a.distance-b.distance);
   if(!sites.length)throw Error('No original desert biome found');
   window.__groundSite=sites[0];
   const p=game.player;p.creativeMode=true;p.flying=true;p.velocity.set(0,0,0);
   p.position.set(__groundSite.x,96,__groundSite.z);
  });
  await page.waitForTimeout(3000);
  await page.evaluate(()=>{
   const game=__galleryGame,world=game.world,player=game.player;
   const columns=new Map();
   const top=(x,z)=>{const key=x+','+z;if(columns.has(key))return columns.get(key);
    let y=127;while(y>0&&world.getBlock(x,y,z)===0)y--;
    let foliage=false;for(let depth=0;depth<12&&y-depth>0;depth++)if([4,5,15].includes(world.getBlock(x,y-depth,z)))foliage=true;
    const column={x,y,z,block:world.getBlock(x,y,z),foliage};columns.set(key,column);return column;};
   const candidates=[];
   for(let x=__groundSite.x-32;x<=__groundSite.x+32;x+=2)for(let z=__groundSite.z-32;z<=__groundSite.z+32;z+=2){
    const target=top(x,z);if(![1,3,6,13,14].includes(target.block)||target.foliage||target.y<35)continue;
    let foliage=0,variation=0;
    for(let dx=-8;dx<=8;dx+=2)for(let dz=-8;dz<=8;dz+=2){const n=top(x+dx,z+dz);if(n.foliage)foliage++;variation+=Math.abs(n.y-target.y);}
    if(foliage)continue;
    const eye={x:x+9,y:target.y+10,z:z+12};
    if(player.checkCollisionAt(eye.x,eye.y-1.52,eye.z))continue;
    let obstruction=null;
    for(let t=0;t<1;t+=.012){const px=eye.x+(x+.5-eye.x)*t,py=eye.y+(target.y+.3-eye.y)*t,pz=eye.z+(z+.5-eye.z)*t;
     const block=world.getBlock(Math.floor(px),Math.floor(py),Math.floor(pz));
     if(block&&block!==7){obstruction={x:px,y:py,z:pz,block,distance:Math.hypot(px-x-.5,py-target.y-.3,pz-z-.5)};break;}
    }
    if(obstruction&&(obstruction.distance>2||[4,5].includes(obstruction.block)))continue;
    candidates.push({target,eye,foliage,variation,obstruction,score:variation+Math.hypot(x-__groundSite.x,z-__groundSite.z)*.1});
   }
   candidates.sort((a,b)=>a.score-b.score);
   if(!candidates.length)throw Error('No foliage-free terrain with a clear projectile path');
   const chosen=candidates[0],t=chosen.target;
   player.creativeMode=true;player.flying=true;player.velocity.set(0,0,0);
   player.position.set(chosen.eye.x,chosen.eye.y-1.52,chosen.eye.z);
   game.camera.fov=65;game.camera.updateProjectionMatrix();
   game.gameTime=.46;game.timeCycleEnabled=true;game.updateDayNightCycle(0);game.timeCycleEnabled=false;
   window.__openTerrain={...chosen,biome:world.getBiome(t.x,t.z),site:__groundSite,shots:[],initialModified:world.modifiedBlocks.size};
   window.__openAim=(x,y,z)=>{const dx=x-player.position.x,dy=y-player.position.y-1.52,dz=z-player.position.z;player.yaw=Math.atan2(-dx,-dz);player.pitch=Math.atan2(dy,Math.hypot(dx,dz));};
   __openAim(t.x+.5,t.y+.3,t.z+.5);
  });
  await page.waitForTimeout(2200);
 },
 action:async page=>{
  await page.waitForTimeout(450);
  await page.evaluate(weapon=>{__galleryGame.shootWeapon(weapon);__openTerrain.shots.push({weapon,time:performance.now()});},weapon);
  await page.waitForTimeout(2500);
  await page.evaluate(weapon=>{const t=__openTerrain.target;__openAim(t.x+3.5,t.y-3,t.z+.5);},weapon);
  await page.waitForTimeout(250);
  await page.evaluate(weapon=>{__galleryGame.shootWeapon(weapon);__openTerrain.shots.push({weapon,time:performance.now()});},weapon);
  await page.waitForTimeout(2200);
  for(let i=0;i<35;i++){
   await page.evaluate(()=>{const p=__galleryGame.player,t=__openTerrain.target;p.position.x+=.1;__openAim(t.x+.5,t.y-2,t.z+.5);});
   await page.waitForTimeout(100);
  }
 },
 telemetry:()=>({photo:__openTerrain,position:__galleryGame.player.position.toArray(),
  collision:__galleryGame.player.checkCollisionAt(...__galleryGame.player.position.toArray()),
  modifiedBlocks:__galleryGame.world.modifiedBlocks.size,explosion:__galleryGame.projectileSystem.lastExplosion,
  particles:__galleryGame.projectileSystem.particles.length,locked:__galleryGame.isLocked})
};

for(const mode of ['rockets','balloons','freeze-air'])takes['buddy-action-'+mode]={
 game:'buddy',seconds:10,
 setup:async page=>{
  await specs.buddy.setup(page);
  await page.evaluate(()=>{if(!__buddy.state.free)document.getElementById('modeBtn').click();});
  await page.waitForTimeout(250);await page.evaluate(()=>__buddy.command('clearall'));
  await page.waitForTimeout(300);
 },
 action:async page=>{
  if(mode==='balloons'){
   for(let i=0;i<7;i++){
    await page.evaluate(i=>{const n=__buddy.state.n[[0,5,8,1,10,12,0][i]];__buddy.input({x:n[1],y:n[2],down:true,tool:'balloon'});},i);
    await page.waitForTimeout(80);await page.evaluate(()=>__buddy.input({down:false}));await page.waitForTimeout(500);
   }
  }else{
   for(let i=0;i<65;i++){
    await page.evaluate(({mode,i})=>{const n=__buddy.state.n[1];const tool=mode==='rockets'?'rocket':i<18?'freeze':'air';
     __buddy.input({x:n[1],y:n[2],down:true,tool});},{mode,i});
    await page.waitForTimeout(100);
   }
   await page.evaluate(()=>__buddy.input({down:false}));
  }
 },
 telemetry:()=>({state:__buddy.state,stats:__buddy.stats})
};

if(require.main===module)run(process.argv.slice(2)).catch(error=>{console.error(error);process.exitCode=1;});
