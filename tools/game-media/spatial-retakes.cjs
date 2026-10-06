// Photography for the original spatial demos, using their normal movement/ray code.
const fs=require('node:fs'),path=require('node:path');
const {takes,run}=require('./takes.cjs');
const {specs}=require('./capture.cjs');
const {root}=require('./server.cjs');
const bounceOriginal=path.join(root,'.local/sources/vibebounce/index.html');
const bounceCopy=path.join(path.dirname(bounceOriginal),'portfolio-action.html');
const original=fs.readFileSync(bounceOriginal,'utf8'),needle='        init();';
if(original.split(needle).length!==2)throw Error('Ambiguous VibeBounce export');
const hook=`window.__bounceCapture={
 camera:()=>camera,controls:()=>controls,
 neutralVertexColors:()=>{if(!voxelGeometry.getAttribute('color')){const colors=new Float32Array(voxelGeometry.getAttribute('position').count*3).fill(1);voxelGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));voxelInstancedMesh.material.needsUpdate=true;}},
 probe:(x,y)=>{const rect=renderer.domElement.getBoundingClientRect();const mouse=new THREE.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);const h=raycastSVO(raycaster.ray,camera.far);return {hit:h.hit,point:h.point?.toArray(),normal:h.normal?.toArray()};},
 state:()=>({at:performance.now(),ready:!!voxelInstancedMesh,voxels:voxelInstancedMesh?.count,geometryColor:!!voxelGeometry?.getAttribute('color'),materialVertexColors:voxelInstancedMesh?.material.vertexColors,instanceColorSample:voxelInstancedMesh?.instanceColor?Array.from(voxelInstancedMesh.instanceColor.array.slice(0,12)):[],origin:simulationOrigin?.toArray(),camera:camera?.position.toArray(),target:controls?.target.toArray(),params:{...params},rayVertices:simulationLines.map(l=>l.line.geometry.attributes.position.count),exampleReflections:simulationLines.filter(l=>l.line.geometry.attributes.position.count>2).slice(0,3).map(l=>Array.from(l.line.geometry.attributes.position.array))})
};`;
fs.writeFileSync(bounceCopy,original.replace(needle,hook+'\n'+needle));
const bounce={game:'vibebounce',url:'/capture/vibebounce/portfolio-action.html',source:bounceCopy,ready:()=>window.__bounceCapture?.state().ready,seconds:14};
async function sample(p,getState,seconds){
 await p.evaluate(()=>{window.__spatialSamples=[];window.__spatialStart=performance.now();});
 const start=Date.now();while(Date.now()-start<seconds*1000){await p.evaluate(getState);await p.waitForTimeout(120);}
}
for(const mode of ['overview','chamber','well'])takes['vibebounce-'+mode]={...bounce,
 setup:async p=>{await specs.vibebounce.setup(p);await p.evaluate(mode=>{const b=__bounceCapture;window.__bounceUncorrected=b.state();b.neutralVertexColors();const poses={overview:[[22,29,25],[0,7,0]],chamber:[[0,4,3],[0,3,-5]],well:[[4,25,7],[0,7,0]]};const [eye,target]=poses[mode];b.camera().position.set(...eye);b.camera().fov=mode==='chamber'?75:60;b.camera().updateProjectionMatrix();b.controls().target.set(...target);b.controls().update();
 for(const [id,value] of [['ctrl-rays','70'],['ctrl-ray-dist','30'],['ctrl-line-life','1100']]){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}
 window.__spatialSamples=[];window.__bounceClicks=[];},mode);await p.waitForTimeout(400);},
 action:async p=>{const collecting=sample(p,()=>__spatialSamples.push({t:(performance.now()-__spatialStart)/1000,...__bounceCapture.state()}),12.5);
   for(const target of [[520,330],[750,420],[600,480]]){const q=await p.evaluate(([tx,ty])=>{const choices=[];for(let y=180;y<600;y+=35)for(let x=250;x<1040;x+=35){const h=__bounceCapture.probe(x,y);if(h.hit)choices.push({x,y,...h,d:(x-tx)**2+(y-ty)**2});}choices.sort((a,b)=>a.d-b.d);if(!choices.length)throw Error('No voxel surface available for a real click');const q=choices[0];__bounceClicks.push({t:(performance.now()-__spatialStart)/1000,...q});return q;},target);await p.mouse.click(q.x,q.y);await p.waitForTimeout(3400);}await collecting;},
 telemetry:()=>({uncorrected:window.__bounceUncorrected,state:__bounceCapture.state(),samples:window.__spatialSamples,clicks:window.__bounceClicks})};
for(const mode of ['aisle','flight','detail'])takes['floatingorigin-'+mode]={...specs.floatingorigin,game:'floatingorigin',seconds:mode==='aisle'?16:14,
 setup:async p=>{await specs.floatingorigin.setup(p);await p.evaluate(mode=>{
   globalOffset.set(0,0,0);camera.position.set(0,mode==='flight'?65:5,0);yaw=0;pitch=mode==='flight'?-.68:mode==='detail'?-.09:-.02;
   camera.quaternion.setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));window.__spatialSamples=[];
 },mode);await p.waitForTimeout(300);},
 action:async p=>{const collecting=sample(p,()=>__spatialSamples.push({t:(performance.now()-__spatialStart)/1000,local:camera.position.toArray(),absolute:[absPlayerX,camera.position.y,absPlayerZ],offset:globalOffset.toArray(),shiftCount,chunks:activeChunks.size,speed:displaySpeed}),mode==='aisle'?15:13);await p.keyboard.down('KeyW');if(mode==='flight')await p.keyboard.down('Shift');await collecting;await p.keyboard.up('Shift');await p.keyboard.up('KeyW');},
 telemetry:()=>({state:{local:camera.position.toArray(),absolute:[absPlayerX,camera.position.y,absPlayerZ],offset:globalOffset.toArray(),shiftCount,chunks:activeChunks.size},samples:window.__spatialSamples})};
module.exports={bounce};
if(require.main===module)run(process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
