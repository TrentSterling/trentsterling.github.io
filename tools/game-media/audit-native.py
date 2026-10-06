"""Decode native masters and retain source/rendering receipts."""
from pathlib import Path
import json,subprocess,hashlib,datetime,sys
root=Path(__file__).resolve().parents[2];local=root/'.local';rows=[]
for name,frames,duration in [('ducktoy/ducktoy-flock',360,6),('tronteq/tronteq-spectrum',210,7),('trontsnap/trontsnap-interactions',210,7),('spaceview/spaceview-navigation',240,8),('powershellmanager/powershellmanager-layouts',330,11),('downloader/downloader-transfer',270,9)]:
 file=local/'native'/(name+'.mp4');raw=(file.parent/'capture.log').read_bytes()
 log=raw.decode('utf-16' if raw.startswith((b'\xff\xfe',b'\xfe\xff')) else 'utf-8-sig')
 assert 'COMPLETE' in log and 'panicked' not in log and 'error:' not in log,log[-500:]
 subprocess.run(['ffmpeg','-v','error','-nostdin','-i',str(file),'-f','null','-'],check=True)
 info=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=codec_name,codec_type,width,height,nb_read_frames,avg_frame_rate:format=duration,size','-of','json',str(file)]))
 assert len(info['streams'])==1 and info['streams'][0]['codec_type']=='video'
 assert int(info['streams'][0]['nb_read_frames'])==frames
 assert abs(float(info['format']['duration'])-duration)<.01
 rows.append(dict(name=name,file=file.relative_to(root).as_posix(),sha256=hashlib.sha256(file.read_bytes()).hexdigest(),probe=info,completion=log.splitlines()[-1],method='Offscreen GPU readback at fixed rendering cadence; source-specific drivers recorded with each capture; not a realtime GPU performance measurement'))
subprocess.run([sys.executable,str(root/'tools/game-media/audit-audiobounce.py')],check=True)
audio=json.loads((local/'audiobounce-capture-audit.json').read_text())
rows.append(dict(name='audiobounce/audiobounce-demo',file=audio['master'],sha256=audio['sha256'],probe=audio['probe'],completion='COMPLETE AudioBounce capture audit',method=audio['method']))
report=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),nativeCaptures=len(rows),totalSeconds=sum(float(r['probe']['format']['duration']) for r in rows),rows=rows)
(local/'native-capture-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('COMPLETE native capture audit',report['nativeCaptures'],'captures',report['totalSeconds'],'seconds')
