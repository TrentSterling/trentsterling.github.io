// Records the running games without modifying their sources or their saves.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync}=require('node:child_process');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/trontstack/tmp/card-refresh/tools/node_modules/playwright');
const {createServer,root} = require('./server.cjs');
const out = path.join(root,'.local/masters');
fs.mkdirSync(out,{recursive:true});
const specs = {
  buddy:{url:'/capture/buddy/?room=local-portfolio-20261005',source:path.join(root,'.local/sources/buddy/index.html'),ready:()=>!!window.__buddy,canvas:'#game',setup:async p=>{await p.waitForTimeout(1000);await p.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.getElementById('hideUIBtn').click();});},action:async p=>{for(let i=0;i<8;i++){await p.evaluate(i=>{const b=__buddy.state.n[0];__buddy.input({x:b[1],y:b[2],down:true,tool:'mallet'});},i);await p.waitForTimeout(320);await p.evaluate(()=>__buddy.input({down:false}));await p.waitForTimeout(420);}},telemetry:()=>({state:__buddy.state,stats:__buddy.stats})},
  senddudes: {
    url:'/capture/senddudes/#elite-200k', ready:()=>window.SendDudes?.gpu.state==='fighting' && document.getElementById('boot').hidden,
    source:'C:/trontstack/senddudes/index.html', canvas:'canvas',
    setup:async p=>{
      await p.evaluate(()=>{const s=SendDudes;s.settings.blood=true;s.settings.shake=false;s.settings.resolution='1';s.setSpeed(4);});
      await p.waitForTimeout(4500);
      await p.evaluate(()=>{SendDudes.setSpeed(1);Object.assign(SendDudes.view,{s:29,x:0,y:0});});
    },
    action:async p=>{await p.waitForTimeout(1400);await p.evaluate(()=>{SendDudes.gpu.cooldown=0;SendDudes.cast(0,0);});},
    telemetry:()=>SendDudes.report(),
  },
  froxel:{url:'/capture/froxel/',source:'C:/trontstack/froxel/index.html',ready:()=>!!window.FroxelUI,canvas:'canvas',setup:async p=>{await p.evaluate(()=>{FROXEL.state.clean=true;FROXEL.state.paused=false;});await p.waitForTimeout(1000);},telemetry:()=>({time:FROXEL.state.time,paused:FROXEL.state.paused})},
  ltc:{url:'/capture/ltc/',source:'C:/trontstack/ltc/index.html',ready:()=>window.__LTC?.ready&&__LTC.frameCount>3,canvas:'#viewport>canvas',setup:async p=>{await p.evaluate(()=>{__LTC.setParam('quality',1);if(__LTC.state.frozen)__LTC.toggleFreeze();if(!__LTC.state.photo)__LTC.togglePhoto();__LTC.sceneSecondary();});await p.waitForTimeout(700);},telemetry:()=>({frames:__LTC.frameCount,scene:__LTC.state.scene,sweep:__LTC.v5.sweep})},
  'aqua-empire':{url:'/capture/aqua-empire/aqua_empire_v2_5.html',source:'C:/trontstack/aqua-empire/aqua_empire_v2_5.html',ready:()=>!!window.AQUAQA&&document.getElementById('boot').hidden,canvas:'canvas',setup:async p=>{await p.evaluate(()=>{AQUAQA.setManual(true);AQUAQA.start(0,0);AQUAQA.addMoney(4000);for(let i=0;i<12;i++)AQUAQA.buy('guppy');AQUAQA.advance(3);AQUAQA.setManual(false);});await p.waitForTimeout(500);},action:async p=>{for(let i=0;i<8;i++){await p.evaluate(i=>AQUAQA.feed(-4+i*1.1,3),i);await p.waitForTimeout(420);}},telemetry:()=>AQUAQA.summary()},
  slopeloop:{url:'/capture/slopeloop/?pilot&seed=240915',source:'C:/trontstack/slopeloop/dist/index.html',ready:()=>window.slopeloop?.ready&&slopeloop.status().pending===0,canvas:'canvas',setup:async p=>{await p.evaluate(()=>{slopeloop.setClean(true);slopeloop.setPilot(true);slopeloop.start();});await p.waitForTimeout(2000);},telemetry:()=>slopeloop.status()},
  ringriot:{url:'/capture/ringriot/RING_RIOT.html',source:'C:/trontstack/ringriot/dist/RING_RIOT.html',ready:()=>!!window.ARENA_READY,canvas:'#arena',setup:async p=>{await p.evaluate(()=>{ARENA.sound=false;ARENA_QA.start('sandbox');ARENA.ui.mesh.visible=false;ARENA.ui.fillMesh.visible=false;});await p.waitForTimeout(3000);},action:async p=>{await p.mouse.move(880,350);await p.mouse.down();await p.keyboard.down('KeyD');await p.waitForTimeout(1800);await p.keyboard.up('KeyD');await p.keyboard.down('KeyA');await p.waitForTimeout(1800);await p.keyboard.up('KeyA');await p.mouse.up();},telemetry:()=>({backend:ARENA.backend,adapter:ARENA.adapter,frames:ARENA.frames,snapshot:ARENA_QA.snapshot()})},
  fellswoop:{url:'/capture/fellswoop/',source:'C:/trontstack/fellswoop/index.html',ready:()=>window.__fellswoop?.ready,canvas:'canvas',setup:async p=>{await p.keyboard.press('KeyB');await p.evaluate(()=>{__fellswoop.hud(false);__fellswoop.shotCamera(14,0,0);});await p.waitForTimeout(500);},action:async p=>{for(let i=0;i<30;i++){const q=await p.evaluate(i=>__fellswoop.screen(Math.cos(i*.17)*3.6,Math.sin(i*.17)*2.3),i);await p.mouse.move(q.x,q.y);await p.waitForTimeout(150);}},telemetry:()=>__fellswoop.snapshot()},
  inkride:{url:'/capture/inkride/#solo',source:'C:/trontstack/inkride/index.html',ready:()=>!!window.INKRIDE,canvas:'canvas',setup:async p=>{await p.waitForTimeout(700);await p.evaluate(()=>{document.getElementById('rideBtn').click();const f=document.getElementById('followBtn');if(f&&!/on/i.test(f.textContent))f.click();});},telemetry:()=>({time:INKRIDE.physicsTime,riders:INKRIDE.riders.map(r=>({state:r.state,air:r.air}))})},
  tinytreads:{url:'/capture/tinytreads/',source:'C:/trontstack/tinytreads/index.html',ready:()=>!!window.POCKET,canvas:'#field',setup:async p=>{await p.evaluate(()=>{POCKET.settings.sound=false;POCKET.startPractice();POCKET.setWeapon('Pineapple');POCKET.autoAim();});await p.waitForTimeout(600);},action:async p=>{await p.waitForTimeout(300);const fired=await p.evaluate(()=>POCKET.fire());if(!fired)throw Error('Shot did not fire');},telemetry:()=>({version:POCKET.version,state:POCKET.state})},
  breakmass:{url:'/capture/breakmass/',source:path.join(root,'.local/sources/breakmass/index.html'),ready:()=>window.BREAKMASS?.ready&&window.BREAKMASS_BOOT.stage==='ready',canvas:'canvas',setup:async p=>{await p.evaluate(()=>{BREAKMASS.focusExperiment('tank');BREAKMASS_UI.close();});await p.waitForTimeout(1000);},action:async p=>{await p.waitForTimeout(600);await p.evaluate(()=>BREAKMASS.fireRocket());await p.waitForTimeout(1600);await p.evaluate(()=>BREAKMASS.bombRain());},telemetry:()=>({runtime:BREAKMASS.runtimeInfo(),stats:BREAKMASS.stats,rocket:BREAKMASS.rocketDiagnostics})},
};
// Per-game setup stays with the recorder; no game source or user save is edited.
const publicSpec=(slug,options)=>({url:'/capture/'+slug+'/?room=local-gallery#solo=1',source:path.join(root,'.local/sources',slug,'index.html'),publicBuild:true,canvas:'canvas',setup:async p=>p.waitForTimeout(800),telemetry:()=>({frames:window.__frames,time:performance.now()}),...options});
Object.assign(specs,{
 gemstogether:publicSpec('gemstogether',{ready:()=>window.__jewel?.ready&&__jewel.app.phase==='idle',canvas:'#scene',action:async p=>{for(let i=0;i<25;i++){await p.evaluate(()=>{const j=__jewel,a=j.app;if(a.phase==='idle'){const moves=a.board.legalMoves(),m=moves[(a.board.moves*7)%moves.length];if(m)j.swap(...m);}});await p.waitForTimeout(230);}},telemetry:()=>({phase:__jewel.app.phase,time:__jewel.app.time,moves:__jewel.app.board.moves,score:__jewel.app.board.score})}),
 voxelheroes:publicSpec('voxelheroes',{ready:()=>!!window.__voxelHeroes,setup:async p=>{await p.evaluate(()=>{const h=__voxelHeroes;h.game.progress.startNewGame({name:'Tront',class:'balanced',prologue:false});h.setManual(false);});await p.waitForTimeout(1200);await p.evaluate(()=>__voxelHeroes.teleport('rook-den:0,2',8.5,7.5));await p.waitForTimeout(700);},action:async p=>{await p.keyboard.down('Space');await p.keyboard.down('ArrowRight');await p.waitForTimeout(1200);await p.keyboard.up('ArrowRight');await p.keyboard.down('ArrowLeft');await p.waitForTimeout(1600);await p.keyboard.up('ArrowLeft');await p.keyboard.up('Space');},telemetry:()=>({mode:__voxelHeroes.state.mode,hp:__voxelHeroes.state.hp,x:__voxelHeroes.player.x,z:__voxelHeroes.player.z})}),
 smear:publicSpec('smear',{ready:()=>!!window.__smearComputeReady,canvas:'#world',setup:async p=>{await p.evaluate(()=>{__smear.reset();__smear.demo();__smear.manual(false);});await p.waitForTimeout(500);},telemetry:()=>__smear.compute.state()}),
 deadends:publicSpec('deadends',{ready:()=>!!window.DEAD_ENDS,canvas:'#game',setup:async p=>{await p.evaluate(()=>{DEAD_ENDS.start();DEAD_ENDS.setInvincible(true);});await p.waitForTimeout(600);},action:async p=>{await p.evaluate(()=>DEAD_ENDS.press('w',true));for(let i=0;i<25;i++){await p.evaluate(()=>{const s=DEAD_ENDS.state,p=s.players[s.localSlot],z=s.zombies.filter(z=>!z.dead).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];if(z){DEAD_ENDS.aimAt(z.x,z.y);DEAD_ENDS.shoot(true);}});await p.waitForTimeout(240);}await p.evaluate(()=>{DEAD_ENDS.press('w',false);DEAD_ENDS.shoot(false);});},telemetry:()=>({phase:DEAD_ENDS.state.phase,elapsed:DEAD_ENDS.state.elapsed,stats:DEAD_ENDS.state.stats,players:DEAD_ENDS.state.players.map(p=>({x:p.x,y:p.y,hp:p.hp})),zombies:DEAD_ENDS.state.zombies.length})}),
 buttloads2:publicSpec('buttloads2',{ready:()=>window.__buttloads?.ready,canvas:'#view',setup:async p=>{await p.evaluate(()=>{__buttloads.play();__buttloads.player.pitch=-.8;});await p.waitForTimeout(700);},action:async p=>{await p.evaluate(()=>{__buttloads.input.fire=true;__buttloads.input.keys.add('KeyW');});await p.waitForTimeout(2400);await p.evaluate(()=>__buttloads.input.keys.delete('KeyW'));await p.waitForTimeout(2500);await p.evaluate(()=>__buttloads.input.fire=false);},telemetry:()=>({running:__buttloads.running,player:{x:__buttloads.player.x,y:__buttloads.player.y,z:__buttloads.player.z},world:__buttloads.world.revision})}),
 vixels:publicSpec('vixels',{ready:()=>window.VIXELS?.ready,canvas:'#view',setup:async p=>{await p.evaluate(()=>{VIXELS.setMode('chunk');VIXELS.fit();});await p.waitForTimeout(500);},action:async p=>{const r=await p.locator('#view').boundingBox();await p.mouse.move(r.x+r.width*.55,r.y+r.height*.48);await p.mouse.down();for(let i=0;i<80;i++){await p.mouse.move(r.x+r.width*.55+i*2,r.y+r.height*.48+Math.sin(i/35)*40);await p.waitForTimeout(55);}await p.mouse.up();},telemetry:()=>({state:VIXELS.state,camera:VIXELS.camera})}),
 tinyrise:publicSpec('tinyrise',{ready:()=>window.tinyrise?.ready,canvas:'#view',setup:async p=>{await p.evaluate(()=>{tinyrise.city.overview();tinyrise.ui.setFocusMode(true);});await p.waitForTimeout(1000);},action:async p=>{await p.mouse.move(620,350);await p.mouse.down({button:'right'});for(let i=0;i<80;i++){await p.mouse.move(620+i*1.5,350);await p.waitForTimeout(60);}await p.mouse.up({button:'right'});},telemetry:()=>tinyrise.stats()}),
 terrainlab:publicSpec('terrainlab',{ready:()=>!!window.__surfaceWorld&&!!window.__earthworks,canvas:'#scene',setup:async p=>p.waitForTimeout(4000),action:async p=>{await p.mouse.move(640,350);await p.mouse.down();for(let i=0;i<35;i++){await p.mouse.move(590+i*3,350+Math.sin(i*.1)*50);await p.waitForTimeout(140);}await p.mouse.up();},telemetry:()=>__earthworks.report()}),
 ballpit:publicSpec('ballpit',{ready:()=>!!window.__ballpit,setup:async p=>p.waitForTimeout(2500),action:async p=>{await p.keyboard.press('KeyR');await p.mouse.move(640,500);await p.mouse.down();for(let i=0;i<50;i++){await p.mouse.move(640+Math.cos(i*.10)*260,430+Math.sin(i*.10)*110);await p.waitForTimeout(90);}await p.mouse.up();}}),
 asciicity:publicSpec('asciicity',{ready:()=>document.querySelector('canvas')?.width>500,setup:async p=>{await p.waitForTimeout(3000);await p.keyboard.press('Digit2');},action:async p=>{await p.keyboard.down('KeyW');await p.waitForTimeout(5500);await p.keyboard.up('KeyW');}}),
 critters:publicSpec('critters',{ready:()=>!!window.CRITTERS,setup:async p=>p.waitForTimeout(3500),action:async p=>{await p.mouse.move(620,400);await p.mouse.down();for(let i=0;i<70;i++){await p.mouse.move(620+i*2,400);await p.waitForTimeout(70);}await p.mouse.up();}}),
});
const canvasReady=()=>[...document.querySelectorAll('canvas')].some(c=>c.width>500&&c.height>250);
const sweep=async p=>{await p.mouse.move(600,350);await p.mouse.down();for(let i=0;i<65;i++){await p.mouse.move(640+Math.sin(i*.09)*220,380+Math.cos(i*.12)*100);await p.waitForTimeout(75);}await p.mouse.up();};
for(const slug of ['vibesand','vibewater','vibeduders','vibevoxelprobes','quantumvibes','vibestar','vibebounce','vibecar','vibespace','vibepong','threejs-volumetric-beam']){
 specs[slug]=publicSpec(slug,{ready:canvasReady,setup:async p=>{await p.evaluate(()=>{for(const id of ['infoToggleButton','infoButton','toggle-description','toggle-controls','toggle-debug']){const b=document.getElementById(id);if(b&&/^Hide/.test(b.textContent))b.click();}});await p.waitForTimeout(slug==='vibepong'?3500:1800);}});
}
for(const slug of ['vibesand','vibewater','vibeduders'])specs[slug].action=sweep;
specs.vibecar.action=async p=>{await p.keyboard.down('KeyW');await p.waitForTimeout(1800);await p.keyboard.down('KeyD');await p.waitForTimeout(1200);await p.keyboard.up('KeyD');await p.waitForTimeout(1800);await p.keyboard.up('KeyW');};
specs.vibecraft=publicSpec('vibecraft',{ready:canvasReady,setup:async p=>{await p.evaluate(()=>{Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.body});document.dispatchEvent(new Event('pointerlockchange'));});await p.waitForTimeout(500);},action:async p=>{await p.keyboard.down('KeyW');await p.keyboard.down('Space');await p.waitForTimeout(5000);await p.keyboard.up('KeyW');await p.keyboard.up('Space');}});
specs.pachinko=publicSpec('pachinko',{ready:canvasReady,canvas:'#gameCanvas',action:async p=>{const r=await p.locator('#gameCanvas').boundingBox();for(let i=0;i<10;i++){await p.mouse.click(r.x+r.width*(.3+i%5*.1),r.y+45);await p.waitForTimeout(480);}}});
specs.spheres=publicSpec('spheres',{ready:canvasReady,canvas:'#webgl-preview',setup:async p=>{await p.locator('#webgl-preview').scrollIntoViewIfNeeded();await p.waitForTimeout(600);},action:sweep});
specs.sudoku=publicSpec('sudoku',{ready:canvasReady,action:async p=>{for(let i=0;i<6;i++){await p.mouse.click(320+i*65,230+i%3*60);await p.keyboard.press(String(i+1));await p.waitForTimeout(700);}}});
const domStyle='header,nav,footer,h1,.tront-about,.footer-links,.explanation-box,.author-card,.implementations-section{display:none!important}body{overflow:hidden!important}';
for(const slug of ['lerp','vibebeats','vibeprime','wolfenstein','vibemaze','shortpath']){
 specs[slug]=publicSpec(slug,{dom:true,ready:()=>document.readyState==='complete',setup:async p=>{await p.addStyleTag({content:domStyle});await p.waitForTimeout(500);}});
}
specs.vibebeats.action=async p=>{await p.locator('#play-stop-btn').click();await p.waitForTimeout(5800);};
specs.vibeprime.setup=async p=>{await p.addStyleTag({content:domStyle+'.info-section,.links{display:none!important}'});await p.locator('#start-btn').click();};
specs.vibeprime.action=async p=>{for(let i=0;i<32;i++){await p.locator('#step-btn').click();await p.waitForTimeout(150);}};
for(const s of ['wolfenstein','vibemaze']){
 specs[s].setup=async p=>{await p.addStyleTag({content:domStyle+'h2,.info-box,#pointerLockMessage,#gameMessages{display:none!important}body{margin:0!important;min-height:100vh;display:flex;align-items:center;justify-content:center}#gameContainer{margin:0!important}#gameScreen{transform:scale(1.25);transform-origin:center}'});await p.waitForTimeout(500);};
 specs[s].action=async p=>{await p.keyboard.down('KeyW');await p.waitForTimeout(1800);await p.keyboard.up('KeyW');await p.keyboard.down('ArrowRight');await p.waitForTimeout(900);await p.keyboard.up('ArrowRight');await p.keyboard.down('KeyD');await p.waitForTimeout(2200);await p.keyboard.up('KeyD');};
}
specs.shortpath.setup=async p=>{await p.addStyleTag({content:domStyle+'.controls-info-panel,.comparison-sim-section,h2{display:none!important}.visualization-panel{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important}#grid-svg{width:100%;height:100%}'});};
specs.shortpath.action=async p=>{await p.evaluate(()=>document.getElementById('runAllBtn').click());await p.waitForTimeout(5700);};
specs.buddy.action=async p=>{
 await p.evaluate(()=>{const n=__buddy.state.n[0];__buddy.input({x:n[1],y:n[2],down:true,tool:'grab'});});
 for(let i=0;i<36;i++){await p.evaluate(i=>__buddy.input({x:640+Math.sin(i*.12)*260,y:330-Math.sin(i*.065)*160,down:true,tool:'grab'}),i);await p.waitForTimeout(65);}
 await p.evaluate(()=>__buddy.input({down:false}));await p.waitForTimeout(800);
 for(let i=0;i<3;i++){await p.evaluate(()=>{const n=__buddy.state.n[0];__buddy.input({x:n[1],y:n[2],down:true,tool:'poke'});});await p.waitForTimeout(320);await p.evaluate(()=>__buddy.input({down:false}));await p.waitForTimeout(350);}
};
specs.buttloads2.setup=async p=>{await p.evaluate(()=>{const b=__buttloads;b.play();b.player.pitch=-.8;b.view.gameUI.render=()=>{};});await p.waitForTimeout(700);};
specs.smear.setup=async p=>{await p.evaluate(()=>{__smear.reset();__smear.demo();__smear.manual(false);__smear.view([3.8,2.8,4.6],[-1,.8,-2]);});await p.waitForTimeout(500);};
specs.biomass=publicSpec('biomass',{url:'/capture/biomass/?map=0&autoplay=1&speed=2&zombies=100000',ready:canvasReady,setup:async p=>p.waitForTimeout(10000)});
specs.tunnelrat=publicSpec('tunnelrat',{ready:()=>window.TR?.ready,setup:async p=>{await p.evaluate(()=>{TR.debug.god();TR.debug.teleport('reactor');});await p.waitForTimeout(700);},action:async p=>{await p.mouse.move(640,360);await p.mouse.down();await p.keyboard.down('KeyD');await p.waitForTimeout(2500);await p.keyboard.up('KeyD');await p.keyboard.down('KeyA');await p.waitForTimeout(2200);await p.keyboard.up('KeyA');await p.mouse.up();},telemetry:()=>({state:TR.gamestate,position:TR.ship.object3d.position.toArray(),enemies:TR.enemies.list().length})});
specs.campfire=publicSpec('campfire',{ready:()=>!!window.campfire&&window.__frames>10,canvas:'canvas:not(#gpu-text)',setup:async p=>{await p.evaluate(()=>{campfire.zoom(12);campfire.moveTo(-1,4);});await p.waitForTimeout(1800);},action:async p=>{await p.evaluate(()=>{campfire.moveTo(3,3);campfire.hop();});await p.waitForTimeout(1800);await p.evaluate(()=>campfire.moveTo(-3,2));await p.waitForTimeout(2500);await p.evaluate(()=>campfire.wave());},telemetry:()=>({frames:window.__frames,me:campfire.me()})});
for(const [slug,sub] of [['floatingorigin','demo'],['terrainarray','demo'],['jennsfarm','play'],['colony','play'],['megabunk','play'],['craftmine','play']]){
 specs[slug]=publicSpec(slug,{url:'/capture/'+slug+'/'+sub+'/',source:path.join(root,'.local/sources',slug,sub,'index.html'),ready:canvasReady,setup:async p=>p.waitForTimeout(1200)});
}
specs.floatingorigin.setup=async p=>{await p.evaluate(()=>{Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.body});document.dispatchEvent(new Event('pointerlockchange'));});};
specs.floatingorigin.action=async p=>{await p.keyboard.down('KeyW');await p.keyboard.down('Shift');await p.waitForTimeout(5000);await p.keyboard.up('Shift');await p.keyboard.up('KeyW');};
specs.terrainarray.action=async p=>{await p.mouse.move(640,360);await p.mouse.down();for(let i=0;i<70;i++){await p.mouse.move(640+i*2,360+Math.sin(i*.05)*40);await p.waitForTimeout(70);}await p.mouse.up();};
specs.jennsfarm.action=async p=>{await p.keyboard.down('KeyW');await p.waitForTimeout(1500);await p.keyboard.up('KeyW');await p.keyboard.down('KeyD');await p.waitForTimeout(1800);await p.keyboard.up('KeyD');await p.keyboard.press('KeyE');};
specs.colony.ready=()=>!!document.getElementById('btn-sp');
specs.colony.setup=async p=>{await p.locator('#btn-sp').click();await p.waitForFunction(canvasReady);await p.waitForTimeout(2500);};
specs.colony.action=sweep;
specs.craftmine.ready=()=>!!document.getElementById('btn-singleplayer');
specs.craftmine.setup=async p=>{await p.locator('#btn-singleplayer').click();await p.waitForFunction(canvasReady);await p.waitForTimeout(3500);};
specs.craftmine.action=async p=>{await p.keyboard.down('KeyW');await p.waitForTimeout(4300);await p.keyboard.up('KeyW');};
specs.vibebounce.action=async p=>{await p.mouse.click(640,370);await p.waitForTimeout(1300);await p.mouse.click(590,420);await p.waitForTimeout(3600);};
specs.spheres.action=async p=>{for(let i=0;i<4;i++){await p.evaluate(()=>document.getElementById('randomize-btn').click());await p.waitForTimeout(1300);}};
specs.wolfenstein.action=async p=>{await p.keyboard.down('KeyE');await p.waitForTimeout(5000);await p.keyboard.up('KeyE');};
const mazeSetup=specs.vibemaze.setup;
specs.vibemaze.setup=async p=>{await mazeSetup(p);await p.evaluate(()=>{Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.getElementById('gameScreen')});document.dispatchEvent(new Event('pointerlockchange'));});};
specs.vibemaze.action=async p=>{for(let i=0;i<70;i++){await p.evaluate(()=>document.dispatchEvent(new MouseEvent('mousemove',{movementX:5,movementY:0,bubbles:true})));await p.waitForTimeout(75);}};
specs.shortpath.setup=async p=>{await p.addStyleTag({content:'body{overflow:hidden;background:#15171c}body *{visibility:hidden!important}#grid-svg,#grid-svg *{visibility:visible!important}#grid-svg{position:fixed!important;inset:0!important;z-index:2147483647!important;width:100vw!important;height:100vh!important;background:#15171c}'});};
specs.tunnelrat.telemetry=()=>({phase:TR.gamestate.phase,depth:TR.gamestate.depth,position:TR.ship.object3d.position.toArray(),enemies:TR.enemies.list().length});
specs.tunnelrat.action=async p=>{await p.mouse.move(640,360);await p.mouse.down();await p.waitForTimeout(5400);await p.mouse.up();};
specs.vibecraft.setup=async p=>{await p.evaluate(()=>{Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.body});document.dispatchEvent(new Event('pointerlockchange'));document.dispatchEvent(new MouseEvent('mousemove',{movementX:0,movementY:190,bubbles:true}));});await p.waitForTimeout(2200);};
specs.vibecraft.action=async p=>{await p.keyboard.down('KeyW');await p.waitForTimeout(3500);await p.keyboard.up('KeyW');};
specs.megabunk.setup=async p=>{await p.mouse.move(640,350);await p.mouse.down();await p.mouse.move(710,490,{steps:12});await p.mouse.up();await p.mouse.wheel(0,650);await p.waitForTimeout(900);};
specs.megabunk.action=async p=>{await p.keyboard.down('KeyW');await p.waitForTimeout(2300);await p.keyboard.up('KeyW');await p.keyboard.down('KeyD');await p.waitForTimeout(1900);await p.keyboard.up('KeyD');};
specs.asciicity.setup=async p=>{await p.waitForTimeout(2200);await p.evaluate(async()=>{window.__captureCity=await import('./src/player.js');const p=__captureCity.player;p.pos.set(0,1.7,0);p.yaw=-Math.PI/2;p.pitch=.02;});await p.keyboard.press('Digit2');await p.waitForTimeout(800);};
specs.asciicity.action=async p=>{for(let i=0;i<75;i++){await p.evaluate(()=>__captureCity.player.yaw+=.008);await p.waitForTimeout(70);}};
const craftSetup=specs.vibecraft.setup;
specs.vibecraft.setup=async p=>{await craftSetup(p);await p.keyboard.down('Shift');await p.waitForTimeout(250);await p.keyboard.up('Shift');await p.waitForFunction(()=>{const m=document.body.innerText.match(/Sun:\s*(\d+)/);return m&&+m[1]>=15&&+m[1]<30;},null,{timeout:15000});};
specs.megabunk.url='/capture/megabunk/play/portfolio.html';
specs.megabunk.source=path.join(root,'.local/sources/megabunk/play/portfolio.html');
specs.megabunk.setup=async p=>{await p.evaluate(()=>__galleryPhoto.fit());await p.waitForTimeout(600);};
specs.megabunk.action=undefined;
specs.megabunk.telemetry=()=>({camera:__galleryPhoto.camera.position.toArray(),note:'Local photography camera above the running terrain; same game geometry, shaders and animation.'});
specs.craftmine.setup=async p=>{await p.locator('#btn-singleplayer').click();await p.waitForFunction(canvasReady);await p.waitForTimeout(2500);await p.evaluate(()=>{Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.getElementById('game-container')});document.dispatchEvent(new Event('pointerlockchange'));});};
async function record(page,selector,seconds) {
  return page.evaluate(async ({selector,seconds})=>{
    const canvas=[...document.querySelectorAll(selector)].sort((a,b)=>b.width*b.height-a.width*a.height)[0];
    if(!canvas)throw Error('No gameplay canvas');
    const stream=canvas.captureStream(60);
    const mime=['video/mp4;codecs=avc1.64002A','video/mp4','video/webm;codecs=vp8'].find(m=>MediaRecorder.isTypeSupported(m));
    if(!mime)throw Error('No recording codec');
    const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:16000000});
    const chunks=[],frames=[];let start=performance.now(),last=start,active=true;
    const frame=now=>{if(!active)return;frames.push(now-last);last=now;requestAnimationFrame(frame);};
    requestAnimationFrame(frame);
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=e=>reject(Error(e.error?.message||'Recorder error'));});
    recorder.start(500);window.__captureStarted=true;
    await new Promise(r=>setTimeout(r,seconds*1000));recorder.stop();await stopped;active=false;
    stream.getTracks().forEach(t=>t.stop());
    const blob=new Blob(chunks,{type:mime});
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});
    const sorted=frames.slice(2).sort((a,b)=>a-b);
    return {data,mime,width:canvas.width,height:canvas.height,requestedFps:60,wallSeconds:(performance.now()-start)/1000,rafFrames:frames.length,rafP50:sorted[Math.floor(sorted.length*.5)],rafP95:sorted[Math.floor(sorted.length*.95)]};
  },{selector,seconds});
}
async function recordDOM(page,slug,seconds,masterDirectory=out){
 const directory=path.join(root,'.local/dom-frames',slug);fs.mkdirSync(directory,{recursive:true});
 const cdp=await page.context().newCDPSession(page),frames=[];
 cdp.on('Page.screencastFrame',e=>{const file=String(frames.length).padStart(5,'0')+'.jpg';fs.writeFileSync(path.join(directory,file),Buffer.from(e.data,'base64'));frames.push({file,time:e.metadata.timestamp});cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,maxWidth:1280,maxHeight:720,everyNthFrame:1});
 await page.evaluate(()=>window.__captureStarted=true);await page.waitForTimeout(seconds*1000);
 await cdp.send('Page.stopScreencast');await cdp.detach();
 if(frames.length<5)throw Error('Too few DOM capture frames: '+frames.length);
 const list=frames.map((f,i)=>`file '${f.file}'\nduration ${Math.max(.001,(frames[i+1]?.time??(f.time+1/30))-f.time)}`).join('\n');fs.writeFileSync(path.join(directory,'frames.txt'),list);
 const master=path.join(masterDirectory,slug+'.mp4');
 execFileSync('ffmpeg',['-v','error','-nostdin','-y','-f','concat','-safe','0','-i',path.join(directory,'frames.txt'),'-vf','scale=1280:720','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-fps_mode','vfr',master],{windowsHide:true});
 return {masterFile:master,mime:'video/mp4',width:1280,height:720,method:'Chrome screencast with original frame timestamps',capturedFrames:frames.length,wallSeconds:frames.at(-1).time-frames[0].time};
}
module.exports={specs,record,recordDOM,publicSpec};
if(require.main===module)(async()=>{
  const server=createServer();await new Promise(r=>server.listen(8966,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=d3d11','--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  let failures=0;
  try {
    for(const slug of (process.argv.slice(2).length?process.argv.slice(2):Object.keys(specs))) {
      const spec=specs[slug];if(!spec)throw Error('Unknown game '+slug);
      const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
      await context.addInitScript(()=>{Element.prototype.requestPointerLock=()=>Promise.resolve();});
      await context.routeWebSocket('**',ws=>ws.close());
      const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      // Local captures never join public rooms or send analytics.
      await context.route('**/*',route=>{
        const u=new URL(route.request().url());
        if(u.hostname==='127.0.0.1'||u.protocol==='data:'||u.protocol==='blob:')return route.continue();
        // BREAKMASS's version-pinned public libraries are cached locally first.
        if(slug==='breakmass'&&['cdn.jsdelivr.net','unpkg.com'].includes(u.hostname)){
          const cached=path.join(root,'.local/sources/breakmass',path.basename(u.pathname));
          if(fs.existsSync(cached))return route.fulfill({path:cached,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
        }
        return route.abort();
      });
      if(spec.publicBuild)await require('./local-builds.cjs').localBuilds(context);
      try {
        console.log('CAPTURE START',slug);
        await page.goto('http://127.0.0.1:8966'+spec.url,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(spec.ready,null,{timeout:60000});
        const adapter=await page.evaluate(async()=>{const a=await navigator.gpu?.requestAdapter({powerPreference:'high-performance'});return a?{vendor:a.info.vendor,architecture:a.info.architecture,description:a.info.description,isFallbackAdapter:a.info.isFallbackAdapter}:null;});
        await spec.setup(page);await page.screenshot({path:path.join(out,slug+'-setup.png')});
        const before=await page.evaluate(spec.telemetry);
        const recording=spec.dom?recordDOM(page,slug,7):record(page,spec.canvas,7);recording.catch(()=>{});
        await page.waitForFunction(()=>window.__captureStarted);
        if(spec.action)await spec.action(page);
        const result=await recording;
        const ext=result.mime.startsWith('video/mp4')?'mp4':'webm';
        if(!result.masterFile)fs.writeFileSync(path.join(out,slug+'.'+ext),Buffer.from(result.data,'base64'));delete result.data;
        const after=await page.evaluate(spec.telemetry);
        await page.screenshot({path:path.join(out,slug+'-end.png')});
        const receipt={slug,source:spec.source,sha256:crypto.createHash('sha256').update(fs.readFileSync(spec.source)).digest('hex'),capturedUtc:new Date().toISOString(),adapter,recording:result,before,after,errors};
        fs.writeFileSync(path.join(out,slug+'.json'),JSON.stringify(receipt,null,2));
        console.log('CAPTURE COMPLETE',slug,JSON.stringify({adapter,recording:result,errors}));
      }catch(e){failures++;console.error('CAPTURE FAILED',slug,e.stack);await page.screenshot({path:path.join(out,slug+'-failed.png')}).catch(()=>{});}
      finally{await context.close();}
    }
  }finally{await browser.close();await new Promise(r=>server.close(r));}
  process.exitCode=failures?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
