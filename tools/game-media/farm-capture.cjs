// Capture the original farm simulation and queued harvesting in an isolated page.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/trontstack/tmp/card-refresh/tools/node_modules/playwright');
const {createServer,root}=require('./server.cjs');
const {record}=require('./capture.cjs');
const {localBuilds}=require('./local-builds.cjs');
const base=path.join(root,'.local/sources/jennsfarm/play');
const out=path.join(root,'.local/takes/jennsfarm');fs.mkdirSync(out,{recursive:true});
const original=fs.readFileSync(path.join(base,'js/main.js'),'utf8');
const hook=`
window.__galleryFarm={G,inventory,enqueueTask,clearTaskQueue,performAction,plantCrop,
  waterTile,updateCrops,getTile,setTileType,TILE,clearWeedsInRadius,allStats,
  snapshot(){const crops=[];for(let z=20;z<28;z++)for(let x=20;x<28;x++){
    const t=getTile(x,z);if(t?.crop)crops.push({x,z,crop:t.crop,stage:t.cropStage});}
    return {crops,inventory:inventory.getAll(),stats:allStats(),player:getPlayerWorldPos(),pending:G.pendingAction,queued:taskQueue.length};}
};
`;
fs.writeFileSync(path.join(base,'js/portfolio-main.js'),original+hook);
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
if(!html.includes('src="js/main.js"'))throw Error('Farm entry point missing');
fs.writeFileSync(path.join(base,'portfolio.html'),html.replace('src="js/main.js"','src="js/portfolio-main.js"'));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources=['main.js','farm.js','player.js','world.js','renderer.js','inventory.js'].map(name=>({name,sha256:sha(path.join(base,'js',name))}));
const modes=process.argv.slice(2);if(modes.some(m=>!['growth','harvest'].includes(m)))throw Error('Expected growth or harvest');

(async()=>{
 const server=createServer();await new Promise(r=>server.listen(8972,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11','--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
 try{for(const mode of (modes.length?modes:['growth','harvest'])){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  await localBuilds(context);const page=await context.newPage(),errors=[];page.on('pageerror',e=>{if(!errors.includes(e.message))errors.push(e.message);});
  try{
   const url='/capture/jennsfarm/play/portfolio.html?noname&noon&camx=23.5&camz=23.5&camh='+(mode==='growth'?13:9)+'&camd='+(mode==='growth'?12:8)+'&campitch=-0.83';
   await page.goto('http://127.0.0.1:8972'+url,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.__galleryFarm);await page.waitForTimeout(1200);
   await page.evaluate(async mode=>{
    const f=__galleryFarm,player=await import('./js/player.js');
    const {scene}=await import('./js/renderer.js');
    // Keep the fog object for the original day/night code, move its band beyond
    // this photography camera instead of using the game's null-fog URL option.
    scene.fog.near=500;scene.fog.far=1000;
    f.G.lastInputAt=performance.now()+120000;f.G.pendingAction=null;f.clearTaskQueue();
    f.clearWeedsInRadius(24,24,20);player.setPlayerPos(23,27);
    const types=['carrot','wheat','tomato','sunflower','lavender','strawberry'];
    for(let z=20;z<=26;z++)for(let x=20;x<=27;x++){
     const tile=f.getTile(x,z);if(!tile)throw Error('Missing farm tile');
     f.setTileType(x,z,f.TILE.SOIL);tile.crop=null;
     // The original planting and water APIs stage a varied planted farm.
     if(z!==23){if(!f.plantCrop(x,z,types[(x-20)%types.length]))throw Error('Planting failed');f.waterTile(tile);}
    }
    if(mode==='harvest')for(let i=0;i<100;i++)f.updateCrops(1);
    window.__farmEvents=[];
   },mode);
   await page.waitForTimeout(400);
   const name='jennsfarm-'+mode,seconds=mode==='growth'?14:13;
   const before=await page.evaluate(()=>__galleryFarm.snapshot());
   await page.screenshot({path:path.join(out,name+'-start.png')});
   const pending=record(page,'#game-container canvas',seconds);pending.catch(()=>{});
   await page.waitForFunction(()=>window.__captureStarted);
   await page.evaluate(mode=>{
    const f=__galleryFarm,start=performance.now();
    window.__farmTimer=setInterval(()=>{
     if(mode==='growth')f.updateCrops(.6); // six additional simulation seconds per second, original crop logic
     f.G.lastInputAt=performance.now();
    },100);
    window.__farmAudit=setInterval(()=>__farmEvents.push({t:(performance.now()-start)/1000,...f.snapshot()}),1000);
    if(mode==='harvest')for(const [x,z] of [[22,26],[23,26],[24,26],[25,26],[26,26],[27,26],[27,25],[26,25],[25,25],[24,25]]){
     f.enqueueTask({x,z,tool:{id:'hand'}});
    }
   },mode);
   const result=await pending;
   await page.evaluate(()=>{clearInterval(__farmTimer);clearInterval(__farmAudit);});
   const after=await page.evaluate(()=>__galleryFarm.snapshot()),events=await page.evaluate(()=>__farmEvents);
   await page.screenshot({path:path.join(out,name+'-end.png')});
   if(errors.length)throw Error(errors.join('\n'));
   if(mode==='growth'&&!after.crops.every(c=>c.stage===3))throw Error('Crops did not finish growing');
   const harvestCount=s=>s.stats.find(row=>row.key==='harvested')?.value||0;
   if(mode==='harvest'&&!(harvestCount(after)>harvestCount(before)))throw Error('No crops harvested');
   const video=Buffer.from(result.data,'base64');delete result.data;
   if(video.length<10000)throw Error('Empty or incomplete farm capture');
   fs.writeFileSync(path.join(out,name+'.mp4'),video);
   fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify({name,game:'jennsfarm',url,source:path.join(base,'js/portfolio-main.js'),sourceSha256:sha(path.join(base,'js/portfolio-main.js')),sourceFiles:sources,capturedUtc:new Date().toISOString(),recording:result,before,after,events,errors,notes:['Original gameplay, rendering and task functions; staging and inspection hooks exist only in the ignored photography copy.','Growth take adds six simulation seconds per second through original updateCrops; harvest take uses normal game time and the original task queue.','Canvas capture omits HTML HUD. The browser context uses an isolated save.']},null,2));
   console.log('COMPLETE',name,JSON.stringify({recording:result,crops:after.crops.length,stats:after.stats,errors}));
  }finally{await context.close();}
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
