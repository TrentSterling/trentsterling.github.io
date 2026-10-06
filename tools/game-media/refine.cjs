// Additional photography takes. All controls act inside isolated browser pages.
const {takes,run}=require('./takes.cjs');
const {specs}=require('./capture.cjs');

for(const [name,pattern,yaw,pitch,distance] of [
 ['street','storey tower',1.8,.32,37],
 ['stack','STACK 1',-1.6,.44,34],
 ['water','Water tower',-1.1,.48,28],
])takes['breakmass-clear-'+name]={game:'breakmass',seconds:19,
 setup:async p=>{
  await p.evaluate(({pattern,yaw,pitch,distance})=>{
   const f=BREAKMASS,e=f.inspect().find(e=>e.anchored&&e.name.toLowerCase().includes(pattern.toLowerCase()));
   if(!e)throw Error('Missing demolition target '+pattern);
   const q=e.rotation,[lx,ly,lz]=e.dims.map((n,i)=>n*.25*(i===1?.36:.5));
   const tx=2*(q.y*lz-q.z*ly),ty=2*(q.z*lx-q.x*lz),tz=2*(q.x*ly-q.y*lx);
   const point=[e.position.x+lx+q.w*tx+q.y*tz-q.z*ty,e.position.y+ly+q.w*ty+q.z*tx-q.x*tz,e.position.z+lz+q.w*tz+q.x*ty-q.y*tx];
   window.__demolitionTarget={id:e.id,name:e.name,point,initialCount:e.count};
   f.aimAt(point,distance);f.orbitForTest(yaw,pitch);BREAKMASS_UI.close();
  },{pattern,yaw,pitch,distance});
  await p.mouse.move(640,360);await p.waitForTimeout(1200);
  await p.evaluate(()=>{window.__demolitionTarget.ray=BREAKMASS.targetAtPointer();});
 },
 action:async p=>{
  await p.waitForTimeout(450);await p.evaluate(()=>BREAKMASS.fireRocket());
  await p.waitForTimeout(1300);await p.evaluate(()=>BREAKMASS.bombRain());
  await p.waitForTimeout(2800);await p.evaluate(()=>BREAKMASS.fireRocket());
 },
 telemetry:()=>({target:window.__demolitionTarget,camera:BREAKMASS.cameraState,stats:BREAKMASS.stats,rocket:BREAKMASS.rocketDiagnostics,remainingTarget:BREAKMASS.inspect().filter(e=>e.rootId===window.__demolitionTarget.id).map(e=>({id:e.id,count:e.count,position:e.position,anchored:e.anchored}))})};

for(const mode of ['daylight','mining','blast'])takes['craftmine-clear-'+mode]={
 ...takes['craftmine-travel'],seconds:12,
 setup:async p=>{
  await specs.craftmine.setup(p);
  await p.evaluate(mode=>{
   const g=__galleryGame,player=g.player;
   g.gameTime=.46;g.timeCycleEnabled=true;g.updateDayNightCycle(0);g.timeCycleEnabled=false;
   player.creativeMode=true;player.flying=true;player.velocity.set(0,0,0);
   // Start above a known clear column, then view the terrain instead of the sky.
   let y=0;
   for(let x=8;x<=40;x+=4)for(let z=8;z<=40;z+=4){let top=127;while(top>0&&g.world.getBlock(x,top,z)===0)top--;y=Math.max(y,top);}
   player.position.set(24,y+(mode==='daylight'?7:4),24);player.yaw=mode==='daylight'?.8:-.7;player.pitch=mode==='daylight'?-.72:-.8;
   player.hotbarIndex=mode==='mining'?0:5;
   window.__photoStart={ground:y,time:g.gameTime,mode};
  },mode);await p.waitForTimeout(1500);
 },
 action:async p=>{
  if(mode==='daylight'){
   await p.keyboard.down('KeyD');await p.waitForTimeout(1300);await p.keyboard.up('KeyD');
   for(let i=0;i<45;i++){await p.evaluate(()=>__galleryGame.player.yaw+=.012);await p.waitForTimeout(100);}
  }else{
   for(let i=0;i<9;i++){
    await p.evaluate(mode=>__galleryGame.shootWeapon(mode==='mining'?'CHAINSAW':'ROCKET_LAUNCHER'),mode);
    await p.waitForTimeout(mode==='mining'?250:750);
   }
  }
 },
 telemetry:()=>({position:__galleryGame.player.position.toArray(),collision:__galleryGame.player.checkCollisionAt(...__galleryGame.player.position.toArray()),photo:window.__photoStart,flying:__galleryGame.player.flying,particles:__galleryGame.projectileSystem.particles.length})};

