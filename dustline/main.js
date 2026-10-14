import init,{boot} from './pkg/dustline.js';
const canvas=document.getElementById('world'),keys=new Set(),params=new URLSearchParams(location.search);
const seed=(Number(params.get('seed'))||73421)>>>0,placeKey=`dustline-places-${seed}`;
let game,network,previous=0,netSend=0,audio,osc,gain,drag=false,fire=false,telemetry,lastEvents,noiseBuffer,bestWritten=0;
const frameTimes=[],errors=[];
window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
function resize(){const dpr=Math.min(devicePixelRatio,1.5);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);game?.resize(canvas.width,canvas.height);}
function audioStart(){if(audio)return;audio=new AudioContext();osc=audio.createOscillator();osc.type='sawtooth';const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=340;gain=audio.createGain();gain.gain.value=0;osc.connect(filter).connect(gain).connect(audio.destination);osc.start();}
// Browser audio bridge. Gameplay events and counters are authored by Rust.
function effect(kind){
 if(!audio||audio.state!=='running'||!game)return;
 const now=audio.currentTime,volume=game.volume();if(volume<=0)return;
 const durations={shot:.085,hit:.10,wreck:.65,pulse:.7,pickup:.3,win:1.1},duration=durations[kind]||.2;
 const envelope=audio.createGain();envelope.gain.setValueAtTime(volume*(kind==='shot'?.35:.65),now);envelope.gain.exponentialRampToValueAtTime(.0001,now+duration);envelope.connect(audio.destination);
 if(['shot','wreck','hit','pulse'].includes(kind)){
  if(!noiseBuffer){noiseBuffer=audio.createBuffer(1,audio.sampleRate,audio.sampleRate);let a=noiseBuffer.getChannelData(0),seed=1729;for(let i=0;i<a.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;a[i]=seed/2147483648-1;}}
  const source=audio.createBufferSource(),filter=audio.createBiquadFilter();source.buffer=noiseBuffer;filter.type='lowpass';filter.frequency.setValueAtTime(kind==='shot'?3500:kind==='pulse'?2400:650,now);filter.frequency.exponentialRampToValueAtTime(90,now+duration);source.connect(filter).connect(envelope);source.start(now);source.stop(now+duration);source.onended=()=>{source.disconnect();filter.disconnect();};
 }
 const tone=audio.createOscillator();tone.type=kind==='pickup'||kind==='win'?'sine':'triangle';tone.frequency.setValueAtTime(kind==='pickup'?520:kind==='win'?330:kind==='pulse'?380:110,now);tone.frequency.exponentialRampToValueAtTime(kind==='pickup'?1040:kind==='win'?660:35,now+duration);tone.connect(envelope);tone.start(now);tone.stop(now+duration);tone.onended=()=>{tone.disconnect();envelope.disconnect();};
}
function eventAudio(s){
 if(lastEvents&&s.tick>=lastEvents.tick){
  if(s.shots>lastEvents.shots)effect('shot');
  if(s.raidersDestroyed>lastEvents.raidersDestroyed)effect('wreck');
  if(s.hull<lastEvents.hull)effect('hit');
  if(s.pulses>lastEvents.pulses)effect('pulse');
  if(s.scrapCollected>lastEvents.scrapCollected)effect('pickup');
  if(s.encounter==='Complete'&&lastEvents.encounter!=='Complete')effect('win');
 }
 lastEvents=s;
}
async function join(room){if(!game)return;if(room)game.set_room(room);try{network??=await import('./vendor/network.js');game.set_peer_id(network.selfId);network.connect(game.room()||'global',seed,s=>game.network_status(s));params.set('room',game.room()||'global');params.set('seed',seed);history.replaceState(null,'',`?${params}`);}catch(e){game.network_status(`Connection failed: ${e.message}`);}}
function leave(){network?.disconnect();game.set_remotes('[]');game.network_status('Solo drive. Bots remain available.');params.delete('room');history.replaceState(null,'',`?${params}`);}
async function bridge(action){if(action==='join')await join();if(action==='leave')leave();if(action==='invite'){const url=new URL(location.href);url.searchParams.set('room',game.room()||'global');url.searchParams.set('seed',seed);try{await navigator.clipboard.writeText(url.href);game.network_status('Invite copied.');}catch{game.network_status('Clipboard unavailable; copy the address bar.');}}}
function command(action){if(!game)return;if(action!=='pulse'){keys.clear();fire=false;}bridge(game.command(action));try{localStorage.setItem(placeKey,game.places_json());}catch{}}
const keyCommands={KeyQ:'pulse',KeyN:'new-run',Escape:'menu',KeyV:'swap',KeyF:'recover',KeyE:'eject',KeyB:'bots',KeyM:'mark',KeyC:'chase',KeyO:'showroom',KeyX:'breakup',KeyT:'playback'};
window.addEventListener('keydown',e=>{if(!game)return;if(game.text_key(e.key)){e.preventDefault();return;}if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(keyCommands[e.code]&&!e.repeat){e.preventDefault();command(keyCommands[e.code]);return;}if(game.paused)return;keys.add(e.code);audioStart();});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();fire=false;drag=false;});
document.addEventListener('visibilitychange',()=>{keys.clear();fire=false;previous=0;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.focus();canvas.setPointerCapture(e.pointerId);audioStart();if(!game)return;const r=canvas.getBoundingClientRect();const action=game.ui_click((e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height);if(action){bridge(action);try{localStorage.setItem(placeKey,game.places_json());}catch{}return;}if(game.paused)return;if(e.button===2||e.button===1)drag=true;else fire=true;});
canvas.addEventListener('pointermove',e=>{if(drag){game?.orbit(-e.movementX*.004,0);game?.orbit_pitch(e.movementY*.004);}});
canvas.addEventListener('pointerup',e=>{if(e.button===2||e.button===1)drag=false;else fire=false;});canvas.addEventListener('pointercancel',()=>{drag=false;fire=false;});
canvas.addEventListener('wheel',e=>{e.preventDefault();game?.orbit(0,e.deltaY*.015);},{passive:false});window.addEventListener('resize',resize);
function tick(now){const dt=previous?(now-previous)/1000:1/60;previous=now;frameTimes.push(dt*1000);if(frameTimes.length>600)frameTimes.shift();
  try{if(network)game.set_remotes(JSON.stringify(network.sample()));game.boost=keys.has('ShiftLeft')||keys.has('ShiftRight');game.firing=fire||keys.has('KeyJ');game.drive(Math.min(dt,.1),keys.has('KeyW')||keys.has('ArrowUp'),keys.has('KeyS')||keys.has('ArrowDown'),Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),keys.has('Space'),keys.has('KeyR'));telemetry=JSON.parse(game.telemetry());}
  catch(e){errors.push(String(e));console.error(e);return;}
  eventAudio(telemetry);
  if(telemetry.finalScore>bestWritten){bestWritten=telemetry.finalScore;try{const best=Number(localStorage.getItem('dustline-best-raid')||0);if(bestWritten>best)localStorage.setItem('dustline-best-raid',String(bestWritten));}catch{}}
  if(audio){osc.frequency.setTargetAtTime(30+telemetry.speed*1.2+(telemetry.boosting?35:0),audio.currentTime,.08);gain.gain.setTargetAtTime(game.paused?0:game.volume()*(keys.has('KeyW')?.6:.2),audio.currentTime,.1);}
  if(network&&now-netSend>66){netSend=now;network.send(JSON.parse(game.snapshot()));}requestAnimationFrame(tick);
}
try{if(!navigator.gpu)throw Error('DUSTLINE requires WebGPU.');resize();await init();game=await boot(canvas,seed);try{game.load_places(localStorage.getItem(placeKey)||'[]');game.best_score=Number(localStorage.getItem('dustline-best-raid')||0);}catch{}game.set_room(params.get('room')||'global');
window.dustline={game,errors,frameTimes,command,get telemetry(){return JSON.parse(game.telemetry());},get peers(){return network?.count()||0;},join,leave};canvas.focus();requestAnimationFrame(tick);join();}
catch(e){errors.push(String(e));console.error('DUSTLINE boot failed:',e);}
