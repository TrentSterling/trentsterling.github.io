"""Validate browser tool captures and the real engine transfer behind the native UI."""
from pathlib import Path
import json,subprocess,hashlib,datetime
root=Path(__file__).resolve().parents[2];local=root/'.local';rows=[]
for slug in ['speedslap','splitter']:
 record=json.loads((local/slug/'capture.json').read_text());file=local/'masters'/(slug+'.mp4')
 assert not record['errors'] and record['steps'][-1]['seconds']<=record['capture']['wallSeconds']
 subprocess.run(['ffmpeg','-v','error','-nostdin','-i',str(file),'-f','null','-'],check=True)
 info=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=codec_name,codec_type,nb_read_frames,avg_frame_rate:format=duration,size','-of','json',str(file)]))
 # DOM screencasts emit on visual changes; static pauses do not require frames.
 assert len(info['streams'])==1 and int(info['streams'][0]['nb_read_frames'])>=len(record['steps'])*2
 assert abs(float(info['format']['duration'])-record['capture']['wallSeconds'])<.15
 if slug=='speedslap':
  assert [s['rate'] for s in record['steps']]==[3,3.5,4,3.5,1,1,3,1]
  assert record['position']['x']>500
  for asset in record['hashes']:assert hashlib.sha256((local/'sources/speedslap'/asset['name']).read_bytes()).hexdigest()==asset['sha256']
 else:
  assert hashlib.sha256((local/'sources/splitter/index.html').read_bytes()).hexdigest()==record['sourceSha256']
  assert record['steps'][-1]['chunks']==10 and len(record['copied'])==3
  assert all(c['hasStart'] and c['hasEnd'] for c in record['copied'])
 rows.append(dict(slug=slug,sha256=hashlib.sha256(file.read_bytes()).hexdigest(),probe=info,steps=record['steps']))
transfer=json.loads((local/'native/downloader/transfer.json').read_text());source=root/'games/media/dynamite-max-2011.mp4'
for name in transfer['files']:
 file=Path(name);assert file.read_bytes()==source.read_bytes()
 subprocess.run(['ffmpeg','-v','error','-nostdin','-i',str(file),'-f','null','-'],check=True)
progress=[r['event'] for r in transfer['records'] if r['event']['kind']=='progress']
assert len(progress)>5 and progress[-1]['finished'] and progress[-1]['downloaded']==source.stat().st_size
report=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),browserCaptures=rows,downloader=dict(realTransferSeconds=transfer['seconds'],progressEvents=len(progress),downloadedBytes=source.stat().st_size,downloadMatchesSource=True,outputsFullyDecode=True))
(local/'tool-captures-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('COMPLETE tool capture audit: two browser masters decode, original source hashes match, controls change actual playback/chunks, real downloader output matches gameplay source')
