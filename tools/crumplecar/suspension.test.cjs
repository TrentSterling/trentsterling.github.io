const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const html = fs.readFileSync(path.join(__dirname, '../../crumplecar/index.html'), 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];
const ctx = {document: {getElementById: () => ({})}, window: {addEventListener(){}}, console};
vm.createContext(ctx);
vm.runInContext(script.slice(0, script.indexOf('(async()=>')) + '\nglobalThis.api={Game,CP,SCENERY,SUSPENSION_PART_BASE,PARTS,qaxis,qrot,add,sub,mat};})();', ctx);
const A = ctx.api;
const point = (m,p) => [0,1,2].map(i=>m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]+m[12+i]);
const close = (a,b) => a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<2e-5, `${a} != ${b}`));
function fixture({travel=.525,steer=.3,spin=0,roll=0,damage=false,explode=0,detached=false}={}) {
 const g = Object.create(A.Game.prototype);
 g.renderer={nodeData:new Float32Array(68*190*4),partData:new Float32Array(A.PARTS*20)};
 g.motion={nodes:new Float32Array(4*190*4),out:new Float32Array(640),quats:new Float32Array(256),render:[]};
 g.motion.render[4]=new Float32Array(A.SCENERY.length*12);g.motion.render[5]=new Float32Array(A.SCENERY.length);
 g.nodes=g.motion.nodes;g.frozen=new Set();g.frozenCenters={};g.explodeBlend=explode;
 g.renderDelta=(car,v)=>damage?[.025*(car+1),-.012,.035]:[0,0,0];
 for(let k=0;k<4;k++){
  const o=g.motion.out.subarray(k*160,(k+1)*160);o.set([k*4,2,0]);o.set(A.qaxis([0,0,1],roll),3);o[11]=steer;
  for(let w=0;w<4;w++){o[20+w]=-.02-travel+(damage?-.012:0);o[24+w]=spin;
   if(detached){const j=10+w;o[32+(j-1)*8]=2;o.set([k*4+40,7,20],35+(j-1)*8);g.motion.quats.set([0,0,0,1],(k*16+j)*4);}}
 }
 g.updateParts();return g;
}
function links(g){return Array.from(g.renderer.partData.slice(A.SUSPENSION_PART_BASE*20));}
for(const roll of [0,Math.PI])for(const travel of [.30,.525,.63])for(const steer of [-.48,0,.48])for(const damage of [false,true]){
 test(`hub connections: roll=${roll}, travel=${travel}, steer=${steer}, damaged=${damage}`,()=>{
  const g=fixture({roll,travel,steer,damage});
  for(let k=0;k<4;k++)for(let w=0;w<4;w++){
   const side=w%2===0?-1:1,j=10+w,z=A.CP[j][2],o=g.motion.out.subarray(k*160,(k+1)*160),p=Array.from(o.slice(0,3)),q=Array.from(o.slice(3,7));
   const brake=g.renderer.partData.slice((65+k*4+w)*20,(65+k*4+w)*20+16);
   const hub=point(brake,A.add(A.CP[j],[-side*.04,0,0]));
   const anchors=[[side*.37,-.32,z-.17],[side*.39,-.32,z+.20],[side*.705,-.028,z],[0,-.414,z]];
   for(let l=0;l<4;l++){
    const at=(A.SUSPENSION_PART_BASE+k*16+w*4+l)*20,m=g.renderer.partData.slice(at,at+16);
    close(point(m,[0,1,0]),hub);close(point(m,[0,0,0]),A.add(p,A.qrot(q,A.add(anchors[l],g.renderDelta(k,anchors[l])))));
    assert.ok(Array.from(m).every(Number.isFinite));assert.ok(Math.hypot(m[4],m[5],m[6])<1.5);
    assert.ok(Math.abs(Math.hypot(m[0],m[1],m[2])-1)<1e-6);assert.ok(Math.abs(Math.hypot(m[8],m[9],m[10])-1)<1e-6);
   }
  }
 });
}
test('wheel spin does not rotate suspension hardware',()=>assert.deepEqual(links(fixture({spin:0})),links(fixture({spin:7}))));
test('exploded wheels do not stretch chassis hardware',()=>assert.deepEqual(links(fixture({explode:0})),links(fixture({explode:1}))));
test('detached wheels leave no stretched triangles, all cars',()=>{
 const g=fixture({detached:true});for(let i=0;i<64;i++){
  const at=(A.SUSPENSION_PART_BASE+i)*20,m=g.renderer.partData.slice(at,at+16);
  close(point(m,[0,0,0]),point(m,[0,1,0]));assert.equal(m[15],1);
 }
});
test('shaders correct nonuniform link scaling only for added parts',()=>{
 assert.ok(script.includes('normal.y/=max(dot(part.model[1].xyz,part.model[1].xyz),.000001)'));
 assert.ok(script.includes('nn.y/=max(dot(model[1].xyz,model[1].xyz),.000001)'));
});
// Optional exact-release baseline comparison, used by the review workflow.
if(process.env.CRUMPLECAR_BASELINE){
 const baseline=fs.readFileSync(process.env.CRUMPLECAR_BASELINE,'utf8').split('<script>')[1].split('</script>')[0];
 const bctx={document:ctx.document,window:{addEventListener(){}},console};vm.createContext(bctx);
 vm.runInContext(baseline.slice(0,baseline.indexOf('(async()=>'))+'\nglobalThis.api={Game};})();',bctx);
 for(const opts of [{},{damage:true,roll:Math.PI},{detached:true},{explode:1,steer:-.48},{travel:.3,spin:9}]){
  test(`original part transforms and physics outputs preserved: ${JSON.stringify(opts)}`,()=>{
   const g=fixture(opts),wanted=Array.from(g.renderer.partData.slice(0,A.SUSPENSION_PART_BASE*20)),output=Array.from(g.motion.out);
   bctx.api.Game.prototype.updateParts.call(g);
   assert.deepEqual(Array.from(g.renderer.partData.slice(0,A.SUSPENSION_PART_BASE*20)),wanted);
   assert.deepEqual(Array.from(g.motion.out),output);
  });
 }
 test('embedded physics matches the reviewed release hashes',()=>{
  const crypto=require('node:crypto'),release=JSON.parse(fs.readFileSync(path.join(__dirname,'physics-release.json'),'utf8'));
  const hash=s=>crypto.createHash('sha256').update(Buffer.from(s.match(/atob\('([^']+)'\)/)[1],'base64')).digest('hex');
  assert.ok([release.baselineWasmSha256,release.tunedWasmSha256].includes(hash(baseline)));
  assert.equal(hash(script),release.tunedWasmSha256);
 });
}
test('stationary spindle bridges link joint through the solid brake disc and hub',()=>{
 const section=script.slice(script.indexOf('// Non-spinning caliper render attachment'),script.indexOf(' b.part=0;b.ao=1;b.detail=1;'));
 const spindle=section.match(/b\.cylinder\(P\(xc-side\*([.\d]+),cy,zc\),P\(xc\+side\*([.\d]+),cy,zc\),([.\d]+)/);
 assert.ok(spindle,'spindle must be part of the non-spinning caliper attachment');
 const [,inside,outside,radius]=spindle.map(Number);
 assert.ok(inside>=.04);assert.ok(outside>.112);assert.ok(radius>0&&radius<.060);
});
test('car triangle diagnostics include added linkage parts',()=>assert.ok(script.includes('(+p>=SUSPENSION_PART_BASE+k*16&&+p<SUSPENSION_PART_BASE+(k+1)*16)')));
test('spring radial frame stays continuous across suspension travel',()=>{
 let previous=null;
 for(let t=.30;t<=.631;t+=.002){const g=fixture({travel:t,steer:0}),at=(A.SUSPENSION_PART_BASE+2)*20,m=g.renderer.partData;
  const x=Array.from(m.slice(at,at+3));if(previous)assert.ok(x.reduce((s,v,i)=>s+v*previous[i],0)>.999);previous=x;}
});
test('spring radial frame rolls with the chassis',()=>{
 const upright=fixture({roll:0}),rolled=fixture({roll:Math.PI});
 for(let k=0;k<4;k++)for(let w=0;w<4;w++){const at=(A.SUSPENSION_PART_BASE+k*16+w*4+2)*20;
  close(Array.from(rolled.renderer.partData.slice(at,at+3)),A.qrot(A.qaxis([0,0,1],Math.PI),Array.from(upright.renderer.partData.slice(at,at+3))));}
});
