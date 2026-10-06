"""Validate completed edits, original card content and their shipped media."""
from pathlib import Path
from html import unescape
import re,json,subprocess,hashlib
ROOT=Path(__file__).resolve().parents[2];LOCAL=ROOT/'.local'
manifest=json.loads((LOCAL/'media-manifest.json').read_text())
def cards(text):
 result=[]
 for card in re.findall(r'<a\b[^>]*class="item\b[^>]*>.*?</a>',text,re.S):
  opening=card.split('>',1)[0]
  title=re.search(r'<h3[^>]*>(.*?)</h3>',card,re.S)[1]
  body=re.search(r'<div class="card-content">(.*)',card,re.S)[1]
  result.append((opening,unescape(re.sub(r'\s+',' ',body).strip())))
 return result
before=cards((LOCAL/'games-original.html').read_text(encoding='utf-8'))
after=cards((ROOT/'games/index.html').read_text(encoding='utf-8'))
assert before==after,'Card links, order, descriptions or tags changed'
assert len(after)==117 and 'Project Demigod' in after[0][1]
expected=set();videos=[]
for row in manifest:
 expected.add(Path(row['poster']).name)
 if 'video' not in row:continue
 expected.add(Path(row['video']).name);file=ROOT/row['video'].lstrip('/')
 assert 'edit' in row and len(row['edit']['shots'])>=2,row['title']
 subprocess.run(['ffmpeg','-v','error','-nostdin','-i',str(file),'-f','null','-'],check=True,stdout=subprocess.DEVNULL)
 info=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=codec_name,codec_type,width,height,avg_frame_rate,nb_read_frames:format=duration,size','-of','json',str(file)]))
 assert len(info['streams'])==1 and info['streams'][0]['codec_name']=='h264'
 assert float(info['format']['duration'])<=5.01 and int(info['streams'][0]['nb_read_frames'])>10
 assert info['streams'][0]['width']<=640 and file.stat().st_size<1000000
 data=file.read_bytes();assert data.index(b'moov')<data.index(b'mdat')
 version=hashlib.sha256(data).hexdigest()[:12]
 assert row['video']+'?v='+version in (ROOT/'games/index.html').read_text(encoding='utf-8')
 videos.append({'title':row['title'],'duration':float(info['format']['duration']),'bytes':len(data),'cuts':len(row['edit']['shots'])})
actual={p.name for p in (ROOT/'games/media').iterdir() if p.is_file()}
assert expected==actual,{'extra':sorted(actual-expected),'missing':sorted(expected-actual)}
report={'cardsUnchanged':len(after),'animatedCards':len(videos),'mediaFiles':len(actual),'totalMediaBytes':sum(p.stat().st_size for p in (ROOT/'games/media').iterdir()),'maxPreviewBytes':max(v['bytes'] for v in videos),'maxDuration':max(v['duration'] for v in videos),'videos':videos}
(LOCAL/'montage-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('COMPLETE montage audit',json.dumps({k:v for k,v in report.items() if k!='videos'}))
