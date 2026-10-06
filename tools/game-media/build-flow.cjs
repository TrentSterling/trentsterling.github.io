// Local capture fixtures. Original game renderers, simulation, and editing paths.
const fs=require('node:fs'),path=require('node:path');
const {takes,run}=require('./takes.cjs');
const {root}=require('./server.cjs');
function copyWithHook(game,needle,hook){
 const dir=path.join(root,'.local/sources',game),original=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 if(!original.includes(needle))throw Error('Capture hook unavailable: '+game);
 const file=path.join(dir,'portfolio-flow.html');fs.writeFileSync(file,original.replace(needle,hook+'\n'+needle));return file;
}
const tiny=copyWithHook('tinyrise','start();\n</script>',`window.__galleryBuild={
 prepare(){
  tinyrise.city.edit();setWorkspace('sculpt');applyPreset('megablock');
  const plan=[];for(let y=0;y<LEVELS;y++)for(let z=0;z<N;z++)for(let x=0;x<N;x++){const material=world.get(x,y,z);if(material)plan.push([x,y,z,material]);}
  this.plan=plan;this.at=0;this.edits=[];this.total=plan.length;
  world.transact(()=>{world.cells.fill(0);world.places=[];world.connections=[];});
  state.sound=false;state.motion=true;state.juicy=true;state.entourage=false;
  rebuild({cancelAnim:true});tinyrise.ui.setFocusMode(true);
  camera.yaw=.76;camera.pitch=.53;camera.target=[0,8,0];camera.span=47;camera.update();needsFrame=true;
 },
 add(){const cells=this.plan.slice(this.at,this.at+12);if(!cells.length)return false;
  const old=buildData;state.time=performance.now()/1000;
  world.transact(()=>{for(const [x,y,z,t] of cells)world.set(x,y,z,t);});
  startSprings('build',cells.map(c=>c.slice(0,3)),old);rebuild({save:false});updateSprings(state.time);needsFrame=true;
  this.at+=cells.length;this.edits.push({time:performance.now(),cells:this.at});return this.at<this.total;
 }};`);
takes['tinyrise-build-up']={game:'tinyrise',url:'/capture/tinyrise/portfolio-flow.html',source:tiny,seconds:20,
 setup:async p=>{await p.evaluate(()=>__galleryBuild.prepare());await p.waitForTimeout(700);},
 action:async p=>{await p.waitForTimeout(500);for(let i=0;i<70;i++){const more=await p.evaluate(()=>__galleryBuild.add());if(!more)break;await p.waitForTimeout(210);}},
 telemetry:()=>({stats:tinyrise.stats(),built:__galleryBuild.at,total:__galleryBuild.total,edits:__galleryBuild.edits,time:performance.now()})};

const beams=copyWithHook('threejs-volumetric-beam','        animate();',`window.__galleryBeams={THREE,scene,camera,controls,renderer,createBeam,actions,beams,globalParams};`);
for(const view of ['wide','detail'])takes['beams-2048-'+view]={game:'threejs-volumetric-beam',url:'/capture/threejs-volumetric-beam/portfolio-flow.html',source:beams,seconds:10,
 ready:()=>!!window.__galleryBeams,
 setup:async p=>{await p.evaluate(view=>{const g=__galleryBeams,T=g.THREE;g.actions.clear();g.scene.fog.density=.007;
  for(let i=0;i<2048;i++){const x=(i%64-31.5)*2.3,z=(Math.floor(i/64)-15.5)*2.3,length=5+Math.sin(i*2.3)*2;
   g.createBeam({pos:new T.Vector3(x,length+.5,z),width:1.7,length,color:new T.Color().setHSL((i%64)/95+Math.floor(i/64)*.013,.65,.6).getHex(),rot:new T.Euler(Math.sin(i)*.12,0,Math.cos(i)*.12)});
  }
  g.controls.enableDamping=false;g.controls.target.set(0,2,0);
  g.camera.position.set(...(view==='wide'?[76,50,83]:[15,10,29]));g.controls.update();g.__angle=Math.atan2(g.camera.position.x,g.camera.position.z);g.__radius=Math.hypot(g.camera.position.x,g.camera.position.z);
 },view);await p.waitForTimeout(1000);},
 action:async p=>{for(let i=0;i<85;i++){await p.evaluate(()=>{const g=__galleryBeams;g.__angle+=.003;g.camera.position.x=Math.sin(g.__angle)*g.__radius;g.camera.position.z=Math.cos(g.__angle)*g.__radius;g.controls.update();});await p.waitForTimeout(95);}},
 telemetry:()=>({lights:__galleryBeams.beams.length,drawCalls:__galleryBeams.renderer.info.render.calls,triangles:__galleryBeams.renderer.info.render.triangles,camera:__galleryBeams.camera.position.toArray()})};

