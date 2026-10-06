// Offscreen capture of the original TrontEQ canvas and audio analyzer.
// The app shell, WASAPI, state writer, tray, and OS input modules are not loaded.
#[path = "C:/trontstack/tronteq/gui/src/color.rs"] mod color;
#[path = "C:/trontstack/tronteq/gui/src/theme.rs"] mod theme;
#[path = "C:/trontstack/tronteq/gui/src/dsp_preview.rs"] mod dsp_preview;
#[path = "C:/trontstack/tronteq/gui/src/glstage.rs"] mod glstage;
#[path = "C:/trontstack/tronteq/gui/src/render_timer.rs"] mod render_timer;
#[path = "C:/trontstack/tronteq/gui/src/show.rs"] mod show;
#[path = "C:/trontstack/tronteq/gui/src/curve.rs"] mod curve;
#[path = "C:/trontstack/tronteq/gui/src/audio_analysis.rs"] mod audio_analysis;
#[path = "C:/trontstack/tronteq/gui/src/vizbus.rs"] mod vizbus;

use std::{cell::RefCell,rc::Rc,io::Write,process::{Command,Stdio}};
use eframe::egui;
use egui_kittest::Harness;
use tronteq_shared::{Band,BandKind,DEFAULT_FREQS,NUM_BANDS};

struct CaptureState { frame: audio_analysis::Frame, time:f32, mode:usize }

fn main() {
 let out=std::env::args().nth(1).expect("output MP4 path required");
 let mut analyzer=audio_analysis::Analyzer::new(48_000,2);
 let shared=Rc::new(RefCell::new(CaptureState{frame:analyzer.snapshot(),time:0.,mode:0}));
 let state=shared.clone();let mut themed=false;
 let mut bands=[Band::flat(0.);NUM_BANDS];
 for (i,f) in DEFAULT_FREQS.iter().enumerate(){bands[i]=Band{freq:*f,gain:[7.,4.,0.,-4.,-5.,-1.,3.,6.][i],q:1.,kind:BandKind::Peak as u32};}
 let mut scene=show::ShowState::new(show::ShowMode::Off);let mut last_mode=0;
 let mut harness=Harness::builder().with_size(egui::vec2(1280.,720.)).build_ui(move |ui|{
  if !themed {theme::apply(ui.ctx());theme::set_palette(ui.ctx(),theme::Palette::electric_cyan());themed=true;}
  let s=state.borrow();
  if s.mode!=last_mode {scene=show::ShowState::new(show::ShowMode::ScopeTrails);last_mode=s.mode;}
  // Edit the same band parameters the native curve editor uses.
  bands[3].gain=-3.+(s.time*2.1).sin()*7.;bands[5].gain=(s.time*1.7).cos()*5.;
  bands[5].freq=1400.+(s.time*1.3).sin()*650.;
  let viz=curve::VizData{layers:curve::Layers{waveform:s.mode==1,..Default::default()},spectrum:&s.frame.spectrum,peaks:&s.frame.peaks,waveform:&s.frame.wave,stereo:&s.frame.stereo,loudness:&s.frame.loudness,spectro_tex:None};
  curve::draw(ui,&mut bands,3,48_000.,true,&viz,&mut scene,None,glstage::Uniforms::default());
 });
 harness.step();harness.step();
 let mut encoder=Command::new("ffmpeg").args(["-v","error","-nostdin","-y","-f","rawvideo","-pix_fmt","rgba","-s","1280x720","-r","30","-i","pipe:0","-an","-c:v","libx264","-preset","fast","-crf","16","-pix_fmt","yuv420p","-movflags","+faststart",&out]).stdin(Stdio::piped()).spawn().expect("FFmpeg");
 let mut sink=encoder.stdin.take().unwrap();let mut sample=0u64;let mut random=0x53a12fu32;let mut energies=Vec::new();
 for frame in 0..210 {
  // Generated stereo test music is fed through the shipping FFT and analysis.
  // No loopback device, playback device, or personal audio is opened.
  for _ in 0..1600 {
   let t=sample as f32/48000.;let beat=(t*2.).fract();let kick=(-beat*24.).exp()*(std::f32::consts::TAU*(52.*t+4.*(-beat*20.).exp())).sin()*0.22;
   random=random.wrapping_mul(1664525).wrapping_add(1013904223);let noise=(random as f32/u32::MAX as f32*2.-1.)*((-(t*4.).fract()*18.).exp())*0.065;
   let mut left=kick+noise;let mut right=kick-noise*0.8;
   for (i,f) in [55.,82.4069,110.,164.8138,220.,329.6276,440.,659.255,880.,1318.51,1760.,2637.].iter().enumerate(){
    let env=0.35+0.65*(t*(1.2+i as f32*0.09)+i as f32).sin().abs();let amp=0.04*env/(1.+i as f32*0.08);
    left+=(std::f32::consts::TAU*f*t).sin()*amp;right+=(std::f32::consts::TAU*f*t+i as f32*0.07).sin()*amp;
   }
   analyzer.feed(&[left,right]);sample+=1;
  }
  let data=analyzer.snapshot();energies.push(data.rms);
  *shared.borrow_mut()=CaptureState{frame:data,time:frame as f32/30.,mode:usize::from(frame>=105)};
  std::thread::sleep(std::time::Duration::from_millis(17));harness.step();
  std::thread::sleep(std::time::Duration::from_millis(17));harness.step();
  let img=harness.render().expect("offscreen GPU render");assert_eq!(img.dimensions(),(1280,720));sink.write_all(img.as_raw()).expect("write video frame");
  if frame%30==0 {println!("CAPTURE TrontEQ frame {frame}/210 analyzer ticks {}",analyzer.ticks);}
 }
 drop(sink);assert!(encoder.wait().expect("FFmpeg completion").success());
 println!("COMPLETE 210 offscreen frames, {} audio samples, RMS range {:.4}..{:.4}",sample,energies.iter().cloned().fold(f32::INFINITY,f32::min),energies.iter().cloned().fold(0.,f32::max));
}
