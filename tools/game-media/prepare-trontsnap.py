"""Stage the production TrontSnap offscreen harness in the owned capture worktree."""
from pathlib import Path
import json,hashlib,shutil,datetime
root=Path(__file__).resolve().parents[2];src=Path('C:/trontstack/trontsnap');dest=root/'.local/native/trontsnap/capture-crate';dest.mkdir(parents=True,exist_ok=True)
for name in ['src','assets','vendor']:shutil.copytree(src/name,dest/name,dirs_exist_ok=True)
manifest=(src/'Cargo.toml').read_text(encoding='utf-8').replace('members = ["hotkeyd"]','members = []').replace('[package]','[package]\nbuild = false')
# egui-wgpu and pollster belong to normal dependencies in this recorder.
manifest=manifest[:manifest.index('[build-dependencies]')]+'\negui-wgpu = "=0.29.1"\npollster = "=0.4.0"\n[profile.dev]\nopt-level = 1\n'
(dest/'Cargo.toml').write_text(manifest,encoding='utf-8');shutil.copy2(src/'Cargo.lock',dest/'Cargo.lock')
for rel in ['src/app.rs','src/gallery.rs','src/thumbs.rs','src/theme.rs','src/editor.rs']:
 file=dest/rel;s=file.read_text(encoding='utf-8');s=s.replace('#[cfg(test)]\n#[path = "app/preview.rs"]','#[path = "app/preview.rs"]').replace('#[cfg(test)]\n#[path = "gallery/preview.rs"]','#[path = "gallery/preview.rs"]')
 s=s.replace('#[cfg(test)]\n    pub(crate) fn preview','    pub(crate) fn preview').replace('#[cfg(test)]\npub(crate) fn preview','pub(crate) fn preview')
 file.write_text(s,encoding='utf-8')
main=(src/'src/main.rs').read_text(encoding='utf-8');main=main[:main.index('fn main()')].replace('#[cfg(test)]\nmod visual;','mod visual;')
main+='''fn main() {
 let args:Vec<_>=std::env::args().collect();
 visual::gallery_capture(std::path::Path::new(&args[1]),&args[2]);
}
''';(dest/'src/main.rs').write_text(main,encoding='utf-8')
visual=(src/'src/visual.rs').read_text(encoding='utf-8');visual=visual[:visual.index('fn capture(')]
visual=visual.replace('fn save(&mut self, ctx: &egui::Context, output: egui::FullOutput, size: [u32; 2], path: &Path) {','fn readback(&mut self, ctx: &egui::Context, output: egui::FullOutput, size: [u32; 2]) -> Vec<u8> {')
begin=visual.index('        image::RgbaImage::from_raw');end=visual.index('        for id in output.textures_delta.free',begin)
visual=visual[:begin]+visual[end:];visual=visual.replace('            self.renderer.free_texture(&id);\n        }','            self.renderer.free_texture(&id);\n        }\n        pixels')
visual+='\n'+(root/'tools/game-media/trontsnap-capture.rs').read_text(encoding='utf-8');(dest/'src/visual.rs').write_text(visual,encoding='utf-8')
with (dest/'src/editor.rs').open('a',encoding='utf-8') as f:f.write('''
pub(crate) fn gallery_drawer(path: PathBuf) -> impl FnMut(&egui::Context,u32) {
 let base=image::open(&path).expect("public fixture").to_rgba8();
 let mut editor=Editor::new(path,base);editor.color=egui::Color32::from_rgb(255,210,55);editor.stroke_w=8.0;
 move |ctx,frame| {editor.tool=if frame<60 {Tool::Arrow}else{Tool::Box};editor.draw(ctx);}
}
''')
inputs=dest.parent/'public-input';inputs.mkdir(exist_ok=True)
names=['terrainlab.jpg','biomass.jpg','campfire.jpg','colony.jpg','buttloads2.jpg','monkeportalsrender.jpg','ballpit.jpg','ai1.png','astarvibes.png','2015-01-10_08-36-05.png','2015-02-03_18-23-19.png','2015-04-18_03-20-02.jpg','2015-05-15_02-29-22.png','2015-06-14_16-34-46.png','2015-07-10_02-16-47.jpg','2015-08-22_01-30-36.png','2015-09-01_18-21-41.png','2014-09-06_04-27-54.png','2014-09-06_18-32-33.png','2014-12-08_14-13-31-550x309.jpg','2014-12-08_14-16-21-550x309.jpg','20238-shot0.png','bomberman1.jpg','bomberman2.jpg']
for i,name in enumerate(names):shutil.copy2(root/'img'/name,inputs/(f'{i:02d}-'+name))
sources=[dict(file=str(p.relative_to(src)),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in (src/'src').rglob('*.rs')]
(dest.parent/'provenance.json').write_text(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceRoot=str(src),sources=sources,publicFixtures=names,changes='Enable original preview constructors; stream offscreen RGBA frames; page-local egui scroll and drawing events only'),indent=2)+'\n')
print('Staged isolated TrontSnap recorder with',len(names),'public portfolio fixtures')
