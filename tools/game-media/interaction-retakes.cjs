// Record original game interactions, retaining action telemetry for shot selection.
const fs=require('node:fs'),path=require('node:path');
const {takes,run}=require('./takes.cjs');
const {root}=require('./server.cjs');

for(const mode of ['swing','shoot'])takes['smear-'+mode]={game:'smear',seconds:mode==='swing'?18:14,
 setup:async p=>{await p.evaluate(mode=>{__smear.reset();__smear.manual(false);__smear.tool(mode==='shoot'?1:0);__smear.view(mode==='shoot'?[5,3.3,6]:[4.6,3.4,5.6],[0,.8,-.5]);window.__smearSamples=[];},mode);await p.waitForTimeout(700);},
 action:async p=>{await p.waitForTimeout(350);
  if(mode==='swing'){
   await p.evaluate(()=>__smear.grab(0,'Right foot'));
   for(let i=0;i<130;i++){await p.evaluate(i=>{const t=i*.08;__smear.target([Math.sin(t*1.35)*2.3,.15+Math.max(0,Math.sin(t*1.8))*2.9,.4+Math.cos(t*1.2)*1.8]);},i);if(i%10===0)await p.evaluate(async()=>__smearSamples.push({at:performance.now(),state:await __smear.compute.state()}));await p.waitForTimeout(100);}
   await p.evaluate(()=>__smear.release());
  }else{
   for(const d of [0,1,2]){for(let i=0;i<8;i++){await p.evaluate(async({d,i})=>{const target=await __smear.project(d,i%3===0?'Hips':'Torso');if(target.x<20||target.x>1260||target.y<20||target.y>700)throw Error('Shot target outside capture');__smear.pointer(target.x,target.y);__smear.shoot();__smearSamples.push({at:performance.now(),target,state:await __smear.compute.state()});},{d,i});await p.waitForTimeout(350);}await p.waitForTimeout(350);}
  }
 },
 telemetry:async()=>({state:await __smear.state(),status:__smear.compute.status(),samples:__smearSamples})};

for(const mode of ['swing','shoot'])takes['smear-framed-'+mode]={...takes['smear-'+mode],
 setup:async p=>{await p.evaluate(async mode=>{__smear.reset();__smear.manual(false);if((await __smear.state()).player.mode!=='fly')__smear.fly();__smear.tool(mode==='shoot'?1:0);
  __smear.view(mode==='shoot'?[1.8,2.3,2.8]:[3.3,3.7,4.2],mode==='shoot'?[0,.7,-2]:[0,.9,.4]);window.__smearSamples=[];
 },mode);await p.waitForTimeout(700);}};

takes['smear-close-drag']={...takes['smear-framed-swing'],seconds:14,
 setup:async p=>{await p.evaluate(async()=>{__smear.reset();__smear.manual(false);if((await __smear.state()).player.mode!=='fly')__smear.fly();__smear.tool(0);__smear.view([2.6,3,3.2],[0,.8,.3]);window.__smearSamples=[];});await p.waitForTimeout(700);},
 action:async p=>{await p.waitForTimeout(350);await p.evaluate(()=>__smear.grab(0,'Right foot'));
  for(let i=0;i<105;i++){await p.evaluate(i=>{const t=i*.085;__smear.target([Math.sin(t*1.3)*1.4,.15+Math.max(0,Math.sin(t*1.6))*1.3,.3+Math.cos(t*1.2)*1.1]);},i);if(i%10===0)await p.evaluate(async()=>__smearSamples.push({at:performance.now(),state:await __smear.compute.state()}));await p.waitForTimeout(100);}
  await p.evaluate(()=>__smear.release());
 }};

const pachinkoOriginal=path.join(root,'.local/sources/pachinko/index.html');
const pachinkoCopy=path.join(root,'.local/sources/pachinko/portfolio.html');
const pachinkoHook=`window.__pachinkoCapture={state:()=>({ball:ball?{x:ball.x,y:ball.y,vx:ball.vx,vy:ball.vy}:null,totalScore,particles:particles.length,pegs:pegs.map(p=>({x:p.x,y:p.y,radius:p.radius}))})};\n`;
const pachinkoSource=fs.readFileSync(pachinkoOriginal,'utf8'),pachinkoNeedle='            createBoard();\n            drawMuteButton();';
if(!pachinkoSource.includes(pachinkoNeedle))throw Error('Missing Pachinko export location');
fs.writeFileSync(pachinkoCopy,pachinkoSource.replace(pachinkoNeedle,pachinkoHook+pachinkoNeedle));
for(const side of ['left','right'])takes['pachinko-'+side]={game:'pachinko',url:'/capture/pachinko/portfolio.html',source:pachinkoCopy,seconds:28,
 ready:()=>!!window.__pachinkoCapture,
 setup:async p=>{await p.waitForTimeout(400);await p.evaluate(()=>{window.__pachinkoSamples=[];window.__pachinkoDrops=0;window.__pachinkoStart=performance.now();});},
 action:async p=>{const box=await p.locator('#gameCanvas').boundingBox();
  for(let i=0;i<130;i++){
   const state=await p.evaluate(()=>{const state=__pachinkoCapture.state();__pachinkoSamples.push({at:(performance.now()-__pachinkoStart)/1000,...state});return state;});
   if(!state.ball){const drop=await p.evaluate(()=>__pachinkoDrops++);const x=side==='left'?[.28,.4,.52][drop%3]:[.72,.6,.48][drop%3];await p.mouse.click(box.x+box.width*x,box.y+25);}
   await p.waitForTimeout(190);
  }
 },telemetry:()=>({state:__pachinkoCapture.state(),samples:__pachinkoSamples,drops:__pachinkoDrops})};

takes['sudoku-correct-play']={game:'sudoku',seconds:25,
 ready:()=>typeof game!=='undefined'&&game.scene?.getScene('GameScene')?.emptyCells?.length===48,
 setup:async p=>{await p.waitForTimeout(400);await p.evaluate(()=>{window.__sudokuMoves=[];window.__sudokuBefore=game.scene.getScene('GameScene').board.map(r=>r.slice());});},
 action:async p=>{await p.waitForTimeout(400);const rect=await p.locator('canvas').boundingBox();
  for(let i=0;i<48;i++){
   const move=await p.evaluate(()=>{const s=game.scene.getScene('GameScene'),cell=s.emptyCells[0];if(!cell)return null;const col=Math.floor((cell.x-s.startX)/s.CELL_SIZE),row=Math.floor((cell.y-s.startY)/s.CELL_SIZE);return {row,col,value:s.solution[row][col],x:cell.x,y:cell.y,width:game.canvas.width,height:game.canvas.height};});
   if(!move)break;
   await p.locator('.palette-button[data-key="'+move.value+'"]').click();
   await p.mouse.click(rect.x+move.x/ move.width*rect.width,rect.y+move.y/move.height*rect.height);
   await p.waitForTimeout(360);
   await p.evaluate(move=>{const s=game.scene.getScene('GameScene');if(s.board[move.row][move.col]!==move.value)throw Error('Correct placement did not reach the board');__sudokuMoves.push({...move,at:performance.now(),remaining:s.emptyCells.length});},move);
  }
 },telemetry:()=>{const s=game.scene.getScene('GameScene');return {board:s.board,solution:s.solution,remaining:s.emptyCells.length,won:s.checkWin(),moves:__sudokuMoves};}};

if(require.main===module)run(process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
