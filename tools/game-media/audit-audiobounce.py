"""Verify original Unity simulation, offscreen frames and unchanged source files."""
from pathlib import Path
import datetime, hashlib, json, subprocess

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.local/native/audiobounce'
capture=json.loads((OUT/'capture.json').read_text(encoding='utf-8'))
assert capture['errors']==[],capture['errors']
assert capture['frames']==1080 and capture['fps']==60
assert capture['offscreen'] and capture['simulationStepCapture']
assert capture['graphicsApi']=='Direct3D11' and '5070' in capture['gpu']
samples=capture['samples']
assert len(samples)==18
assert all(len(s['sources'])==7 and s['occupiedVoxels']>1000 and s['rays']>0 and s['segments']>s['rays'] for s in samples)
assert all(s['liveSegments']>100 and s['reflectedSegments']>10 for s in samples)
for name in ['Source_Cricket','Source_Beetle','Source_Cicada']:
    positions=[next(row['position'] for row in sample['sources'] if row['name']==name) for sample in samples]
    assert len({tuple(p.values()) for p in positions})>10,(name,positions)
assert any(row['hitDistance']>0 for sample in samples for row in sample['sources'])
assert len({round(row['occlusion'],5) for sample in samples for row in sample['sources']})>3
receipt=json.loads((OUT/'source-receipt.json').read_text())
for item in receipt['files']:
    for base in [Path(receipt['source']),OUT/'project/Packages/com.tront.audiobounce']:
        assert hashlib.sha256((base/item['path']).read_bytes()).hexdigest()==item['sha256'],item['path']
drivers={}
for name,staged in [('AudioBounceCapture.cs','Assets/AudioBounceCapture.cs'),('AudioBounceCaptureBatch.cs','Assets/Editor/AudioBounceCaptureBatch.cs')]:
    original=ROOT/'tools/game-media'/name
    assert original.read_bytes()==(OUT/'project'/staged).read_bytes(),name
    drivers[name]=hashlib.sha256(original.read_bytes()).hexdigest()
frames=sorted(Path(capture['frameDirectory']).glob('*.jpg'))
assert [f.name for f in frames]==[f'{i:05d}.jpg' for i in range(1080)]
assert len({hashlib.sha256(f.read_bytes()).hexdigest() for f in frames})==1080
master=OUT/'audiobounce-demo.mp4'
decoded=subprocess.run(['ffmpeg','-v','error','-nostdin','-i',str(master),'-f','null','-'],check=True,capture_output=True)
assert not decoded.stderr,decoded.stderr.decode()
info=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries',
    'stream=codec_name,codec_type,width,height,nb_read_frames,avg_frame_rate:format=duration,size','-of','json',str(master)]))
assert len(info['streams'])==1 and info['streams'][0]['codec_type']=='video'
assert int(info['streams'][0]['nb_read_frames'])==1080
assert abs(float(info['format']['duration'])-18)<.01
report=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),capture=capture,sourceReceipt=receipt,
    master=master.relative_to(ROOT).as_posix(),sha256=hashlib.sha256(master.read_bytes()).hexdigest(),probe=info,
    sourceFilesVerified=len(receipt['files']),captureDriverHashes=drivers,uniqueFrames=len(frames),
    method='Original Unity demo and GPU ray simulation. Original bug/pulse updates called without HUD or input polling. Existing bug paths staged 0.6m higher to clear floor voxels, listener walks through rooms. Photography cameras/light and silent output added. 60 Hz simulation-step capture, not a realtime performance measurement.')
(ROOT/'.local/audiobounce-capture-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('COMPLETE AudioBounce capture audit:',len(frames),'unique frames, 7 sources, 3 moving bugs, original GPU results and unchanged source hashes')
