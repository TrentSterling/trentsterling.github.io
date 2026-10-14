import {createClimber,canReach,grabHold,physicsStepWorld} from './physics.js';

const canvas=document.querySelector('#wall'),ctx=canvas.getContext('2d');
const message=document.querySelector('#message'),heightText=document.querySelector('#height');
const W=400,H=600,WORLD=1000;
const holds=Array.from({length:27},(_,i)=>({id:i+1,x:152+(i%2)*96+Math.sin(i*.9)*14,y:890-Math.floor(i/2)*57,radius:12}));
let climber,hand='left',camera=400,paused=true,won=false,previous=0,accumulator=0,grabs=0,best=0;
let renderedHolds='';
function say(text){message.textContent=text;}
function selectHand(side){hand=side;for(const key of ['left','right'])document.querySelector('#'+key).setAttribute('aria-pressed',String(side===key));updateChoices();draw();}
function reset(){climber=createClimber(200,970);climber.grips={left:null,right:null};climber.stamina={left:1,right:1};grabHold(climber,holds[0],'left');grabHold(climber,holds[1],'right');camera=400;won=false;grabs=0;best=0;accumulator=0;renderedHolds='';selectHand('left');say('Select a hold to start climbing.');updateStats();draw();}
function isFree(h){return !Object.values(climber.grips).some(g=>g?.hold.id===h.id);}
function reachable(){return holds.filter(h=>isFree(h)&&canReach(climber,h,hand));}
function grab(id){if(won)return;const hold=holds.find(h=>h.id===id);if(!hold||!isFree(hold)||!canReach(climber,hold,hand)){say('That hold is out of reach. Try a ringed hold or switch hands.');return;}
 grabHold(climber,hold,hand);grabs++;best=Math.max(best,(890-hold.y)/50);paused=false;document.querySelector('#pause').textContent='Pause';document.querySelector('#pause').setAttribute('aria-pressed','false');
 if(hold.id===27){won=true;say('Summit reached! '+grabs+' moves. Start again to try another route.');}else{say('Hold '+id+' secured. Move your '+(hand==='left'?'right':'left')+' hand next.');}
 selectHand(hand==='left'?'right':'left');updateStats();}
function updateChoices(){const choices=reachable();const key=hand+':'+choices.map(h=>h.id).join(',')+':'+won;if(key===renderedHolds)return;renderedHolds=key;const container=document.querySelector('#holds');container.replaceChildren();for(const h of choices){const b=document.createElement('button');b.textContent=h.id;b.setAttribute('aria-label','Grab hold '+h.id+' with '+hand+' hand');b.disabled=won;b.onclick=()=>grab(h.id);container.append(b);}if(!choices.length)container.textContent='Switch hands to reach another hold.';}
function updateStats(){heightText.textContent=best.toFixed(1)+' m / 14.8 m';document.querySelector('#grips').textContent=won?'Summit reached':grabs+' moves';}
function draw(){const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==W*dpr){canvas.width=W*dpr;canvas.height=H*dpr;}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#15221d';ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#1c3026';for(let y=-camera%120;y<H;y+=120){ctx.fillRect(0,y,W,1);}ctx.font='11px Consolas,monospace';ctx.fillStyle='#a0b5a5';ctx.textAlign='left';for(let y=900;y>0;y-=100){const sy=y-camera;if(sy>20&&sy<H-20)ctx.fillText(((900-y)/50)+' m',12,sy);}
 for(const h of holds){const y=h.y-camera;if(y< -30||y>H+30)continue;const gripped=Object.values(climber.grips).some(g=>g?.hold.id===h.id),near=canReach(climber,h,hand)&&isFree(h);ctx.beginPath();ctx.arc(h.x,y,h.radius,0,Math.PI*2);ctx.fillStyle=gripped?'#e4c388':h.id===27?'#a8d5b3':near?'#76a68b':'#3c5948';ctx.fill();if(near){ctx.beginPath();ctx.arc(h.x,y,h.radius+5,0,Math.PI*2);ctx.strokeStyle='#b9d9c2';ctx.lineWidth=1.5;ctx.stroke();}ctx.fillStyle=gripped||near||h.id===27?'#15221d':'#d5e3d8';ctx.font='bold 10px Consolas,monospace';ctx.textAlign='center';ctx.fillText(h.id,h.x,y+3);}
 ctx.strokeStyle='#d2e2d7';ctx.lineWidth=3;ctx.lineCap='round';for(const c of climber.constraints){ctx.beginPath();ctx.moveTo(c.a.x,c.a.y-camera);ctx.lineTo(c.b.x,c.b.y-camera);ctx.stroke();}
 for(const [name,p] of Object.entries(climber.nodes)){ctx.beginPath();ctx.arc(p.x,p.y-camera,name==='head'?7:name.endsWith('hand')?5:3,0,Math.PI*2);ctx.fillStyle=name===(hand==='left'?'l_hand':'r_hand')?'#edc17e':'#dbe9df';ctx.fill();}
 if(won){ctx.fillStyle='#e7efe9';ctx.font='bold 20px Segoe UI,sans-serif';ctx.textAlign='center';ctx.fillText('SUMMIT',200,35);}
}
function tick(time){const dt=Math.min((time-previous)/1000,.1);previous=time;if(!paused&&!document.hidden){accumulator+=dt;while(accumulator>=1/60){physicsStepWorld(climber.particles,climber.constraints,W,WORLD);accumulator-=1/60;}const target=Math.max(0,Math.min(WORLD-H,climber.nodes.torso_top.y-H*.48));camera+=(target-camera)*.08;updateChoices();}else{accumulator=0;}draw();requestAnimationFrame(tick);}
canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height+camera;let nearest=null,distance=Infinity;for(const h of holds){const d=Math.hypot(x-h.x,y-h.y);if(d<distance){nearest=h;distance=d;}}if(nearest&&distance<24)grab(nearest.id);});
canvas.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='q'){e.preventDefault();selectHand('left');}if(e.key.toLowerCase()==='e'){e.preventDefault();selectHand('right');}if(e.key.toLowerCase()==='r'){e.preventDefault();reset();}if(e.code==='Space'){e.preventDefault();document.querySelector('#pause').click();}});
for(const side of ['left','right'])document.querySelector('#'+side).onclick=()=>selectHand(side);
document.querySelector('#reset').onclick=reset;
document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'Resume':'Pause';document.querySelector('#pause').setAttribute('aria-pressed',String(paused));say(paused?'Paused. You can still select your next hold.':'Climbing resumed.');};
document.addEventListener('visibilitychange',()=>{accumulator=0;previous=performance.now();});
reset();requestAnimationFrame(tick);
