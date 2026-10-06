// Real original download-engine transfer, served only over loopback.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{execFile}=require('node:child_process');
const {root}=require('./server.cjs');const base=path.join(root,'.local/native/downloader');
const bytes=fs.readFileSync(path.join(root,'games/media/dynamite-max-2011.mp4'));
(async()=>{
 const server=http.createServer((req,res)=>{
  if(req.url!='/Dynamite-Max-Papervision3D.mp4'){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':bytes.length,'Connection':'close'});
  if(req.method==='HEAD'){res.end();return;}
  let offset=0;const length=Math.ceil(bytes.length/50);
  const timer=setInterval(()=>{const end=Math.min(offset+length,bytes.length);res.write(bytes.subarray(offset,end));offset=end;if(offset===bytes.length){clearInterval(timer);res.end();}},100);
  res.on('close',()=>clearInterval(timer));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const trace=path.join(base,'transfer.json'),output=path.join(base,'downloads',String(Date.now()));
  const binary=path.join(root,'.local/native-target/debug/youtube-downloader.exe');
  await new Promise((resolve,reject)=>execFile(binary,['trace',`http://127.0.0.1:${server.address().port}/Dynamite-Max-Papervision3D.mp4`,output,trace],{cwd:root,windowsHide:true,timeout:90000},(error,stdout,stderr)=>{fs.writeFileSync(path.join(base,'transfer.log'),stdout+stderr);if(error)reject(error);else{console.log(stdout.trim());resolve();}}));
  const result=JSON.parse(fs.readFileSync(trace,'utf8'));
  for(const file of result.files){if(!fs.readFileSync(file).equals(bytes))throw Error('Downloaded bytes differ from local gameplay source');}
  console.log('Verified saved download matches the actual Papervision3D card bytes');
 }finally{await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
