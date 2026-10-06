// Staged voxel scenes, followed only by the original simulation and brush shader.
const fs=require('node:fs'),path=require('node:path');
const {takes,run}=require('./takes.cjs');
const {root}=require('./server.cjs');
const dir=path.join(root,'.local/sources/vibesand'),original=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const needle='             frame(); // Start the render loop';
if(!original.includes(needle))throw Error('VibeSand capture export location changed');
const hook=`window.__sandWater={camera,uiControls,events:[],samples:[],
 seed(mode){const data=new Uint32Array(NUM_VOXELS),index=(x,y,z)=>x+y*128+z*16384;
  const cell=(x,y,z,t)=>{if(x>=0&&x<128&&y>=0&&y<128&&z>=0&&z<128)data[index(x,y,z)]=t|(((x*13+y*7+z*3)&7)<<3);};
  const box=(x0,x1,y0,y1,z0,z1,t)=>{for(let z=z0;z<=z1;z++)for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)cell(x,y,z,t);};
  if(mode==='beach'){
   box(7,120,0,4,7,120,1);box(7,120,5,21,7,9,1);box(7,120,5,21,118,120,1);box(7,9,5,21,7,120,1);box(118,120,5,21,7,120,1);
   for(let z=10;z<118;z++)for(let x=10;x<118;x++){const height=Math.round(8+Math.max(0,80-x)*.45+2*Math.sin(z*.07));for(let y=5;y<Math.max(height,14);y++)cell(x,y,z,y<height?2:3);}
   camera.alpha=1.1;camera.beta=.7;camera.radius=152;camera.target=[61,22,65];
  }else{
   // Raised open-top tank, with a thick sand bed beneath its water. The near
   // right wall can be cut to expose the outflow over a receiving basin.
   box(8,120,0,3,12,116,1);box(8,120,4,15,12,14,1);box(8,120,4,15,114,116,1);box(8,10,4,15,12,116,1);box(118,120,4,15,12,116,1);
   const wallTop=mode==='fill'?57:77;
   box(15,77,23,26,26,100,1);box(15,18,27,wallTop,26,100,1);box(74,77,27,wallTop,26,100,1);box(15,77,27,wallTop,26,29,1);box(15,77,27,wallTop,97,100,1);
   box(19,73,27,mode==='fill'?29:38,30,96,2);if(mode!=='fill')box(19,73,39,72,30,96,3);
   camera.alpha=1.02;camera.beta=.58;camera.radius=150;camera.target=[60,37,63];
   if(mode==='fill'){camera.beta=.95;camera.radius=170;camera.target=[55,46,63];}
  }
  // Stage the existing point lights with soft neutral fill. Their original
  // lighting shader remains unchanged; colored rain stays at a lower intensity.
  lights.forEach((light,i)=>{if(i<4){light.position=[i%2?96:32,60,i<2?32:96];light.color=[.12,.12,.12];light.radius=110;light.velocity=0;}else light.color=light.color.map(v=>v*.12);});
  device.queue.writeBuffer(voxelBuffer,0,data);uiControls.simSteps=2;uiControls.sunSpeed=0;sunAngle=.8;isPreviewVisible=false;this.events=[];this.samples=[];this.mode=mode;this.started=performance.now();
 },
 brush(point,radius,type){const u=new Float32Array(computePassUniformsBuffer.size/4),n=new Uint32Array(u.buffer);u[20]=radius;n[21]=1;n[22]=type;
  const t=new Float32Array(8),ti=new Uint32Array(t.buffer);t.set(point);ti[4]=1;device.queue.writeBuffer(computePassUniformsBuffer,0,u);device.queue.writeBuffer(targetingOutputBuffer,0,t);
  const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(paintPipeline);pass.setBindGroup(0,paintBindGroup);const d=Math.ceil(radius*2/4);pass.dispatchWorkgroups(d,d,d);pass.end();device.queue.submit([encoder.finish()]);
  this.events.push({point,radius,type,t:(performance.now()-this.started)/1000});
 },
 async report(){const buffer=device.createBuffer({size:VOXEL_BUFFER_SIZE,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});const e=device.createCommandEncoder();e.copyBufferToBuffer(voxelBuffer,0,buffer,0,VOXEL_BUFFER_SIZE);device.queue.submit([e.finish()]);await buffer.mapAsync(GPUMapMode.READ);
  const a=new Uint32Array(buffer.getMappedRange()),counts={sand:0,water:0,invalid:0,tankSand:0,tankWater:0,fallingSand:0,fallingWater:0,basinSand:0,basinWater:0},bounds={sandY:[128,0],waterY:[128,0]};
  for(let i=0;i<a.length;i++){const type=a[i]&7;if(type>3)counts.invalid++;if(type!==2&&type!==3)continue;const x=i%128,y=Math.floor(i/128)%128,name=type===2?'Sand':'Water',lower=name.toLowerCase();counts[lower]++;bounds[lower+'Y'][0]=Math.min(bounds[lower+'Y'][0],y);bounds[lower+'Y'][1]=Math.max(bounds[lower+'Y'][1],y);if(y>=27&&x<78)counts['tank'+name]++;else if(y>=16)counts['falling'+name]++;else counts['basin'+name]++;}
  buffer.unmap();buffer.destroy();return{t:(performance.now()-this.started)/1000,frameCount,counts,bounds,camera:{...camera}};
 }
};`;
const source=path.join(dir,'portfolio-sand-water-v4.html');fs.writeFileSync(source,original.replace(needle,hook+'\n'+needle));
for(const mode of ['beach','fill','drain'])takes['vibesand-sand-'+mode+'-v4']={game:'vibesand',source,url:'/capture/vibesand/portfolio-sand-water-v4.html',canvas:'#webgpu-canvas',seconds:mode==='drain'?25:18,ready:()=>!!window.__sandWater,
 setup:async p=>{await p.evaluate(mode=>__sandWater.seed(mode),mode);await p.waitForTimeout(350);},
 action:async p=>{
  await p.evaluate(()=>{__sandWater.started=performance.now();});
  const sampler=(async()=>{for(let i=0;i<(mode==='drain'?21:15);i++){await p.waitForTimeout(1000);await p.evaluate(async()=>__sandWater.samples.push(await __sandWater.report()));}})();
  if(mode==='drain'){await p.waitForTimeout(800);await p.evaluate(()=>__sandWater.brush([76,48,78],14,2));await p.waitForTimeout(7500);await p.evaluate(()=>__sandWater.brush([75,33,77],15,2));}
  else {await p.waitForTimeout(800);for(let i=0;i<65;i++){await p.evaluate(({mode,i})=>{const point=mode==='beach'?[27+Math.sin(i*.09)*5,67,66+Math.cos(i*.09)*14]:[42+Math.sin(i*.08)*13,93,63+Math.cos(i*.08)*12];__sandWater.brush(point,mode==='beach'?7:9,0);},{mode,i});await p.waitForTimeout(180);}}
  await sampler;
 },
 telemetry:async()=>({state:await __sandWater.report(),events:__sandWater.events,samples:__sandWater.samples})};
if(require.main===module)run(process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
