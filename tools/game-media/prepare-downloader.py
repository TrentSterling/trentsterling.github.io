"""Stage the original downloader UI/engine and offscreen test renderer."""
from pathlib import Path
import json,hashlib,shutil,datetime
root=Path(__file__).resolve().parents[2];src=Path('C:/trontstack/youtube_downloader');base=root/'.local/native/downloader';dest=base/'capture-crate';dest.mkdir(parents=True,exist_ok=True)
for name in ['src','assets']:shutil.copytree(src/name,dest/name,dirs_exist_ok=True)
for name in ['Cargo.lock','THIRD_PARTY_NOTICES.txt']:shutil.copy2(src/name,dest/name)
manifest=(src/'Cargo.toml').read_text(encoding='utf-8').replace('[package]','[workspace]\n\n[package]')
manifest=manifest.replace('[dependencies]','[dependencies]\npollster = "=0.4.0"')
manifest+='\n[profile.dev]\nopt-level = 1\n';(dest/'Cargo.toml').write_text(manifest,encoding='utf-8')
# The isolated recorder uses verified helper copies directly; it never installs a bundle.
metadata=json.loads((src/'runtime-assets/manifest.json').read_text(encoding='utf-8-sig'))
runtime=base/'runtime';(runtime/'scratch').mkdir(parents=True,exist_ok=True)
for tool in metadata['tools']:
 p=src/'runtime-assets'/tool['name'];assert hashlib.sha256(p.read_bytes()).hexdigest()==tool['sha256'];shutil.copy2(p,runtime/p.name)
payload='pub static PAYLOADS: &[Payload] = &[];\npub const ENGINE_VERSION: &str = '+json.dumps(metadata['versions']['ytdlp'])+';\npub const BUNDLE_ID: &str = "isolated-capture";\n'
(dest/'build.rs').write_text('fn main(){std::fs::write(std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap()).join("payloads.rs"),r#"'+payload+'"#).unwrap();}\n',encoding='utf-8')
visual=(src/'tests/visual.rs').read_text(encoding='utf-8')
init=visual[visual.index('    let instance'):visual.index('    let directory')]
body=visual[visual.index('        for (id, delta) in &output.textures_delta.set {',visual.index('        let output =')):visual.index('    }\n    println!')]
start=body.index('        let image =');end=body.index('        for id in output.textures_delta.free',start);body=body[:start]+body[end:]
gpu='use eframe::{egui,egui_wgpu,wgpu};\npub struct Gpu{device:wgpu::Device,queue:wgpu::Queue,renderer:egui_wgpu::Renderer}\nimpl Gpu{pub fn new()->Self{\n'+init+'Self{device,queue,renderer}}\npub fn readback(&mut self,ctx:&egui::Context,output:egui::FullOutput,width:u32,height:u32)->Vec<u8>{let device=&self.device;let queue=&self.queue;let renderer=&mut self.renderer;\n'+body+'pixels\n}}\n'
(dest/'src/gallery_gpu.rs').write_text(gpu,encoding='utf-8')
(dest/'src/main.rs').write_text((root/'tools/game-media/downloader-capture.rs').read_text(encoding='utf-8'),encoding='utf-8')
sources=[dict(file=str(p.relative_to(src)),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in (src/'src').rglob('*.rs')]
(base/'provenance.json').write_text(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceRoot=str(src),sources=sources,helpers=metadata['tools'],changes='Original production GUI and engine; GPU test renderer reused; capture-only entry point; verified helper copies in owned workspace; embedded installer omitted; no native app window or settings load'),indent=2)+'\n')
print('Staged original downloader UI/engine and verified local helpers')
