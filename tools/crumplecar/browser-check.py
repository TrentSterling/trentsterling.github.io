"""Read-only local WebKit/WebGL2 QA. Does not edit source or publish anything.
Actual browser screenshots render intentionally injected presentation fixtures;
live-physics cases separately run the shipped WASM integrator and input handler.
Requires Python Playwright and its WebKit or Chromium browser.
Run: python browser-check.py --baseline before.html --candidate crumplecar/index.html --output qa-output
Use --executable or CRUMPLECAR_BROWSER_EXECUTABLE for a custom browser.
PLAYWRIGHT_BROWSERS_PATH is also honored by Playwright.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import tempfile
from playwright.sync_api import sync_playwright

SETUP=r'''(spec) => {
 const qaxis=(a,r)=>[...a.map(x=>x*Math.sin(r/2)),Math.cos(r/2)]; const g=window.__game; g.manual=true;g.running=false;g.launch(0);g.manual=true;g.running=false;g.hideUI=true;g.showHelp=false;g.exploded=false;g.explodeBlend=0;g.keys={};g.toastTime=0;
 g.nodes.fill(0);g.frozen.clear();g.frozenCenters={};
 for(let k=0;k<4;k++){
  const o=g.out.subarray(k*160,(k+1)*160),yaw=k*.35;
  o.set([k*8,1.8,-23],0);o.set(spec.roll?[0,0,1,0]:qaxis([0,1,0],yaw),3);o[11]=spec.steer||0;
  for(let wi=0;wi<4;wi++){o[20+wi]=(spec.travel||[-.47,-.47,-.47,-.47])[wi];o[24+wi]=(spec.spin||0)+wi*.37;}
  for(let j=1;j<16;j++){o[32+(j-1)*8]=0;o[34+(j-1)*8]=0;}
  if(spec.damage)for(let n=0;n<190;n++){
   const r=g.rest[n],i=k*760+n*4;g.nodes[i]=.11*Math.sin(r[2]*1.6+k);g.nodes[i+1]=.06*Math.cos(r[0]*2);g.nodes[i+2]=-.16*Math.max(0,r[2])/2;
  }
  if(spec.detached){for(let wi=0;wi<4;wi++){
   let j=wi+10; o[32+(j-1)*8]=2;o.set([k*8+((wi%2)?3:-3),1.2,-23+(wi<2?2:-2)],35+(j-1)*8);
   g.partQuats.set([0,0,0,1],(k*16+j)*4);
  }}
 }
 g.syncPose(true);g.exploded=!!spec.exploded;g.explodeBlend=spec.exploded?1:0;
 g.cameraOverride=spec.allcars?{eye:[12,12,-42],target:[12,1.5,-23]}:{eye:spec.roll?[3.3,4.0,-18.7]:[3.5,2.3,-18.6],target:[0,1.65,-23]};
 g.cameraArm=null;g.draw(0);
 return {backend:g.renderer.backend, glError:g.renderer.gl?.getError(), rendererErrors:g.renderer.errors, frames:g.frames, scene:spec, newParts:g.renderer.partData.length>=(105+g.propsData.length/12+64)*20?105+g.propsData.length/12:null};
}'''
CHECK=r'''() => {
 const g=window.__game,base=g.renderer.partData.length>=(105+g.propsData.length/12+64)*20?105+g.propsData.length/12:null;
 if(base===null)return{skipped:'Baseline contains no dynamic suspension link parts'};
 const CP=Array.from({length:16},(_,j)=>j>=10&&j<=13?[j%2===0?-.88:.88,-.47,j<12?1.35:-1.32]:[0,0,0]);const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],qrot=(q,p)=>{let t=mul(cross(q,p),2);return add(p,add(mul(t,q[3]),cross(q,t)))};const pd=g.renderer.partData,apply=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]],dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
 const rows=[],fail=[];let maximumHubError=0,maximumMountError=0,maximumLength=0;
 for(let k=0;k<4;k++){
  const o=g.motion.out.subarray(k*160,(k+1)*160),p=Array.from(o.slice(0,3)),q=Array.from(o.slice(3,7));
  for(let wi=0;wi<4;wi++){
   const j=10+wi,side=wi%2===0?-1:1,z=CP[j][2],detached=o[32+(j-1)*8]===2;
   const brake=pd.subarray((65+k*4+wi)*20,(65+k*4+wi)*20+16);
   let hub=apply(brake,add(CP[j],[-side*.04,0,0]));
   if(k===0&&!detached&&g.explodeBlend>.001)hub=sub(hub,mul(qrot(q,[j%2?.75:-.75,0,0]),g.explodeBlend));
   const anchors=[[side*.37,-.32,z-.17],[side*.39,-.32,z+.20],[side*.705,-.028,z],[0,-.414,z]];
   for(let link=0;link<4;link++){
    let id=base+k*16+wi*4+link,m=Array.from(pd.slice(id*20,id*20+16)),a=apply(m,[0,0,0]),b=apply(m,[0,1,0]),anchor=add(p,qrot(q,add(anchors[link],g.renderDelta(k,anchors[link]))));
    let mountError=dist(a,anchor),hubError=detached?dist(a,b):dist(b,hub),len=dist(a,b),finite=m.every(Number.isFinite),rx=Math.hypot(m[0],m[1],m[2]),rz=Math.hypot(m[8],m[9],m[10]);
    maximumHubError=Math.max(maximumHubError,hubError);maximumMountError=Math.max(maximumMountError,mountError);maximumLength=Math.max(maximumLength,len);
    if(!finite||mountError>1e-5||hubError>1e-5||(!detached&&(Math.abs(rx-1)>1e-5||Math.abs(rz-1)>1e-5))||(detached&&(rx>0||rz>0)))fail.push({k,wi,link,finite,mountError,hubError,rx,rz});
    rows.push({car:k,wheel:wi,link,detached,mountError,hubError,length:len});
   }
  }
 }
 return {partsChecked:rows.length,maximumHubError,maximumMountError,maximumLength,failures:fail,rows};
}'''
CASES=[
 ('upright-fresh',{}),('rollover-before-after',{'roll':True}),
 ('rollover-compressed',{'roll':True,'travel':[-.20,-.20,-.20,-.20]}),
 ('rollover-droop',{'roll':True,'travel':[-.68,-.68,-.68,-.68]}),
 ('rollover-asymmetric',{'roll':True,'travel':[-.20,-.68,-.40,-.57]}),
 ('steer-left',{'roll':True,'steer':.55}),('steer-right',{'roll':True,'steer':-.55}),
 ('wheel-spin',{'roll':True,'steer':.4,'spin':2.1}),
 ('damage-deltas',{'roll':True,'damage':True,'steer':.3,'travel':[-.30,-.62,-.44,-.55]}),
 ('detached-all-wheels',{'roll':True,'detached':True}),
 ('exploded-assembly',{'roll':True,'exploded':True}),
 ('all-four-cars',{'roll':True,'allcars':True,'damage':True,'steer':.2}),
]

def main():
 parser = argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--baseline', required=True, type=Path, help='Unmodified baseline HTML file')
 parser.add_argument('--candidate', required=True, type=Path, help='Candidate HTML file')
 parser.add_argument('--output', required=True, type=Path, help='Directory for screenshots, results and temporary browser data')
 parser.add_argument('--engine', default='webkit', choices=['webkit', 'chromium'])
 parser.add_argument('--executable', default=os.environ.get('CRUMPLECAR_BROWSER_EXECUTABLE'), help='Optional browser executable (or CRUMPLECAR_BROWSER_EXECUTABLE)')
 parser.add_argument('--only', choices=['before', 'after'], help='Rerun one side, retaining any existing results for the other side')
 args = parser.parse_args()
 FILES = {'before': args.baseline.resolve(), 'after': args.candidate.resolve()}
 for label, source in FILES.items():
  if not source.is_file():
   parser.error(f'{label} HTML does not exist: {source}')
 OUT = args.output.resolve()
 OUT.mkdir(parents=True, exist_ok=True)
 # Keep browser caches local to this test process; no home-directory setup needed.
 runtime = tempfile.TemporaryDirectory(prefix='crumplecar-browser-', dir=OUT)
 for kind in ['CACHE', 'CONFIG', 'RUNTIME']:
  path = Path(runtime.name) / kind.lower()
  path.mkdir()
  os.environ['XDG_' + kind + ('_DIR' if kind == 'RUNTIME' else '_HOME')] = str(path)
 launch_options = {'headless': True}
 if args.executable:
  launch_options['executable_path'] = args.executable
 result={'engine':args.engine,'method':'Real local browser. Screenshot/transform cases inject presentation fixtures, not a claim of naturally generated rollover. Live physics cases run shipped WASM.','screenshots':[],'fixtures':{},'livePhysics':{},'console':{},'pageErrors':{}}
 if args.only and (OUT/'results.json').exists():result=json.loads((OUT/'results.json').read_text())
 result.setdefault('sourceHashes',{})
 with sync_playwright() as p:
  if args.engine == 'webkit':
   browser = p.webkit.launch(**launch_options)
  else:
   browser = p.chromium.launch(**launch_options, chromium_sandbox=True,
    ignore_default_args=['--enable-unsafe-swiftshader', '--unsafely-disable-devtools-self-xss-warnings'])
  try:
   for label,file in FILES.items():
    if args.only and label!=args.only:continue
    result['sourceHashes'][label]=hashlib.sha256(file.read_bytes()).hexdigest()
    result['screenshots']=[x for x in result['screenshots'] if not Path(x).name.startswith(label+'-')]
    page=browser.new_page(viewport={'width':1024,'height':768},device_scale_factor=1)
    result['console'][label]=[];result['pageErrors'][label]=[]
    page.on('console',lambda m,l=label:result['console'][l].append({'type':m.type,'text':m.text}))
    page.on('pageerror',lambda e,l=label:result['pageErrors'][l].append(str(e)))
    page.route('http://**',lambda route:route.abort());page.route('https://**',lambda route:route.abort())
    page.goto(file.as_uri(),wait_until='load',timeout=120000);page.wait_for_function('window.__ready === true',timeout=120000)
    page.evaluate('()=>{__game.manual=true;__game.running=false;}')
    print(label,'ready',page.evaluate('({backend:__game.renderer.backend,userAgent:navigator.userAgent})'),flush=True)
    result['fixtures'][label]={}
    for name,spec in CASES:
     info=page.evaluate(SETUP,spec);check=page.evaluate(CHECK)
     path=OUT/f'{label}-{name}.png';page.screenshot(path=str(path));result['screenshots'].append(str(path))
     result['fixtures'][label][name]={'info':info,'check':check}
     (OUT/'results.json').write_text(json.dumps(result,indent=2))
     print(label,name,'checks',check.get('partsChecked','baseline'),'failures',len(check.get('failures',[])),flush=True)
    if label=='after':
     page.evaluate(SETUP,{'roll':True,'damage':True,'travel':[-.20,-.68,-.40,-.57]})
     result.setdefault('rollContinuity',{})[label]=page.evaluate('''() => {
      const g=__game,base=105+g.propsData.length/12;let previous=null,maximumDegrees=0,checks=0;
      for(let step=0;step<=720;step++){
       const a=step*Math.PI/360,q=[0,0,Math.sin(a/2),Math.cos(a/2)];
       for(let k=0;k<4;k++)g.out.set(q,k*160+3);
       g.syncPose();g.updateParts();const now=[];
       for(let i=0;i<64;i++)for(const col of [0,8]){const at=(base+i)*20+col,v=Array.from(g.renderer.partData.slice(at,at+3)),len=Math.hypot(...v);now.push(v.map(x=>x/len));}
       if(previous)for(let i=0;i<now.length;i++){let dot=now[i].reduce((s,x,j)=>s+x*previous[i][j],0);maximumDegrees=Math.max(maximumDegrees,Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI);checks++;}
       previous=now;
      }
      return{steps:720,rotationDegrees:360,checks,maximumDegrees,passed:maximumDegrees<.6};
     }''')
     print(label,'roll-continuity',result['rollContinuity'][label],flush=True)
    result['livePhysics'][label]=page.evaluate('''() => {
     const g=__game;g.launch(0);g.manual=true;g.running=false;g.hideUI=false;g.cameraOverride=null;
     const stages=[];
     const run=(name,keys,frames)=>{g.keys=keys;for(let n=0;n<frames;n++)g.physics(1/120);g.keys={};g.draw(0);stages.push({name,position:Array.from(g.out.slice(0,3)),steer:g.out[11],spin:Array.from(g.out.slice(24,28)),wheelY:Array.from(g.out.slice(20,24)),speed:g.out[10],rendererErrors:g.renderer.errors,finite:Array.from(g.renderer.partData).every(Number.isFinite)});};
     run('settle',{},120);run('drive-left',{KeyW:true,KeyA:true},120);run('drive-right',{KeyW:true,KeyD:true},120);
     g.launch(4);g.manual=true;g.running=false;run('drop-test',{},420);
     return stages;
    }''')
    path=OUT/f'{label}-live-drop-test.png';page.screenshot(path=str(path));result['screenshots'].append(str(path));page.close()
  finally:
   browser.close();(OUT/'results.json').write_text(json.dumps(result,indent=2));runtime.cleanup()
 print('RESULTS',OUT/'results.json',flush=True)
 if any(v['check'].get('failures') for l in result['fixtures'].values() for v in l.values()):raise SystemExit('FAILED transform checks')
 if any(not v['passed'] for v in result.get('rollContinuity',{}).values()):raise SystemExit('FAILED roll continuity')
 if any(result['pageErrors'].values()):raise SystemExit('FAILED page errors')
 if any(v['info'].get('glError') or v['info'].get('rendererErrors') for cases in result['fixtures'].values() for v in cases.values()):raise SystemExit('FAILED renderer/GL errors')
 if all(label in result['livePhysics'] for label in ['before','after']) and result['livePhysics']['before'] != result['livePhysics']['after']:raise SystemExit('FAILED live physics baseline equality')
 if any(v['info'].get('glError', 0) or v['info']['rendererErrors'] for label in result['fixtures'].values() for v in label.values()):raise SystemExit('FAILED renderer/GL errors')
if __name__=='__main__':main()
