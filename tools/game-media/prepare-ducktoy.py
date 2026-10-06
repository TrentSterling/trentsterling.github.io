"""Build an isolated offscreen recorder; original DuckToy sources stay read-only."""
from pathlib import Path
import shutil,json,hashlib,datetime
root=Path(__file__).resolve().parents[2];original=Path('C:/trontstack/ducktoy');dest=root/'.local/native/ducktoy/capture-crate'
(dest/'src').mkdir(parents=True,exist_ok=True)
rows=[]
for src in (original/'src').iterdir():
 if src.is_file():
  shutil.copy2(src,dest/'src'/src.name)
  rows.append(dict(source=str(src),sha256=hashlib.sha256(src.read_bytes()).hexdigest()))
for name in ['Cargo.toml','Cargo.lock']:shutil.copy2(original/name,dest/name)
main=(dest/'src/main.rs').read_text()
main=main[:main.index('fn main()')] + '''fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path=std::env::args().nth(1).expect("output MP4 required");
    render::gallery_capture(&path)
}
'''
(dest/'src/main.rs').write_text(main)
render=(dest/'src/render.rs').read_text()
start=render.index('    fn capture_flock(');end=render.index('    pub fn frame_count',start)
capture=render[start:end].replace('fn capture_flock(', 'fn capture_gallery(')
capture=capture.replace('let size = 512u32;','let size = 1024u32;\n        let height = 576u32;')
capture=capture.replace('(size, size)', '(size, height)').replace('height: size,','height,').replace('(size * size * 4)', '(size * height * 4)').replace('rows_per_image: Some(size)', 'rows_per_image: Some(height)')
render=render[:end]+capture+render[end:]+'\n'+(root/'tools/game-media/ducktoy-capture.rs').read_text()
(dest/'src/render.rs').write_text(render)
(dest.parent/'capture-source-provenance.json').write_text(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),originalSources=rows,changes='Offscreen main, wide GPU readback, six-duck physics capture entry point only'),indent=2)+'\n')
print('Staged isolated DuckToy recorder with original physics, flock, and shaders')
