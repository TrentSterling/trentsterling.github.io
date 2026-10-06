from pathlib import Path
import json,subprocess,io,math
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2]
rows=[r for r in json.loads((ROOT/'.local/media-manifest.json').read_text()) if 'video' in r]
out=ROOT/'.local/review';out.mkdir(exist_ok=True)
for k in range(0,len(rows),12):
 group=rows[k:k+12];sheet=Image.new('RGB',(1280,math.ceil(len(group)/2)*202),'#1b1c24');draw=ImageDraw.Draw(sheet)
 for j,r in enumerate(group):
  duration=float(r['videoInfo']['format']['duration'])
  for n,t in enumerate([min(.65,duration*.25),max(.1,duration-.45)]):
   data=subprocess.check_output(['ffmpeg','-v','error','-nostdin','-ss',str(t),'-i',str(ROOT/r['master']),'-frames:v','1','-vf',r.get('framing','')+'scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2','-f','image2pipe','-vcodec','png','-'])
   x=(j%2)*640+n*320;y=(j//2)*202
   if data:sheet.paste(Image.open(io.BytesIO(data)),(x,y))
  draw.text(((j%2)*640+8,(j//2)*202+183),r['title'],fill='white')
 file=out/f'final-edits-{k//12}.jpg';sheet.save(file);print(file,flush=True)
