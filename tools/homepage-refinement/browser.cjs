/* Actual homepage served over HTTP; Discord responses are isolated fixtures. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const invite='https://discord.gg/0hyoWZyM6y7kkFCN';
const normal={name:"Trent's Cool Developer Spot",presence_count:54,instant_invite:invite,members:[{status:'online',avatar_url:'https://cdn.discordapp.com/embed/avatars/0.png'}]};
const cases=[['online',normal,54],['zero',{...normal,presence_count:0,members:[]},0],['missing-invite',{presence_count:0},0],['missing-members',{...normal,members:null},54],['missing-count',{members:[]},null],['null',null,null],['negative',{presence_count:-1},null],['invalid-count',{presence_count:'0'},null],['bad-json',{},null],['http-error',{},null],['offline',{},null],['timeout',{},null],['untrusted-fields',{...normal,name:'<img src=x onerror="window.injected=true">',instant_invite:'javascript:alert(1)',members:[null,{}, {status:'offline',avatar_url:'https://example.com/x'}]},54]];
const mime={'.js':'text/javascript','.css':'text/css','.png':'image/png','.html':'text/html','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.HOME_CHROME||undefined,args:['--no-sandbox']});
  const results=[];
  try{
    for(const [name,data,count] of cases){
      const ctx=await browser.newContext({viewport:{width:1440,height:1000}});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',async r=>{
        const url=r.request().url();
        if(url.startsWith(origin+'/'))return r.continue();
        if(!url.startsWith('https://discord.com/api/guilds/'))return r.abort();
        if(name==='offline')return r.abort();
        if(name==='timeout'){await new Promise(resolve=>setTimeout(resolve,9000));try{await r.abort();}catch{}return;}
        return r.fulfill({status:name==='http-error'?503:200,contentType:'application/json',body:name==='bad-json'?'{broken':JSON.stringify(data)});
      });
      await page.goto(origin,{waitUntil:'domcontentloaded'});
      const widget=page.locator('#discord-widget-container');
      if(name==='timeout'){
        assert.equal(await widget.locator('.join-button').getAttribute('href'),invite);
        assert.equal(await widget.locator('[role=status]').textContent(),'Loading Discord status...');
      }
      if(count===null)await page.waitForFunction(()=>document.querySelector('#discord-widget-container [role=status]')?.textContent==='Live status unavailable.',{},{timeout:11000});
      else await page.waitForFunction(n=>document.querySelector('.online-count')?.textContent===String(n),count);
      assert.equal(await widget.locator('.join-button').getAttribute('href'),invite);
      assert.equal(await widget.locator('.widget-description').count(),1);
      assert.equal(await widget.locator('.widget-header').count(),1);
      assert.equal(await page.evaluate(()=>!!window.injected),false);
      assert.deepEqual(errors,[],name+' must not raise browser exceptions');
      if(count===null)assert.equal(await widget.locator('.online-count').count(),0,'Unknown is not zero');
      if(name==='zero')assert.equal(await widget.locator('.avatar-wrapper').count(),0);
      if(name==='online'){
        assert.equal(await widget.locator('.avatar-wrapper').count(),1);
        const transform=await widget.locator('.avatar-wrapper').evaluate(n=>n.style.transform);
        await page.waitForTimeout(100);assert.notEqual(await widget.locator('.avatar-wrapper').evaluate(n=>n.style.transform),transform);
      }
      if(name==='untrusted-fields')assert.equal(await widget.locator('.widget-header img').count(),0,'Server name must be text, not markup');
      if(name==='offline'){
        for(const width of [320,390,768,1440]){
          await page.setViewportSize({width,height:1000});
          for(const theme of ['dark','light']){
            await page.locator('#tront-theme-btn').click();await page.locator('#te-preset').selectOption(theme);await page.locator('#tront-theme-editor [data-action=close]').click();
            assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}/${theme}`);
            assert.equal(await page.locator('#about .about-me p').first().evaluate(n=>Math.round(parseFloat(getComputedStyle(n).lineHeight)/parseFloat(getComputedStyle(n).fontSize)*100)),145);
            assert.equal(await page.locator('#about .about-me li').first().evaluate(n=>Math.round(parseFloat(getComputedStyle(n).lineHeight)/parseFloat(getComputedStyle(n).fontSize)*100)),135);
            assert.equal(await page.locator('header img.logo').evaluate(n=>getComputedStyle(n).borderRadius),'0px');
            results.push({layout:width,theme,result:'passed'});
          }
        }
      }
      results.push({case:name,result:'passed'});await ctx.close();
    }
    const nojs=await browser.newContext({javaScriptEnabled:false});const pg=await nojs.newPage();
    await pg.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());await pg.goto(origin);
    assert.equal(await pg.locator('#discord-widget-container .join-button').getAttribute('href'),invite);
    assert.equal(await pg.locator('#discord-widget-container .widget-description').count(),1);results.push({case:'no-javascript',result:'passed'});await nojs.close();
    const file=fs.readFileSync(path.join(__dirname,'og-path.txt'),'utf8').trim();const png=fs.readFileSync(path.join(root,file));
    assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    for(const attr of ['property="og:image"','name="twitter:image"'])assert(html.includes('<meta '+attr+' content="https://tront.xyz/'+file+'">'));
    assert(html.includes('property="og:image:alt"'));assert(html.includes('name="twitter:image:alt"'));
    console.log(JSON.stringify({runner:'actual source over HTTP with Discord fixtures',results,shareImage:file},null,2));
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
