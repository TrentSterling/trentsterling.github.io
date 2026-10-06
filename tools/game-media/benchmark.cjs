// Controlled local comparison, in a separate browser instance per case.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {chromium}=require('C:/trontstack/tmp/card-refresh/tools/node_modules/playwright');
const {createServer,root}=require('./server.cjs');
const rows=JSON.parse(fs.readFileSync(path.join(root,'.local/media-manifest.json'))).filter(r=>/\.gif$/i.test(r.original));
const bench=path.join(root,'.local/benchmark');fs.mkdirSync(bench,{recursive:true});
fs.writeFileSync(path.join(bench,'index.html'),'<!doctype html><title>Local media benchmark</title>');
const url=p=>'/'+p.replaceAll('\\','/');
for(const r of rows){
 const file=path.join(bench,path.basename(r.video).replace('.mp4','.gif'));
 if(!fs.existsSync(file)){
  const p=spawnSync('ffmpeg',['-v','error','-nostdin','-y','-i',path.join(root,r.video),'-filter_complex','split[a][b];[a]palettegen[p];[b][p]paletteuse','-loop','0',file],{windowsHide:true,encoding:'utf8'});if(p.status)throw Error(p.stderr);
 }
 r.matched=url(path.relative(root,file));
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(8969,'127.0.0.1',r));const results=[];
 try{for(const mode of ['poster','mp4','original-gif','matched-gif','mp4','matched-gif','original-gif']){
  const b=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  try{
   const c=await b.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1}),p=await c.newPage(),cdp=await b.newBrowserCDPSession();
   console.log('BENCH START',mode);
   await p.goto('http://127.0.0.1:8969/.local/benchmark/');
   await p.setContent('<style>body{margin:0;background:#15171c;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}img,video{width:100%;height:260px;object-fit:contain;background:#08090a}</style>'+rows.map(r=>mode==='mp4'?`<video src="${r.video}" muted autoplay playsinline loop></video>`:`<img src="${mode==='poster'?r.poster:mode==='matched-gif'?r.matched:r.original}">`).join(''));
   await p.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode()));await Promise.all([...document.querySelectorAll('video')].map(v=>{v.muted=true;return v.play();}));});
   await delay(6000);
   const before=await cdp.send('SystemInfo.getProcessInfo');
   const start=performance.now();
   await p.evaluate(()=>{window.sample=[];let last=performance.now();window.running=true;function tick(t){if(!window.running)return;sample.push(t-last);last=t;requestAnimationFrame(tick);}requestAnimationFrame(tick);window.vbefore=[...document.querySelectorAll('video')].map(v=>v.getVideoPlaybackQuality());});
   await delay(16000);
   const after=await cdp.send('SystemInfo.getProcessInfo'),duration=(performance.now()-start)/1000;
   const page=await p.evaluate(()=>{window.running=false;const x=sample.slice(2).sort((a,b)=>a-b),vs=[...document.querySelectorAll('video')];return {rafFrames:x.length,rafP50:x[Math.floor(x.length*.5)],rafP95:x[Math.floor(x.length*.95)],rafOver50ms:x.filter(n=>n>50).length,videoFrames:vs.map((v,i)=>{const q=v.getVideoPlaybackQuality(),b=vbefore[i];return {total:q.totalVideoFrames-b.totalVideoFrames,dropped:q.droppedVideoFrames-b.droppedVideoFrames,paused:v.paused};})};});
   const cpu={};for(const a of after.processInfo){const old=before.processInfo.find(v=>v.id===a.id);cpu[a.type]=(cpu[a.type]||0)+Math.max(0,a.cpuTime-(old?.cpuTime||a.cpuTime));}
   const ids=after.processInfo.map(v=>v.id).filter(Number.isInteger);
   const memory=spawnSync('powershell',['-NoProfile','-Command',`Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Measure-Object -Property PrivateMemorySize64 -Sum | Select-Object -ExpandProperty Sum`],{windowsHide:true,encoding:'utf8'});
   const result={mode,clips:rows.length,seconds:duration,cpuSeconds:cpu,totalCpuSeconds:Object.values(cpu).reduce((a,b)=>a+b,0),cpuPercentOneCore:Object.values(cpu).reduce((a,b)=>a+b,0)/duration*100,privateMemoryMiB:Number(memory.stdout.trim())/1048576,...page};results.push(result);console.log('BENCH',JSON.stringify(result));
  }finally{await b.close();}
 }}finally{fs.writeFileSync(path.join(root,'.local/playback-benchmark.json'),JSON.stringify({date:new Date().toISOString(),environment:'Windows Chrome headless, RTX 5070 Ti, 1920x1080, 11 visible cards; 6s warmup, 16s sample. CPU covers browser/renderer/GPU-process CPU, not GPU execution time. matched-gif encodes the exact MP4 frames at the same resolution and cadence. Original GIFs retain their original resolution, duration and cadence.',results},null,2));await new Promise(r=>server.close(r));}
})();
