'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
function read(file){try{return fs.readFileSync(file,'utf8').trim();}catch(error){return {unavailable:error.code};}}
function cgroupEvidence(membership,reader=read){
 if(typeof membership!=='string')return {unavailable:'cgroup membership unavailable'};
 const line=membership.split('\n').find(line=>line.startsWith('0::/'));
 if(!line)return {unavailable:'unified cgroup membership not reported',membership};
 const relative=line.slice(3),base='/sys/fs/cgroup';
 if(relative.split('/').includes('..'))return {unavailable:'invalid cgroup path',membership};
 let directory=path.posix.resolve(base,'.'+relative);const hierarchy=[];
 if(directory!==base&&!directory.startsWith(base+'/'))return {unavailable:'cgroup path outside hierarchy',membership};
 for(let depth=0;depth<16;depth++){
  hierarchy.push({directory,files:Object.fromEntries(['cpu.max','cpu.stat','cpuset.cpus.effective','cpu.pressure'].map(file=>[file,reader(path.posix.join(directory,file))]))});
  if(directory===base)return {version:2,membership,hierarchy};
  directory=path.posix.dirname(directory);
 }
 return {version:2,membership,hierarchy,incomplete:'ancestor depth limit'};
}
function hostEvidence(root){
 let commit,dirty;try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();dirty=execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch(error){commit={unavailable:String(error)};}
 return {at:new Date().toISOString(),monotonicMs:performance.now(),commit,dirty,node:process.version,
  cgroupHierarchy:cgroupEvidence(read('/proc/self/cgroup')),
  platform:os.platform(),release:os.release(),architecture:os.arch(),availableParallelism:os.availableParallelism(),
  cpus:os.cpus().map(cpu=>({model:cpu.model,speed:cpu.speed,times:cpu.times})),loadAverage:os.loadavg(),
  memory:{total:os.totalmem(),free:os.freemem()},processUsage:process.resourceUsage(),
  runner:Object.fromEntries(['CI','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_JOB','GITHUB_SHA','GALLERY_EXPECTED_SHA','RUNNER_OS','RUNNER_ARCH','ImageOS','ImageVersion'].map(k=>[k,process.env[k]||null])),
  linux:Object.fromEntries(['/proc/self/cgroup','/proc/loadavg','/proc/pressure/cpu','/sys/fs/cgroup/cpu.max','/sys/fs/cgroup/cpu.stat','/sys/fs/cgroup/cpuset.cpus.effective','/sys/fs/cgroup/cpu/cpu.cfs_quota_us','/sys/fs/cgroup/cpu/cpu.cfs_period_us'].map(file=>[file,read(file)]))};
}
async function browserEvidence(browser){
 const cdp=await browser.newBrowserCDPSession(),result={version:browser.version()};
 try{for(const method of ['Browser.getVersion','SystemInfo.getInfo','SystemInfo.getProcessInfo']){try{result[method]=await cdp.send(method);}catch(error){result[method]={unavailable:error.message};}}}
 finally{await cdp.detach();}return result;
}
function writeReport(root,name,report){fs.mkdirSync(path.join(root,'.local'),{recursive:true});fs.writeFileSync(path.join(root,'.local',name),JSON.stringify(report,null,2));}
module.exports={hostEvidence,browserEvidence,writeReport,cgroupEvidence};
