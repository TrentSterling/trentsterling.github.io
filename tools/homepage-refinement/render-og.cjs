'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.HOME_CHROME||undefined,args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
    await page.route('**/*',r=>r.abort());
    const portrait=fs.readFileSync(path.join(root,'blog/assets/img/tront.png')).toString('base64');
    const html=fs.readFileSync(path.join(__dirname,'og-card.html'),'utf8').replace('../../blog/assets/img/tront.png','data:image/png;base64,'+portrait);
    await page.setContent(html);
    await page.waitForFunction(()=>document.images[0].complete&&document.images[0].naturalWidth>0);
    await page.evaluate(()=>document.fonts.ready);
    const png=await page.screenshot();
    const digest=crypto.createHash('sha256').update(png).digest('hex').slice(0,12);
    const file='assets/og/home-'+digest+'.png';
    fs.mkdirSync(path.join(root,'assets/og'),{recursive:true});fs.writeFileSync(path.join(root,file),png);
    fs.writeFileSync(path.join(__dirname,'og-path.txt'),file+'\n');
    console.log(file,png.length);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
