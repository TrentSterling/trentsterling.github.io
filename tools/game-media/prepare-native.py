"""Stage native footage without writing to original repositories."""
from pathlib import Path
import json,hashlib,shutil,subprocess,datetime
root=Path(__file__).resolve().parents[2];local=root/'.local';native=local/'native';native.mkdir(exist_ok=True)
duck=native/'ducktoy';duck.mkdir(exist_ok=True)
rows=[]
for name in ['rubber-motion','duck-brush','duck-idle']:
 src=Path('C:/trontstack/ducktoy/artifacts')/(name+'.png');copy=duck/src.name;shutil.copy2(src,copy)
 out=duck/(name+'.mp4')
 # The native renderer writes premultiplied-alpha APNG. Composite that directly
 # onto a neutral backing before encoding, preserving its simulation frames.
 subprocess.run(['ffmpeg','-v','error','-nostdin','-y','-f','lavfi','-i','color=c=0x152331:s=912x512:r=60','-i',str(copy),'-filter_complex','[0:v][1:v]overlay=(W-w)/2:0:shortest=1:alpha=premultiplied,format=yuv420p[out]','-map','[out]','-an','-c:v','libx264','-preset','fast','-crf','16','-movflags','+faststart',str(out)],check=True)
 rows.append(dict(name=name,source=str(src),sha256=hashlib.sha256(src.read_bytes()).hexdigest(),output=out.relative_to(root).as_posix(),kind='existing offscreen GPU animation'))
(duck/'provenance.json').write_text(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),animations=rows),indent=2)+'\n')
eq=native/'tronteq';(eq/'src').mkdir(parents=True,exist_ok=True)
shutil.copy2(root/'tools/game-media/tronteq-capture.rs',eq/'src/main.rs')
(eq/'Cargo.toml').write_text('''[package]
name = "gallery-tronteq-capture"
version = "0.1.0"
edition = "2021"
[workspace]
[dependencies]
eframe = { version = "0.33", features = ["glow"] }
egui = "0.33"
egui_kittest = { version = "0.33", features = ["snapshot", "wgpu"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rustfft = "6"
tronteq-shared = { path = "C:/trontstack/tronteq/shared" }
[profile.dev]
opt-level = 1
''')
print('Staged three DuckToy animations and isolated TrontEQ capture crate')
