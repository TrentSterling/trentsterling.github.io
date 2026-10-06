"""Build reviewed <=5s edits from high quality masters and authentic archive footage.

Recipes retain the source, in point, duration and crop of every hard cut.
The 1280x720 crop coordinate system is a fitted view of the complete source.
"""
from pathlib import Path
import hashlib,json,subprocess,sys,shutil
ROOT=Path(__file__).resolve().parents[2]
RECIPES=ROOT/'tools/game-media/montages.json'
LOCAL=ROOT/'.local'
def probe(src):
 return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=width,height','-of','json',str(src)]))
def shot(src,start,length=2.4,crop=None,framing='',label='wide'):
 return dict(source=src.replace('\\','/'),start=start,duration=length,crop=crop or [1280,720,0,0],framing=framing,label=label)
def seed():
 rows=json.loads((LOCAL/'media-manifest.json').read_text())
 recipes={}
 for r in rows:
  if 'video' not in r:continue
  src=r['master'];duration=float(probe(ROOT/src)['format']['duration']);name=Path(r['video']).stem
  end=min(duration-.06,6.8)
  if 'vibecraft' in src:end=3.35
  length=min(2.4,end/2)
  framing=r.get('framing','')
  recipes[name]={'title':r['title'],'kind':r['kind'],'shots':[shot(src,min(.2,max(0,end-length*2)),length,framing=framing),shot(src,max(length,end-length),length,[896,504,192,108],framing,'detail')]}
 RECIPES.write_text(json.dumps(recipes,indent=2)+'\n')
def build(names):
 recipes=json.loads(RECIPES.read_text());out=LOCAL/'montages';out.mkdir(exist_ok=True)
 backup=LOCAL/'before-montages'
 if not backup.exists():shutil.copytree(ROOT/'games/media',backup)
 receipts={}
 for name,r in recipes.items():
  if names and name not in names:continue
  shots=r['shots'];total=sum(s['duration'] for s in shots)
  if total>5.001:raise ValueError((name,total))
  signature=hashlib.sha256(json.dumps(r,sort_keys=True).encode())
  signature.update(Path(__file__).read_bytes())
  for s in shots:
   src=ROOT/s['source'];st=src.stat();signature.update(f'{st.st_size}:{st.st_mtime_ns}'.encode())
   d=float(probe(src)['format']['duration'])
   speed=s.get('speed',1)
   if not isinstance(speed,(int,float)) or not 0<speed<=16:raise ValueError(f'{name}: invalid shot speed: {speed}')
   if s['start']+s['duration']*speed>d+.025:raise ValueError(f'{name}: shot outside source: {s}')
  key=signature.hexdigest();dest=out/(name+'.mp4');receipt=out/(name+'.json')
  if receipt.exists() and dest.exists() and json.loads(receipt.read_text()).get('signature')==key:continue
  inputs=[];filters=[]
  width=r.get('width',640);height=round(width*9/16/2)*2;fps=r.get('fps',30)
  for i,s in enumerate(shots):
   speed=s.get('speed',1)
   if s.get('accurateTrim'):
    inputs+=['-t',str(s['start']+s['duration']*speed),'-i',str(ROOT/s['source'])]
   else:
    inputs+=['-ss',str(s['start']),'-t',str(s['duration']*speed),'-i',str(ROOT/s['source'])]
   w,h,x,y=s['crop']
   if min(w,h)<=0 or x<0 or y<0 or x+w>1280 or y+h>720:raise ValueError(s)
   base=s.get('framing','')
   if base and not base.endswith(','):base+=','
   # Canvas recordings may omit unchanged frames. Normalize their timeline before
   # trimming so an in-point inside a held frame retains that image and duration.
   if s.get('accurateTrim'):base=f'fps={max(60,fps*speed)},trim=start={s["start"]}:duration={s["duration"]*speed},setpts=PTS-STARTPTS,'+base
   filters.append(f'[{i}:v]{base}scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x14171e,crop={w}:{h}:{x}:{y},scale={width}:{height}:flags=lanczos,setsar=1,setpts=(PTS-STARTPTS)/{speed},fps={fps},trim=duration={s["duration"]},setpts=PTS-STARTPTS[v{i}]')
  filters.append(''.join(f'[v{i}]' for i in range(len(shots)))+f'concat=n={len(shots)}:v=1:a=0[out]')
  crf=str(r.get('crf',24))
  subprocess.run(['ffmpeg','-v','error','-nostdin','-y',*inputs,'-filter_complex',';'.join(filters),'-map','[out]','-an','-c:v','libx264','-preset','slow','-crf',crf,'-pix_fmt','yuv420p','-movflags','+faststart',str(dest)],check=True)
  info=probe(dest)
  if float(info['format']['duration'])>5.01:raise ValueError('Edit exceeds five seconds '+name)
  receipts[name]={'signature':key,'recipe':r,'duration':info['format']['duration'],'bytes':dest.stat().st_size}
  receipt.write_text(json.dumps(receipts[name],indent=2)+'\n')
  print('EDIT',name,len(shots),'cuts',total,'seconds',dest.stat().st_size,'bytes',flush=True)
if __name__=='__main__':
 if '--seed' in sys.argv:seed()
 else:build(sys.argv[1:])
