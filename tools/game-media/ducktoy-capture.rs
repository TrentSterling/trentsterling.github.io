// Appended only to an ignored copy of render.rs. No desktop, event loop,
// audio device, or OS input code is called by this entry point.
pub fn gallery_capture(output: &str) -> Result<(), Box<dyn std::error::Error>> {
    use std::{io::Write,process::{Command,Stdio}};
    use glam::Vec2;
    let mut renderer=Renderer::create(None);
    renderer.clear=wgpu::Color{r:0.007,g:0.015,b:0.027,a:1.0};
    let bounds=Rect::new(16.0,16.0,1008.0,558.0);
    let mut flock=crate::flock::Flock::new(bounds,Mode::Inside,5302026);
    flock.members[0].duck.size=crate::physics::Size::Big;
    flock.members[0].duck.feel=crate::physics::Feel::Lively;
    for _ in 1..6 {assert!(flock.add(bounds,Mode::Inside,&[bounds]));}
    for (i,m) in flock.members.iter_mut().enumerate(){
        m.duck.pos=Vec2::new(210.0+(i%3) as f32*300.0,125.0+(i/3) as f32*210.0);
        m.duck.vel=Vec2::new(if i%2==0 {290.0} else {-290.0},-80.0);
        m.duck.spin=if i%2==0 {3.0} else {-3.0};
    }
    flock.sync(Mode::Inside);
    let mut encoder=Command::new("ffmpeg").args(["-v","error","-nostdin","-y","-f","rawvideo","-pix_fmt","rgba","-s","1024x576","-r","60","-i","pipe:0","-an","-c:v","libx264","-preset","fast","-crf","16","-pix_fmt","yuv420p","-movflags","+faststart",output]).stdin(Stdio::piped()).spawn()?;
    let mut sink=encoder.stdin.take().unwrap();
    for frame in 0..360 {
        // Impulses represent throws. Integration, collisions, deformation,
        // silhouettes, and rendering all use the original implementation.
        if frame==150 {for (i,m) in flock.members.iter_mut().enumerate(){m.duck.vel+=Vec2::new(if i%2==0 {180.0} else {-180.0},-700.0);}}
        for _ in 0..2 {flock.tick(crate::physics::STEP,Mode::Inside,bounds,&[],&[bounds]);}
        let visuals=flock.visuals(Mode::Inside,1.0,true);
        let pixels=renderer.capture_gallery(&visuals,&[],Vec2::ZERO,&[Rect::new(0.0,0.0,1024.0,576.0)])?;
        sink.write_all(&pixels)?;
        if frame%60==0 {println!("CAPTURE DuckToy frame {frame}/360 impacts {}",flock.members.iter().map(|m|m.duck.impacts).sum::<u64>());}
    }
    drop(sink);assert!(encoder.wait()?.success());
    let impacts=flock.members.iter().map(|m|m.duck.impacts).sum::<u64>();assert!(impacts>0);
    println!("COMPLETE 360 offscreen frames, 6 ducks, {impacts} physics impacts");
    Ok(())
}
