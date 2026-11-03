// Browser audio bridge. Sources are decoded once after an explicit user gesture.
export class Sound {
 constructor(){this.ctx=null;this.master=null;this.buffers={};this.loading=null;this.engine=null;this.engineGain=null;this.engineFallback=false;this.failures={};this.voices=new Set();this.last=null;this.lastCash=0;this.paused=true;}
 unlock(){
  if(!this.ctx){this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=0;this.master.connect(this.ctx.destination);}
  if(this.ctx.state!=='running')this.ctx.resume().catch(()=>{});
  if(!this.loading&&Object.keys(this.buffers).length<3)this.loading=Promise.all(Object.entries({engine:'engine',shot:'shot',metal:'metal'}).filter(([key])=>!this.buffers[key]&&(!this.failures[key]||(this.failures[key].count<3&&performance.now()>=this.failures[key].next))).map(async([key,name])=>{
   const controller=new AbortController();let timer;
   try{const decoded=await Promise.race([(async()=>{const response=await fetch(new URL(`./audio/${name}.ogg.b64`,import.meta.url),{signal:controller.signal});if(!response.ok)throw Error(`${response.status}`);const encoded=await response.text();const binary=atob(encoded.trim()),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return this.ctx.decodeAudioData(bytes.buffer);})(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('audio load timed out'));},8000);})]);this.buffers[key]=decoded;}catch(e){const count=(this.failures[key]?.count||0)+1;this.failures[key]={count,next:performance.now()+(count===1?1000:5000)};console.warn(`Audio ${key} unavailable`,e);}finally{clearTimeout(timer);}
  })).finally(()=>{this.loading=null;});
 }
 stopVoices(){for(const voice of [...this.voices]){try{voice.stop();}catch{} voice.disconnect();this.voices.delete(voice);}}
 effect(kind){
  if(!this.ctx||this.ctx.state!=='running'||this.paused||this.voices.size>=12)return;
  if(!this.buffers[kind]){this.fallback(kind);return;}
  const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=this.buffers[kind];s.playbackRate.value=kind==='shot'?.95+Math.random()*.1:.85+Math.random()*.3;g.gain.value=kind==='shot'?.12:.10;s.connect(g).connect(this.master);this.voices.add(s);s.onended=()=>{s.disconnect();g.disconnect();this.voices.delete(s);};s.start();
 }
 fallback(kind){
  if(!this.ctx||this.ctx.state!=='running'||this.paused||this.voices.size>=12)return;
  const now=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain(),duration=kind==='shot'?.09:.6;o.type=kind==='win'?'sine':'triangle';o.frequency.setValueAtTime(kind==='win'?330:kind==='shot'?700:kind==='metal'?160:380,now);o.frequency.exponentialRampToValueAtTime(kind==='win'?660:35,now+duration);g.gain.setValueAtTime(.10,now);g.gain.exponentialRampToValueAtTime(.0001,now+duration);o.connect(g).connect(this.master);this.voices.add(o);o.onended=()=>{o.disconnect();g.disconnect();this.voices.delete(o);};o.start(now);o.stop(now+duration);
 }
 update(s,volume,paused,throttle){
  if(!this.ctx)return;const now=this.ctx.currentTime;this.paused=paused||document.hidden;
  this.master.gain.setTargetAtTime(this.paused?0:Math.max(0,Math.min(1,volume))*.55,now,.03);
  if(this.paused){this.stopVoices();if(this.engine){try{this.engine.stop();}catch{}this.engine.disconnect();this.engine=null;this.engineGain=null;}}
  else if(this.ctx.state==='running'){
   if(this.engine&&this.engineFallback&&this.buffers.engine){try{this.engine.stop();}catch{}this.engine.disconnect();this.engine=null;this.engineGain=null;}
   if(!this.engine){const recorded=!!this.buffers.engine,e=recorded?this.ctx.createBufferSource():this.ctx.createOscillator(),g=this.ctx.createGain();if(recorded){e.buffer=this.buffers.engine;e.loop=true;}else e.type='sawtooth';g.gain.value=recorded?.14:.025;e.connect(g).connect(this.master);e.onended=()=>{e.disconnect();g.disconnect();};e.start();this.engine=e;this.engineGain=g;this.engineFallback=!recorded;}
   this.engineGain.gain.setTargetAtTime(this.engineFallback?(throttle?.025:.012):(throttle?.14:.08),now,.12);
   if(this.engineFallback)this.engine.frequency.setTargetAtTime(30+s.speed*1.2+(s.boosting?35:0),now,.12);
   else this.engine.playbackRate.setTargetAtTime(Math.max(.65,Math.min(1.65,.75+s.speed*.015+(s.boosting?.18:0)+(throttle?.08:0))),now,.12);
  }
  if(this.last&&s.tick>=this.last.tick&&!this.paused){
   const fire=(n,k)=>{for(let i=0;i<Math.min(4,Math.max(0,n));i++)this.effect(k);};
   fire(s.shots-this.last.shots,'shot');fire(s.raidersDestroyed-this.last.raidersDestroyed,'metal');if(s.hull<this.last.hull)this.effect('metal');
   // A physical metal sound is a temporary pickup cue; no fabricated zombie events.
   fire(s.scrapCollected-this.last.scrapCollected,'metal');for(let i=0;i<Math.min(4,Math.max(0,s.pulses-this.last.pulses));i++)this.fallback('pulse');for(let i=0;i<Math.min(4,Math.max(0,s.contractWins-this.last.contractWins));i++)this.fallback('win');if(s.lifetimeEarned>this.last.lifetimeEarned&&now-this.lastCash>.16){this.effect('metal');this.lastCash=now;}
  }
  this.last=s;
 }
}
