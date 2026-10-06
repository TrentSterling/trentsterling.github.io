// Runs only the original SpaceView UI renderer over its public showcase tree.
pub fn gallery_capture(output: &str) {
    use std::{io::Write,process::{Command,Stdio}};
    let ctx=egui::Context::default();
    let mut app=crate::app::SpaceViewApp::gallery_new(&ctx);app.gallery_seed();
    let mut renderer=Renderer::new();
    let mut encoder=Command::new("ffmpeg").args(["-v","error","-nostdin","-y","-f","rawvideo","-pix_fmt","rgba","-s","1280x720","-r","30","-i","pipe:0","-an","-c:v","libx264","-preset","fast","-crf","16","-pix_fmt","yuv420p","-movflags","+faststart",output]).stdin(Stdio::piped()).spawn().unwrap();
    let mut sink=encoder.stdin.take().unwrap();
    for frame in 0u32..250 {
        app.gallery_action(frame);
        let full=ctx.run(egui::RawInput{screen_rect:Some(egui::Rect::from_min_size(egui::Pos2::ZERO,egui::vec2(1280.,720.))),time:Some(frame as f64/30.),..Default::default()},|ctx|app.gallery_draw(ctx));
        let pixels=renderer.readback(&ctx,full,[1280,720]);
        if frame>=10 {sink.write_all(&pixels).unwrap();}
        if frame%30==0 {println!("CAPTURE SpaceView frame {frame}/250 {}",app.gallery_report());}
    }
    drop(sink);assert!(encoder.wait().unwrap().success());
    println!("COMPLETE 240 offscreen frames; {}",app.gallery_report());
}
