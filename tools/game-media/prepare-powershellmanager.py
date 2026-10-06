"""Stage the original inert PowerShellManager preview and GPU renderer."""
from pathlib import Path
import json,hashlib,shutil,datetime,re
root=Path(__file__).resolve().parents[2];src=Path('C:/trontstack/powershellmanager');dest=root/'.local/native/powershellmanager/capture-crate';dest.mkdir(parents=True,exist_ok=True)
for name in ['src','assets','vendor']:shutil.copytree(src/name,dest/name,dirs_exist_ok=True)
manifest=(src/'Cargo.toml').read_text(encoding='utf-8').replace('[package]','[workspace]\n\n[package]\nbuild = false')
manifest=manifest.replace('[build-dependencies]\nwinresource = "0.1"','egui-wgpu = "0.31"\npollster = "0.4"')
manifest+='\n[profile.dev]\nopt-level = 1\n';(dest/'Cargo.toml').write_text(manifest,encoding='utf-8');shutil.copy2(src/'Cargo.lock',dest/'Cargo.lock')
main=(src/'src/main.rs').read_text(encoding='utf-8').split('use clap::Parser;')[0]
main+='''mod capture;
fn main(){let output=std::env::args().nth(1).expect("output MP4 required");capture::run(&output);}
''';(dest/'src/main.rs').write_text(main,encoding='utf-8')
for rel in ['src/gui.rs','src/gui/preview.rs']:
 p=dest/rel;p.write_text(p.read_text(encoding='utf-8').replace('#[cfg(test)]',''),encoding='utf-8')
tests=(src/'src/ui_tests.rs').read_text(encoding='utf-8');fixture=tests[tests.index('fn fixture()'):tests.index('\n#[test]')]
capture='use crate::{app::PsmApp,config::Config};\n'+fixture+'\n'+(root/'tools/game-media/powershellmanager-capture.rs').read_text(encoding='utf-8')
(dest/'src/capture.rs').write_text(capture,encoding='utf-8')
shutil.copy2(src/'src/ui_tests/offscreen.rs',dest/'src/offscreen.rs')
sources=[dict(file=str(p.relative_to(src)),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in (src/'src').rglob('*.rs')]
(dest.parent/'provenance.json').write_text(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceRoot=str(src),sources=sources,changes='Original inert preview fixture; original GUI and GPU renderer; test geometry receipts enabled; egui-local divider drags; no app shell, OS input, window enumeration, tray, persistence or native actions'),indent=2)+'\n')
print('Staged PowerShellManager inert preview recorder')
