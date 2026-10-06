"""Measure encoded frames in original photography takes, independent of rAF."""
from pathlib import Path
from fractions import Fraction
import concurrent.futures, json, subprocess

root = Path(__file__).resolve().parents[2]
local = root / '.local'

def inspect(path):
    receipt = json.loads(path.with_suffix('.json').read_text(encoding='utf-8'))
    assert not receipt['errors'], (path, receipt['errors'])
    info = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames',
        '-show_entries', 'stream=avg_frame_rate,nb_read_frames:format=duration',
        '-of', 'json', str(path)
    ]))
    stream = info['streams'][0]
    return dict(take=path.stem, **info,
                encodedFps=float(Fraction(stream['avg_frame_rate'])),
                capturedUtc=receipt['capturedUtc'])

if __name__ == '__main__':
    paths = sorted((local / 'takes').glob('*/*.mp4'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        rows = list(pool.map(inspect, paths))
    (local / 'takes-encoded-audit.json').write_text(json.dumps(rows, indent=2)+'\n')
    print(json.dumps(dict(takes=len(rows),
        totalSeconds=sum(float(r['format']['duration']) for r in rows),
        encodedFpsMin=min(r['encodedFps'] for r in rows),
        encodedFpsMax=max(r['encodedFps'] for r in rows)), indent=2))