takes['craftmine-quarry']={...takes['craftmine-travel'],seconds:12,
 setup:async p=>{
  await specs.craftmine.setup(p);
  await p.evaluate(()=>{
   const g=__galleryGame,p=g.player,top=(x,z)=>{let y=127;while(y>0&&g.world.getBlock(x,y,z)===0)y--;return y;};
   const candidates=[];
   for(let x=8;x<=40;x+=2)for(let z=8;z<=40;z+=2){const y=top(x,z),block=g.world.getBlock(x,y,z);
    if([1,2,3,6,13,14].includes(block))candidates.push({x,y,z,score:Math.abs(x-24)+Math.abs(z-24)});
   }
   candidates.sort((a,b)=>a.score-b.score);const target=candidates[0];if(!target)throw Error('No open terrain for quarry shot');
   const x=target.x+8,z=target.z+8,y=Math.max(target.y+7,top(x,z)+3);
   p.creativeMode=true;p.flying=true;p.velocity.set(0,0,0);p.position.set(x,y,z);p.hotbarIndex=5;
   const aim=(tx,ty,tz)=>{const dx=tx-p.position.x,dy=ty-p.position.y-1.52,dz=tz-p.position.z;p.yaw=Math.atan2(-dx,-dz);p.pitch=Math.atan2(dy,Math.hypot(dx,dz));};
   window.__quarryTarget=target;window.__quarryAim=aim;aim(target.x+.5,target.y+.5,target.z+.5);
   g.gameTime=.46;g.timeCycleEnabled=true;g.updateDayNightCycle(0);g.timeCycleEnabled=false;
  });await p.waitForTimeout(1800);
 },
 action:async p=>{
  await p.waitForTimeout(350);
  for(const [dx,dz] of [[0,0],[4,0],[0,4],[-3,0]]){
   await p.evaluate(({dx,dz})=>{const t=__quarryTarget;__quarryAim(t.x+.5+dx,t.y+.5,t.z+.5+dz);},{dx,dz});
   await p.waitForTimeout(100);await p.evaluate(()=>__galleryGame.shootWeapon('ROCKET_LAUNCHER'));await p.waitForTimeout(1900);
  }
 },
 telemetry:()=>({position:__galleryGame.player.position.toArray(),target:window.__quarryTarget,collision:__galleryGame.player.checkCollisionAt(...__galleryGame.player.position.toArray()),explosion:__galleryGame.projectileSystem.lastExplosion,particles:__galleryGame.projectileSystem.particles.length,locked:__galleryGame.isLocked})};

takes['craftmine-quarry-close']={...takes['craftmine-quarry'],
 setup:async p=>{await takes['craftmine-quarry'].setup(p);await p.evaluate(()=>{__galleryGame.camera.fov=65;__galleryGame.camera.updateProjectionMatrix();});await p.waitForTimeout(250);},
 action:async p=>{await p.waitForTimeout(350);await p.evaluate(()=>__galleryGame.shootWeapon('BFG'));await p.waitForTimeout(2600);await p.evaluate(()=>__galleryGame.shootWeapon('NUKE_LAUNCHER'));},
 telemetry:()=>({position:__galleryGame.player.position.toArray(),target:window.__quarryTarget,fov:__galleryGame.camera.fov,collision:__galleryGame.player.checkCollisionAt(...__galleryGame.player.position.toArray()),explosion:__galleryGame.projectileSystem.lastExplosion,particles:__galleryGame.projectileSystem.particles.length,locked:__galleryGame.isLocked})};

takes['craftmine-building']={...takes['craftmine-quarry'],seconds:10,
 setup:async p=>{await takes['craftmine-quarry'].setup(p);await p.evaluate(()=>{
  const g=__galleryGame,t=__quarryTarget,p=g.player;p.position.set(t.x+.5,t.y+3,t.z+.5);p.velocity.set(0,0,0);
  const slot=p.hotbar.findIndex(b=>typeof b==='number'&&b!==0);if(slot<0)throw Error('No build block in hotbar');p.hotbarIndex=slot;
  __quarryAim(t.x+.5,t.y+.5,t.z-.5);g.camera.fov=75;g.camera.updateProjectionMatrix();window.__placedTargets=[];
 });await p.waitForTimeout(500);},
 action:async p=>{for(const [dx,dz] of [[0,-1],[1,-1],[-1,-1],[-1,0],[1,0],[1,1],[-1,1],[0,1]]){
  await p.evaluate(({dx,dz})=>{const t=__quarryTarget;__quarryAim(t.x+.5+dx,t.y+.5,t.z+.5+dz);},{dx,dz});await p.waitForTimeout(120);
  await p.evaluate(()=>{__placedTargets.push(__galleryGame.player.getTargetBlock());__galleryGame.handleRightClick();});await p.waitForTimeout(450);
 }},
 telemetry:()=>({position:__galleryGame.player.position.toArray(),target:window.__quarryTarget,placed:window.__placedTargets,collision:__galleryGame.player.checkCollisionAt(...__galleryGame.player.position.toArray()),locked:__galleryGame.isLocked})};

