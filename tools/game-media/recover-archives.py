"""Retrieve previously identified public footage using the local Rust app runtime.

No browser profile or cookies. Sources are checked against the original uploader
metadata before downloading; selection into a gallery card is a separate review.
"""
from pathlib import Path
import json,subprocess,sys,datetime
ROOT=Path(__file__).resolve().parents[2]
RUNTIME=Path('C:/trontstack/youtube_downloader/runtime-assets')
ARCHIVE=ROOT/'.local/archive-video'
OUT=ARCHIVE/'recovered';OUT.mkdir(exist_ok=True)
metadata_only='--metadata-only' in sys.argv
names=[a for a in sys.argv[1:] if a!='--metadata-only'] or ['configjoint','farmvr','buttloads','magicarcher','3dayrpg','thatdummy','vaultscript','punchinduders']
results=[]
for name in names:
 if '=' in name:
  name,video_id=name.split('=',1)
  if not name.replace('-','').isalnum() or not all(c.isalnum() or c in '_-' for c in video_id):raise ValueError('Invalid archive identifier')
  metadata=ARCHIVE/(name+'.info.json')
  if not metadata.exists():
   args=[str(RUNTIME/'yt-dlp.exe'),'--ignore-config','--no-playlist','--no-colors','--no-plugin-dirs','--no-js-runtimes','--js-runtimes','quickjs:'+str(RUNTIME/'qjs.exe'),'--skip-download','--dump-single-json','--','https://www.youtube.com/watch?v='+video_id]
   result=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
   data=json.loads(result.stdout)
   assert data.get('uploader')=='Trent Sterling',(name,data.get('uploader'))
   metadata.write_text(json.dumps(data),encoding='utf-8')
 info=json.loads((ARCHIVE/(name+'.info.json')).read_text(encoding='utf-8'))
 assert info.get('uploader')=='Trent Sterling',(name,info.get('uploader'))
 if metadata_only:
  print(json.dumps({k:info.get(k) for k in ['id','title','upload_date','duration','description']},ensure_ascii=False),flush=True)
  continue
 url='https://www.youtube.com/watch?v='+info['id']
 args=[str(RUNTIME/'yt-dlp.exe'),'--ignore-config','--no-playlist','--no-colors','--no-plugin-dirs','--socket-timeout','30','--retries','2','--no-js-runtimes','--js-runtimes','quickjs:'+str(RUNTIME/'qjs.exe'),'--ffmpeg-location',str(RUNTIME),'-f','bv[height<=1080]/b[height<=1080]','--write-info-json','--no-progress','--no-overwrites','-o',str(OUT/(name+'.%(ext)s')),'--',url]
 print('RECOVER START',name,info['title'],flush=True)
 process=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace')
 (OUT/(name+'.log')).write_text(process.stdout,encoding='utf-8')
 files=[p for p in OUT.glob(name+'.*') if p.suffix in ['.mp4','.webm','.mkv']]
 valid=[]
 for file in files:
  check=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json',str(file)],capture_output=True,text=True)
  if check.returncode==0:valid.append({'file':file.relative_to(ROOT).as_posix(),'bytes':file.stat().st_size,'probe':json.loads(check.stdout)})
 result={'name':name,'url':url,'title':info['title'],'uploader':info['uploader'],'uploadDate':info['upload_date'],'exitCode':process.returncode,'files':valid,'at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 if process.returncode:result['error']=process.stdout[-1500:]
 results.append(result)
 receipt_file=OUT/'download-receipts.json'
 previous=json.loads(receipt_file.read_text()) if receipt_file.exists() else []
 merged={row['name']:row for row in [*previous,*results]}
 receipt_file.write_text(json.dumps(list(merged.values()),indent=2)+'\n')
 print('RECOVER '+('COMPLETE' if valid else 'FAILED'),name,json.dumps(valid) if valid else process.stdout[-500:],flush=True)
