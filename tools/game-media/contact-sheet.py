"""Timestamped footage review sheets, without changing the source recording."""
from pathlib import Path
import subprocess,sys,io,math
from PIL import Image,ImageDraw
src=Path(sys.argv[1]);out=Path(sys.argv[2]);out.parent.mkdir(parents=True,exist_ok=True)
duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(src)]))
times=[float(t) for t in sys.argv[3:]] or [i*duration/12 for i in range(12)]
sheet=Image.new('RGB',(4*320,math.ceil(len(times)/4)*204),'#191b21');draw=ImageDraw.Draw(sheet)
for i,t in enumerate(times):
 data=subprocess.check_output(['ffmpeg','-v','error','-nostdin','-ss',str(t),'-i',str(src),'-frames:v','1','-vf','scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2','-f','image2pipe','-vcodec','png','-'])
 im=Image.open(io.BytesIO(data));x=(i%4)*320;y=(i//4)*204;sheet.paste(im,(x,y));draw.text((x+6,y+183),f'{src.stem}  {t:.2f}s',fill='white')
sheet.save(out)
print(out)
