mod gallery_gpu;
use eframe::egui;
use youtube_downloader::{app::{Busy,DownloaderApp},engine::{self,Event,DownloadRequest},model::{Settings,VideoInfo,Progress,Quality,Cookies},runtime::Runtime,theme};
use std::{path::PathBuf,sync::{Mutex,atomic::AtomicBool},time::Instant,io::Write,process::Stdio};
fn main(){
 let args:Vec<_>=std::env::args().collect();
 match args.get(1).map(String::as_str){Some("trace")=>trace(&args[2],&args[3],&args[4]),Some("render")=>render(&args[2],&args[3],&args[4]),_=>panic!("trace URL OUTPUT_DIR TRACE_JSON | render TRACE_JSON THUMBNAIL OUTPUT_MP4")}
}
fn trace(url:&str,out:&str,file:&str){
 let folder=PathBuf::from(file).parent().unwrap().to_path_buf();let runtime=Runtime{directory:folder.join("runtime")};
 let start=Instant::now();let records=Mutex::new(Vec::new());
 let emit=|event:Event|{let value=match event{
  Event::Progress(p)=>serde_json::json!({"kind":"progress","downloaded":p.downloaded,"total":p.total,"speed":p.speed,"eta":p.eta,"finished":p.finished}),
  Event::Status(s)=>serde_json::json!({"kind":"status","text":s}),
  Event::Log(s)=>serde_json::json!({"kind":"log","text":s}),_=>return};
  records.lock().unwrap().push(serde_json::json!({"seconds":start.elapsed().as_secs_f64(),"event":value}));};
 let files=engine::download(&runtime,&DownloadRequest{url:url.into(),output:PathBuf::from(out),quality:Quality::Best,save_mp3:false,cookies:Cookies::None},&AtomicBool::new(false),&emit).expect("original engine download");
 assert!(files.iter().all(|p|p.is_file()));let seconds=start.elapsed().as_secs_f64();let records=records.into_inner().unwrap();
 assert!(records.iter().filter(|e|e["event"]["kind"]=="progress").count()>2);
 std::fs::write(file,serde_json::to_vec_pretty(&serde_json::json!({"url":url,"seconds":seconds,"files":files,"records":records})).unwrap()).unwrap();
 println!("COMPLETE real local transfer in {seconds:.3}s; saved {} file(s)",files.len());
}
fn render(trace_file:&str,thumbnail:&str,output:&str){
 let trace:serde_json::Value=serde_json::from_slice(&std::fs::read(trace_file).unwrap()).unwrap();let records=trace["records"].as_array().unwrap();
 let first=records.iter().find(|r|r["event"]["kind"]=="progress").unwrap()["seconds"].as_f64().unwrap();let finished=trace["seconds"].as_f64().unwrap();
 let ctx=egui::Context::default();ctx.set_pixels_per_point(2.);
 let settings=Settings{output_dir:PathBuf::from(trace["files"][0].as_str().unwrap()).parent().unwrap().to_path_buf(),..Default::default()};
 theme::install_fonts(&ctx);theme::apply(&ctx,&settings);let mut app=DownloaderApp::with_runtime(settings,Runtime{directory:PathBuf::from(trace_file).parent().unwrap().join("runtime")});
 let info:VideoInfo=serde_json::from_value(serde_json::json!({"title":"Dynamite Max - Papervision3D gameplay","uploader":"Trent Sterling","duration":4.8,"thumbnail":"local-capture-thumbnail","webpage_url":trace["url"],"formats":[{"height":360,"vcodec":"avc1"}]})).unwrap();
 app.url=info.webpage_url.clone();app.handle_event(&ctx,Event::Info(info));app.handle_event(&ctx,Event::Thumbnail{url:"local-capture-thumbnail".into(),bytes:std::fs::read(thumbnail).unwrap()});app.quality=Quality::Height(360);
 let mut gpu=gallery_gpu::Gpu::new();let mut encoder=engine::command("ffmpeg").args(["-v","error","-nostdin","-y","-f","rawvideo","-pix_fmt","rgba","-s","1280x720","-r","30","-i","pipe:0","-an","-c:v","libx264","-preset","fast","-crf","16","-pix_fmt","yuv420p","-movflags","+faststart",output]).stdin(Stdio::piped()).spawn().unwrap();let mut sink=encoder.stdin.take().unwrap();let mut cursor=0;
 for frame in 0u32..280 {
  if frame==35 {app.busy=Busy::Downloading;}
  if (35..=190).contains(&frame){let t=first+(finished-first)*(frame-35)as f64/155.;while cursor<records.len()&&records[cursor]["seconds"].as_f64().unwrap()<=t {let e=&records[cursor]["event"];match e["kind"].as_str().unwrap(){
   "progress"=>app.handle_event(&ctx,Event::Progress(Progress{downloaded:e["downloaded"].as_f64().unwrap(),total:e["total"].as_f64().unwrap(),speed:e["speed"].as_f64().unwrap_or(0.),eta:e["eta"].as_f64().unwrap_or(0.),finished:e["finished"].as_bool().unwrap()})),
   "status"=>app.handle_event(&ctx,Event::Status(e["text"].as_str().unwrap().into())),
   "log"=>app.handle_event(&ctx,Event::Log(e["text"].as_str().unwrap().into())),_=>()};cursor+=1;}}
  if frame==191 {app.handle_event(&ctx,Event::Complete(trace["files"].as_array().unwrap().iter().map(|v|PathBuf::from(v.as_str().unwrap())).collect()));}
  if frame==220 {app.set_preferences_open(true);}
  if frame==245 {app.settings.dark=false;theme::apply(&ctx,&app.settings);}
  let full=ctx.run_ui(egui::RawInput{screen_rect:Some(egui::Rect::from_min_size(egui::Pos2::ZERO,egui::vec2(640.,360.))),time:Some(frame as f64/30.),..Default::default()},|ui|app.draw(ui));
  let pixels=gpu.readback(&ctx,full,1280,720);if frame>=10 {sink.write_all(&pixels).unwrap();}
 }
 drop(sink);assert!(encoder.wait().unwrap().success());assert!(!app.completed.is_empty());
 println!("COMPLETE 270 offscreen frames; original UI replays actual engine transfer events, completion, and preferences; no native window or settings writes");
}