const water=copyWithHook('vibesand','             frame(); // Start the render loop',`window.__galleryWater={camera,uiControls,
 seed(){const data=new Uint32Array(NUM_VOXELS),idx=(x,y,z)=>x+y*128+z*128*128;
  const box=(x0,x1,y0,y1,z0,z1,t)=>{for(let z=z0;z<=z1;z++)for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)data[idx(x,y,z)]=t;};
  // Two stone reservoirs at different elevations. Only initial scene data is set;
  // all subsequent flow uses the unmodified GPU water simulation.
  box(12,46,0,58,25,100,1);
  box(12,55,59,62,25,100,1);box(12,15,63,91,25,100,1);box(52,55,63,91,25,100,1);box(12,55,63,91,25,28,1);box(12,55,63,91,97,100,1);
  box(16,51,63,87,29,96,3);
  box(52,116,21,24,25,100,1);box(52,55,25,44,25,100,1);box(113,116,25,44,25,100,1);box(52,116,25,44,25,28,1);box(52,116,25,44,97,100,1);
  device.queue.writeBuffer(voxelBuffer,0,data);uiControls.simSteps=2;uiControls.sunSpeed=0;sunAngle=.8;isPreviewVisible=false;
  camera.alpha=1.13;camera.beta=.61;camera.radius=150;camera.target=[64,43,64];
  this.events=[];
 },
 cut(point,radius){const u=new Float32Array(computePassUniformsBuffer.size/4),n=new Uint32Array(u.buffer);u[20]=radius;n[21]=1;n[22]=TOOL_DESTROY;
  const t=new Float32Array(8),ti=new Uint32Array(t.buffer);t.set(point);ti[4]=1;
  device.queue.writeBuffer(computePassUniformsBuffer,0,u);device.queue.writeBuffer(targetingOutputBuffer,0,t);
  const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(paintPipeline);pass.setBindGroup(0,paintBindGroup);const d=Math.ceil(radius*2/4);pass.dispatchWorkgroups(d,d,d);pass.end();device.queue.submit([encoder.finish()]);
  this.events.push({point,radius,time:performance.now()});
 },
 async report(){const buffer=device.createBuffer({size:VOXEL_BUFFER_SIZE,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});const e=device.createCommandEncoder();e.copyBufferToBuffer(voxelBuffer,0,buffer,0,VOXEL_BUFFER_SIZE);device.queue.submit([e.finish()]);await buffer.mapAsync(GPUMapMode.READ);
  const a=new Uint32Array(buffer.getMappedRange()),counts={upper:0,falling:0,basin:0,drained:0};for(let i=0;i<a.length;i++)if((a[i]&3)===3){const y=Math.floor(i/128)%128;counts[y>=59?'upper':y>=45?'falling':y>=24?'basin':'drained']++;}buffer.unmap();buffer.destroy();return {frameCount,counts,events:this.events,camera};
 }};`);
takes['vibesand-reservoir']={game:'vibesand',url:'/capture/vibesand/portfolio-flow.html',source:water,canvas:'#webgpu-canvas',seconds:24,
 ready:()=>!!window.__galleryWater,
 setup:async p=>{await p.addStyleTag({content:'#descriptionArea,#controls,#header,.tront-about{display:none!important}#canvas-container{width:100vw!important;height:100vh!important}'});await p.evaluate(()=>__galleryWater.seed());await p.waitForTimeout(700);},
 action:async p=>{await p.waitForTimeout(700);await p.evaluate(()=>__galleryWater.cut([54,70,64],14));await p.waitForTimeout(11000);await p.evaluate(()=>__galleryWater.cut([94,24,70],17));},
 telemetry:()=>__galleryWater.report()};
takes['vibesand-reservoir-close']={...takes['vibesand-reservoir']};

if(require.main===module)run(process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
