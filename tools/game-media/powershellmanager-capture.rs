#[path="offscreen.rs"] mod offscreen;
fn pointer(pos:egui::Pos2,pressed:bool)->egui::Event {egui::Event::PointerButton{pos,button:egui::PointerButton::Primary,pressed,modifiers:Default::default()}}
fn cell(ctx:&egui::Context,i:usize)->egui::Rect {ctx.data(|d|d.get_temp(egui::Id::new(("test-preview-cell",i)))).expect("original preview geometry")}
pub fn run(output:&str){
 use std::{io::Write,process::{Command,Stdio}};
 let ctx=egui::Context::default();let mut app=fixture();
 app.custom_cols=2;app.custom_rows=2;app.col_weights=vec![0.62,0.38];app.row_weights=vec![0.5,0.5];
 app.config.defaults.manual_order=true;
 let mut renderer=offscreen::Renderer::new();let size=egui::vec2(1280.,720.);
 let mut encoder=Command::new("ffmpeg").args(["-v","error","-nostdin","-y","-f","rawvideo","-pix_fmt","rgba","-s","1280x720","-r","30","-i","pipe:0","-an","-c:v","libx264","-preset","fast","-crf","16","-pix_fmt","yuv420p","-movflags","+faststart",output]).stdin(Stdio::piped()).spawn().unwrap();
 let mut sink=encoder.stdin.take().unwrap();let mut origin=egui::Pos2::ZERO;let mut end=origin;let mut drop_target=origin;
 for frame in 0u32..340 {
  let mut events=Vec::new();
  if frame==35 {let a=cell(&ctx,0);let b=cell(&ctx,1);origin=egui::pos2((a.right()+b.left())*0.5,a.top()+20.);events=vec![egui::Event::PointerMoved(origin),pointer(origin,true)];}
  if (36..=75).contains(&frame){end=origin+egui::vec2(-85.*(frame-35)as f32/40.,0.);events.push(egui::Event::PointerMoved(end));}
  if frame==76 {events.push(pointer(end,false));assert!(app.col_weights[0]<0.5);println!("ACTION dragged column divider {:?}",app.col_weights);}
  if frame==100 {app.toggle_cell(3);println!("ACTION disabled slot 4");}
  if frame==120 {app.toggle_cell(3);app.custom_cols=3;app.col_weights=vec![0.4,0.3,0.3];app.row_weights=vec![0.5,0.5];app.save_config();println!("ACTION six-slot grid");}
  if frame==145 {let a=cell(&ctx,0);let b=cell(&ctx,3);origin=egui::pos2(a.left()+20.,(a.bottom()+b.top())*0.5);events=vec![egui::Event::PointerMoved(origin),pointer(origin,true)];}
  if (146..=185).contains(&frame){end=origin+egui::vec2(0.,-45.*(frame-145)as f32/40.);events.push(egui::Event::PointerMoved(end));}
  if frame==186 {events.push(pointer(end,false));assert!(app.row_weights[0]<0.4);println!("ACTION dragged row divider {:?}",app.row_weights);}
  if frame==205 {app.toggle_pin(1);println!("ACTION pin illustrative Terminal to slot");}
  if (220..240).contains(&frame){events=vec![egui::Event::PointerMoved(egui::pos2(900.,500.)),egui::Event::MouseWheel{unit:egui::MouseWheelUnit::Point,delta:egui::vec2(0.,-20.),modifiers:Default::default()}];}
  if frame==260 {
   let a:egui::Rect=ctx.data(|d|d.get_temp(egui::Id::new(("test-window-handle",1isize)))).unwrap();
   let b:egui::Rect=ctx.data(|d|d.get_temp(egui::Id::new(("test-window-row",3isize)))).unwrap();
   origin=a.center();drop_target=egui::pos2(b.left()+90.,b.bottom()-4.);assert!(origin.y>70.&&drop_target.y<630.);
   events=vec![egui::Event::PointerMoved(origin),pointer(origin,true)];
  }
  if (261..=290).contains(&frame){end=origin+(drop_target-origin)*((frame-260)as f32/30.);events.push(egui::Event::PointerMoved(end));}
  if frame==291 {events.push(pointer(end,false));}
  if frame==300 {assert_ne!(app.managed_windows[0].hwnd,1);println!("ACTION original drag reordered windows {:?}",app.managed_windows.iter().map(|w|w.hwnd).collect::<Vec<_>>());}
  let full=ctx.run(egui::RawInput{screen_rect:Some(egui::Rect::from_min_size(egui::Pos2::ZERO,size)),time:Some(frame as f64/30.),events,..Default::default()},|ctx|crate::gui::draw(ctx,&mut app));
  let pixels=renderer.capture(&ctx,full,size);if frame>=10 {sink.write_all(pixels.as_raw()).unwrap();}
 }
 drop(sink);assert!(encoder.wait().unwrap().success());assert!(!app.native_enabled);
 println!("COMPLETE 330 offscreen frames; six illustrative windows; original divider and reorder interactions; native actions disabled");
}
