"""Verify recorded crop state, actual harvesting, original module hashes and encoded media."""
from pathlib import Path
import hashlib, json, subprocess
root=Path(__file__).resolve().parents[2]
folder=root/'.local/takes/jennsfarm'
receipts={}
for mode in ['growth','harvest']:
    receipt=json.loads((folder/f'jennsfarm-{mode}.json').read_text(encoding='utf-8'))
    assert receipt['errors']==[]
    assert hashlib.sha256(Path(receipt['source']).read_bytes()).hexdigest()==receipt['sourceSha256']
    for source in receipt['sourceFiles']:
        file=root/'.local/sources/jennsfarm/play/js'/source['name']
        assert hashlib.sha256(file.read_bytes()).hexdigest()==source['sha256'],source['name']
    file=folder/f'jennsfarm-{mode}.mp4'
    # MediaRecorder uses fine VFR timestamps; a default 30 Hz null muxer rounds
    # distinct decoded frames to duplicate DTS. Preserve a microsecond timebase.
    decoded=subprocess.run(['ffmpeg','-v','error','-nostdin','-i',str(file),'-fps_mode','passthrough','-enc_time_base','1:1000000','-f','null','-'],check=True,capture_output=True,text=True)
    assert not decoded.stderr.strip(),decoded.stderr
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=width,height,nb_read_frames,avg_frame_rate:format=duration','-of','json',str(file)]))
    assert int(info['streams'][0]['nb_read_frames'])>500
    assert abs(float(info['format']['duration'])-receipt['recording']['wallSeconds'])<.5
    receipts[mode]=receipt
    print(mode,info['format']['duration'],'seconds',info['streams'][0]['nb_read_frames'],'frames')
growth=receipts['growth'];harvest=receipts['harvest']
assert len(growth['before']['crops'])==48
assert {c['stage'] for c in growth['before']['crops']}=={0}
assert {c['stage'] for c in growth['after']['crops']}=={3}
stages={c['stage'] for e in growth['events'] for c in e['crops']}
assert {0,1,2,3}<=stages
count=lambda sample:next(row['value'] for row in sample['stats'] if row['key']=='harvested')
harvested=count(harvest['after'])-count(harvest['before'])
assert harvested==10
before=harvest['before']['inventory'];after=harvest['after']['inventory']
gains={k:v-before.get(k,0) for k,v in after.items() if not k.endswith('_seed') and v>before.get(k,0)}
assert sum(gains.values())>=10
report=dict(growthStages=sorted(stages),matureCrops=48,harvested=harvested,inventoryGains=gains,errors=[])
(root/'.local/farm-capture-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('COMPLETE farm capture audit',json.dumps(report))
