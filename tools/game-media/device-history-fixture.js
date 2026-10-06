// In-memory IPC fixture for the original compiled Device History frontend.
// No real device inventory, Tauri backend, filesystem, clipboard, or notifications.
(()=>{
 const now=new Date(),callbacks=new Map(),listeners=new Map();let next=1;
 const names=[['USB Backup Drive','DiskDrive'],['USB Audio Interface','AudioEndpoint'],['Mechanical Keyboard','HIDClass'],['Wireless Mouse','HIDClass'],['Drawing Tablet','HIDClass'],['Game Controller','HIDClass'],['USB Webcam','Camera'],['Bluetooth Adapter','Bluetooth'],['USB Ethernet','Net']];
 const storage={model:'Portable USB SSD',serial_number:'SAMPLE-0001',total_bytes:2000000000000,interface_type:'USB',media_type:'SSD',firmware:'1.0',partition_count:1,status:'OK',volumes:[{drive_letter:'E:',volume_name:'Sample backups',total_bytes:2000000000000,free_bytes:740000000000,file_system:'NTFS',volume_serial:'DEMO-0001'}]};
 const known=Object.fromEntries(names.map(([name,cls],i)=>{const id='DEMO_USB_'+i;return [id,{device_id:id,name,vid_pid:'DEMO:'+String(i+1).padStart(4,'0'),class:cls,manufacturer:'Sample device',description:'Illustrative USB device',first_seen:new Date(+now-(12+i)*86400000).toISOString(),last_seen:now.toISOString(),times_seen:3+i*4,currently_connected:i<7,nickname:null,storage_info:i===0?storage:null}];}));
 const project=d=>({device_id:d.device_id,name:d.name,vid_pid:d.vid_pid,manufacturer:d.manufacturer,class:d.class});
 const snapshot={devices:Object.values(known).filter(d=>d.currently_connected).map(project),events:Object.values(known).slice(0,5).map((d,i)=>({...project(d),timestamp:new Date(+now-(5-i)*60000).toISOString(),kind:'connect'})),known_devices:known,storage_info:{DEMO_USB_0:storage},error:null};
 window.__fixtureCalls=[];
 window.__TAURI_INTERNALS__={
  metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},
  transformCallback:fn=>{const id=next++;callbacks.set(id,fn);return id;},
  unregisterCallback:id=>callbacks.delete(id),
  invoke:async(cmd,args={})=>{
   window.__fixtureCalls.push(cmd);
   if(cmd==='get_snapshot')return structuredClone(snapshot);
   if(cmd==='get_prefs')return {theme:'neon',active_tab:'monitor'};
   if(cmd==='plugin:app|version')return '0.8.3';
   if(cmd==='check_for_updates')return null;
   if(cmd==='plugin:event|listen'){listeners.set(args.event,args.handler);return args.handler;}
   if(cmd==='plugin:event|unlisten')return;
   if(cmd==='plugin:window|is_focused')return true;
   if(['set_theme','set_tab','set_nickname'].includes(cmd))return;
   throw Error('Unexpected or disallowed preview IPC: '+cmd);
  }
 };
 window.__deviceFixture={
  emit(index,connected){const d=known['DEMO_USB_'+index];d.currently_connected=connected;d.last_seen=new Date().toISOString();if(connected)d.times_seen++;
   snapshot.devices=Object.values(known).filter(d=>d.currently_connected).map(project);
   snapshot.events.push({...project(d),timestamp:new Date().toISOString(),kind:connected?'connect':'disconnect'});
   const callback=callbacks.get(listeners.get('device-update'));if(!callback)throw Error('Original device update listener not registered');
   callback({event:'device-update',id:1,payload:structuredClone(snapshot)});
  },report:()=>({devices:snapshot.devices.length,events:snapshot.events.length,known:Object.keys(known).length,ipc:window.__fixtureCalls})
 };
})();