for(const mode of ['reactor','passage'])takes['tunnelrat-clear-'+mode]={game:'tunnelrat',seconds:12,
 setup:async p=>{
  await p.evaluate(async mode=>{
   const T=await import('three'),s=TR.ship,up=new T.Vector3(0,1,0),matrix=new T.Matrix4(),q=new T.Quaternion();
   TR.debug.god();s.velocity.set(0,0,0);const update=s.update.bind(s);let timer=0;
   if(mode==='reactor'){
    const enemy=TR.enemies.list().find(e=>e.alive&&e.isReactor);if(!enemy)throw Error('No reactor');
    const room=TR.graph.nodes.find(n=>n.id===TR.graph.reactorId);
    const candidates=[];
    for(let a=0;a<Math.PI*2;a+=Math.PI/12){const pos=room.pos.clone().add(new T.Vector3(Math.sin(a)*room.radius*.8,1,Math.cos(a)*room.radius*.8));
     if(TR.field.sample(pos.x,pos.y,pos.z)<-1.6)candidates.push(pos);
    }
    if(!candidates.length)throw Error('No clear reactor camera');
    const pos=candidates.sort((a,b)=>b.distanceTo(enemy.pos)-a.distanceTo(enemy.pos))[0];s.object3d.position.copy(pos);
    s.object3d.quaternion.setFromRotationMatrix(matrix.lookAt(pos,enemy.pos,up));
    window.__photoTarget=enemy.pos.toArray();window.__photoStart=pos.toArray();
    s.update=(dt,input)=>{timer+=dt;q.setFromRotationMatrix(matrix.lookAt(s.object3d.position,enemy.pos,up));s.object3d.quaternion.slerp(q,1-Math.exp(-dt*4));
     input.axis={x:timer<4?.1:0,y:0,z:0,roll:0};input.mouseDX=input.mouseDY=0;input.fire=timer>.8&&enemy.alive;input.boost=false;update(dt,input);};
   }else{
    // Pick a straight, open stretch of an authored tunnel polyline.
    const options=[];
    for(const e of TR.field.decor.edges.filter(e=>!e.locked&&e.style==='built')){
     const line=e.polyline;
     for(let i=1;i<line.length-2;i++)for(let j=i+2;j<line.length-1;j++){
      const from=line[i],to=line[j],dir=to.clone().sub(from),length=dir.length();
      if(length<6||Math.abs(dir.y)>length*.8)continue;
      let clear=true;
      for(let t=0;t<=1;t+=.04){const p=from.clone().lerp(to,t);if(TR.field.sample(p.x,p.y,p.z)>-1.7){clear=false;break;}}
      if(clear)options.push({from,to,length,score:length*(1-Math.abs(dir.y)/length)});
     }
    }
    options.sort((a,b)=>b.score-a.score);const segment=options[0];if(!segment)throw Error('No clear straight flight segment');
    s.object3d.position.copy(segment.from);s.object3d.quaternion.setFromRotationMatrix(matrix.lookAt(segment.from,segment.to,up));
    window.__photoTarget=segment.to.toArray();window.__photoStart=segment.from.toArray();
    s.update=(dt,input)=>{timer+=dt;input.axis={x:0,y:0,z:s.object3d.position.distanceTo(segment.to)>5?.2:0,roll:0};input.mouseDX=input.mouseDY=0;input.fire=false;input.boost=false;update(dt,input);};
   }
  },mode);await p.waitForTimeout(100);
 },
 telemetry:()=>({phase:TR.gamestate.phase,position:TR.ship.object3d.position.toArray(),clearance:TR.field.sample(...TR.ship.object3d.position.toArray()),start:window.__photoStart,target:window.__photoTarget,livingEnemies:TR.enemies.list().filter(e=>e.alive).length})};

for(const map of [4,6])takes['biomass-clear-'+map]={game:'biomass',url:'/capture/biomass/?map='+map+'&autoplay=1&speed=2&spawn=6000&gold=3000&autobuild=1',seconds:18,
 setup:async p=>p.waitForTimeout(7000),
 action:async p=>{await p.waitForTimeout(300);await p.evaluate(()=>__biomassStress(18000));await p.waitForTimeout(5500);await p.evaluate(()=>__biomassStress(12000));},
 telemetry:()=>__biomass()};

if(require.main===module)run(process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
