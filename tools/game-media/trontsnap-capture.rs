// Added to an isolated copy of the production offscreen visual harness.
// Uses public portfolio images only; no tray, hotkeys, capture roots or saving.
pub fn gallery_capture(input: &std::path::Path, output: &str) {
    use std::{io::Write,process::{Command,Stdio}};
    let mut paths:Vec<_>=std::fs::read_dir(input).unwrap().map(|p|p.unwrap().path()).collect();paths.sort();
    assert!(paths.len()>=18);
    let ctx=egui::Context::default();
    let mut app=crate::app::App::preview(&ctx,&paths);
    crate::theme::preview_theme(&ctx,[90,209,255],true);
    let mut renderer=Renderer::new();
    let mut editor=crate::editor::gallery_drawer(paths[0].clone());
    let mut encoder=Command::new("ffmpeg").args(["-v","error","-nostdin","-y","-f","rawvideo","-pix_fmt","rgba","-s","1280x720","-r","30","-i","pipe:0","-an","-c:v","libx264","-preset","fast","-crf","16","-pix_fmt","yuv420p","-movflags","+faststart",output]).stdin(Stdio::piped()).spawn().unwrap();
    let mut sink=encoder.stdin.take().unwrap();
    for frame in 0u32..220 {
        let is_editor=frame>=100;let ef=frame.saturating_sub(100);
        let mut events=Vec::new();
        if !is_editor {
            events.push(egui::Event::PointerMoved(egui::pos2(990.,540.)));
            if (25..85).contains(&frame) {events.push(egui::Event::MouseWheel{unit:egui::MouseWheelUnit::Point,delta:egui::vec2(0.,-8.),modifiers:egui::Modifiers::NONE});}
        }else{
            let (start,end,at)=if ef<60 {(egui::pos2(520.,230.),egui::pos2(760.,410.),ef)}else{(egui::pos2(720.,300.),egui::pos2(1000.,525.),ef-60)};
            let f=((at as f32-8.)/28.).clamp(0.,1.);let pos=start+(end-start)*f;
            events.push(egui::Event::PointerMoved(pos));
            if at==8||at==38 {events.push(egui::Event::PointerButton{pos,button:egui::PointerButton::Primary,pressed:at==8,modifiers:egui::Modifiers::NONE});}
        }
        let full=ctx.run(egui::RawInput{screen_rect:Some(egui::Rect::from_min_size(egui::Pos2::ZERO,egui::vec2(1280.,720.))),time:Some(frame as f64/30.),events,..Default::default()},|ctx|{
            if is_editor {editor(ctx,ef);}else{app.preview_draw(ctx,"gallery");}
        });
        let pixels=renderer.readback(&ctx,full,[1280,720]);
        if frame>=10 {sink.write_all(&pixels).unwrap();}
        if frame%30==0 {println!("CAPTURE TrontSnap frame {frame}/220 view {}",if is_editor {"annotation editor"}else{"public fixture gallery"});}
    }
    drop(sink);assert!(encoder.wait().unwrap().success());
    println!("COMPLETE 210 offscreen frames; public gallery scroll, arrow and box annotation; no file save or clipboard operation");
}
