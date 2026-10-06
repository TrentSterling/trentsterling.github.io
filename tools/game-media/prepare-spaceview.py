"""Stage SpaceView's original UI and synthetic data in an offscreen recorder."""
from pathlib import Path
import json,hashlib,shutil,datetime
root=Path(__file__).resolve().parents[2];src=Path('C:/trontstack/spaceview');dest=root/'.local/native/spaceview/capture-crate';dest.mkdir(parents=True,exist_ok=True)
for name in ['src','assets']:shutil.copytree(src/name,dest/name,dirs_exist_ok=True)
manifest=(src/'Cargo.toml').read_text(encoding='utf-8').replace('[package]','[workspace]\n\n[package]\nbuild = false')
manifest=manifest[:manifest.index('[build-dependencies]')]
manifest=manifest.replace("[target.'cfg(windows)'.dependencies]",'egui-wgpu = "0.31"\npollster = "0.4"\n\n'+"[target.'cfg(windows)'.dependencies]")
manifest+='\n[profile.dev]\nopt-level = 1\n';(dest/'Cargo.toml').write_text(manifest,encoding='utf-8');shutil.copy2(src/'Cargo.lock',dest/'Cargo.lock')
app=(src/'src/app.rs').read_text(encoding='utf-8')
app=app.replace("pub fn new(cc: &eframe::CreationContext<'_>) -> Self {",'pub fn gallery_new(ctx: &egui::Context) -> Self {').replace('&cc.egui_ctx','ctx')
start=app.index('        // Spawn background version check');end=app.index('        Self {',start);app=app[:start]+app[end:]
app=app.replace('update_check_receiver: Some(update_rx),','update_check_receiver: None,')
app=app.replace('impl eframe::App for SpaceViewApp {','impl SpaceViewApp {').replace('fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {','pub fn gallery_draw(&mut self, ctx: &egui::Context) {')
app+='''
impl SpaceViewApp {
 pub fn gallery_seed(&mut self) {
  let root=crate::showcase::showcase_tree();let (largest,exts,times)=derive_scan_stats(&root);
  self.ext_color_map.clear();for (i,(ext,_,_)) in exts.iter().enumerate(){self.ext_color_map.insert(ext.clone(),i);}
  self.cached_largest=Some(largest);self.cached_extensions=Some(exts);self.time_range=times;
  self.scan_root=Some(root);self.show_about=false;self.hide_about_on_start=true;self.show_free_space=false;
 }
 pub fn gallery_action(&mut self, frame:u32) {
  fn find_dir<'a>(nodes:&'a [crate::world_layout::LayoutNode],name:&str)->Option<&'a crate::world_layout::LayoutNode>{
   for n in nodes {if n.is_dir&&n.name==name{return Some(n);}if let Some(found)=find_dir(&n.children,name){return Some(found);}}None
  }
  if frame==35 {if let Some(l)=self.world_layout.as_ref(){let n=find_dir(&l.root_nodes,"Unity Projects").expect("showcase Unity folder must be expanded");self.camera.snap_to(n.world_rect,self.last_viewport);assert!(self.camera.target_zoom>1.5);println!("ACTION folder zoom {} target {:.2}",n.name,self.camera.target_zoom);}}
  if frame==70 {if let Some(l)=self.world_layout.as_ref(){let parent=find_dir(&l.root_nodes,"Unity Projects").unwrap();let n=parent.children.iter().find(|n|n.is_dir).expect("showcase project");self.camera.snap_to(n.world_rect,self.last_viewport);println!("ACTION project zoom {} target {:.2}",n.name,self.camera.target_zoom);}}
  if frame==100 {if let Some(l)=self.world_layout.as_ref(){self.camera.snap_to(l.world_rect,self.last_viewport);}}
  if frame==130 {self.color_mode=ColorMode::Extension;self.show_ext_panel=true;}
  if frame==155 {self.selected_extension=self.cached_extensions.as_ref().and_then(|e|e.first()).map(|e|e.0.clone());}
  if frame==185 {self.selected_extension=None;self.show_ext_panel=false;self.view_mode=ViewMode::Extensions;}
 }
 pub fn gallery_report(&self)->String {format!("{} synthetic files; zoom {:.2}; {} visible layout nodes",self.root_file_count,self.camera.zoom,self.world_layout.as_ref().map(|l|l.live_nodes).unwrap_or(0))}
}
'''
(dest/'src/app.rs').write_text(app,encoding='utf-8')
main=(src/'src/main.rs').read_text(encoding='utf-8');main=main[:main.index('/// Write panics')].replace('#![windows_subsystem = "windows"]','')
main+='''mod visual;
fn main() {
 let output=std::env::args().nth(1).expect("output MP4 required");
 let dir=std::path::Path::new(&output).parent().expect("capture output directory");
 std::env::set_var("SPACEVIEW_PREFS_DIR",dir.join("isolated-prefs"));
 visual::gallery_capture(&output);
}
''';(dest/'src/main.rs').write_text(main,encoding='utf-8')
visual=(root/'.local/native/trontsnap/capture-crate/src/visual.rs').read_text(encoding='utf-8');visual=visual[:visual.index('// Added to an isolated')]
visual=visual.replace('wgpu::Instance::new(wgpu::InstanceDescriptor::default())','wgpu::Instance::new(&wgpu::InstanceDescriptor::default())')
visual+='\n'+(root/'tools/game-media/spaceview-capture.rs').read_text(encoding='utf-8');(dest/'src/visual.rs').write_text(visual,encoding='utf-8')
sources=[dict(file=str(p.relative_to(src)),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in (src/'src').rglob('*.rs')]
(dest.parent/'provenance.json').write_text(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceRoot=str(src),sources=sources,changes='Offscreen UI entry; isolated preferences; no version check; original synthetic showcase tree and camera navigation; no file scan'),indent=2)+'\n')
print('Staged isolated SpaceView UI recorder over the original synthetic showcase tree')
