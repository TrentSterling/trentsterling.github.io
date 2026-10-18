'use strict';
// Serve exact local bytes at canonical routes. Devlog navigation is intercepted
// as inert HTML; source/independent release review verifies the published target.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium, webkit, request } = require('playwright');
const { personId, products, articles, projectArticles } = require('./author-links.cjs');
const root = path.resolve(__dirname, '../..');
assert.ok(process.env.THEME_BASELINE_ROOT, 'THEME_BASELINE_ROOT is required');
const baseline = path.resolve(process.env.THEME_BASELINE_ROOT);
const out = path.resolve(process.env.THEME_SCREENSHOTS || '.local/theme-review');
fs.mkdirSync(out, { recursive: true });
const origin = 'https://tront.xyz';
const assets = new Map();
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const started = Date.now(), report = { status: 'running', cases: [], interceptedDestinations: [], downloads: 0, runtimeRequests: 0, zoomMethod: 'CSS zoom: 2 reflow stress, not native browser zoom', animationFixture: 'Existing infinite animations paused at time zero on both sources; exact appearance comparisons retained.', fontAssets: [] };
const measure = () => {
  const box = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return { x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,background:s.background,font:s.font }; };
  return { scrollWidth: document.documentElement.scrollWidth, heading: box(document.querySelector('h1')), nav: box(document.querySelector('nav')), actions: [...document.querySelectorAll('a[href="play/"]')].map(a => ({ href:a.getAttribute('href'), ...box(a) })) };
};
(async () => {
  if (process.env.AUTHOR_FONT_CACHE) for (const [url, value] of Object.entries(JSON.parse(fs.readFileSync(process.env.AUTHOR_FONT_CACHE)))) {
    const body = fs.readFileSync(value.file);
    assert.equal(createHash('sha256').update(body).digest('hex'), value.sha256);
    assets.set(url, { body, contentType: value.contentType });
  }
  const client = await request.newContext({ timeout: 20000 });
  const cssUrl = fs.readFileSync(path.join(root, articles[0].file), 'utf8').match(/href="(https:\/\/fonts.googleapis.com\/css2[^"]+)"/)[1];
  async function cache(url, contentType) {
    if (assets.has(url)) return;
    const response = await client.get(url); assert.equal(response.status(), 200, url);
    assets.set(url, { body: await response.body(), contentType: contentType || response.headers()['content-type'] });
  }
  await cache(cssUrl, 'text/css');
  for (const match of assets.get(cssUrl).body.toString().matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) await cache(match[1]);
  // Cache each additional page's authentic font stylesheet, including the
  // Notesdash weight subset, rather than silently exercising fallback fonts.
  for (const article of projectArticles) for (const match of fs.readFileSync(path.join(root, article.file), 'utf8').matchAll(/href="(https:\/\/fonts.googleapis.com\/css2[^"]+)"/g)) {
    await cache(match[1], 'text/css');
    for (const font of assets.get(match[1]).body.toString().matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) await cache(font[1]);
  }
  const logoUrl = origin + '/blog/assets/img/tront.png';
  if (process.env.AUTHOR_BLOG_ROOT) assets.set(logoUrl, { body: fs.readFileSync(path.join(process.env.AUTHOR_BLOG_ROOT, 'assets/img/tront.png')), contentType: 'image/png' });
  else {
    const response = await client.get('https://raw.githubusercontent.com/TrentSterling/blog/2ae3d69c7874755a0448032750c3f1267413431d/assets/img/tront.png');
    assert.equal(response.status(), 200); assets.set(logoUrl, { body: await response.body(), contentType: 'image/png' });
  }
  for (const [url, value] of assets) report.fontAssets.push({ url, sha256: createHash('sha256').update(value.body).digest('hex') });
  await client.dispose();
  const browser = await (process.env.NAV_BROWSER === 'webkit' ? webkit : chromium).launch({ headless: true, executablePath: process.env.NAV_BROWSER_EXECUTABLE || process.env.THEME_BROWSER_EXECUTABLE || undefined });
  async function settle(page) {
    // WebKit disables animation callbacks in no-script contexts.
    if (!page.__noScript) await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    // Compare the same phase of the existing decorative gradient animations.
    // Keep them paused during capture: Playwright's disabled-animation capture
    // cancels/restarts infinite animations, allowing phase drift before measure.
    const states = await page.evaluate(() => document.getAnimations().filter(animation => animation.effect.getTiming().iterations === Infinity).map(animation => {
      animation.pause(); animation.currentTime = 0;
      return { state: animation.playState, time: animation.currentTime };
    }));
    for (const animation of states) { assert.equal(animation.state, 'paused'); assert.equal(animation.time, 0); }
  }
  async function open(source, file, width, zoom = 1, javaScriptEnabled = true) {
    const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, colorScheme:'dark', reducedMotion:'reduce', javaScriptEnabled, serviceWorkers:'block', acceptDownloads:false });
    const errors = [], missing = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (assets.has(url.href)) return route.fulfill(assets.get(url.href));
      if ([...articles, ...projectArticles].some(article => url.href === origin + article.target)) {
        report.interceptedDestinations.push(url.href);
        return route.fulfill({ contentType:'text/html', body:'<!doctype html><title>Intercepted devlog destination</title><p>Local destination fixture only</p>' });
      }
      if (/\/play\//.test(url.pathname)) { report.runtimeRequests++; return route.abort(); }
      if (/\.(exe|zip)$/.test(url.pathname)) { report.downloads++; return route.abort(); }
      if (url.origin !== origin) return route.abort();
      let target = path.resolve(source, '.' + decodeURIComponent(url.pathname));
      assert.ok(target === source || target.startsWith(source + path.sep));
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!fs.existsSync(target)) { missing.push(url.pathname); return route.fulfill({ status:404, body:'Missing fixture' }); }
      return route.fulfill({ body:fs.readFileSync(target), contentType:types[path.extname(target)] || 'application/octet-stream' });
    });
    const page = await context.newPage(); page.__noScript = !javaScriptEnabled; page.on('pageerror', e => errors.push(e.message)); page.on('download', () => report.downloads++);
    await page.goto(origin + '/' + file.replace('index.html',''), { waitUntil:'networkidle' });
    if (zoom !== 1) await page.evaluate(value => document.documentElement.style.zoom = value, zoom);
    return { page, context, errors, missing };
  }
  async function animationParity(before, after) {
    const declarations = () => document.getAnimations().map(animation => {
      const target = animation.effect.target, style = getComputedStyle(target), timing = animation.effect.getTiming();
      return { name: animation.animationName || animation.id, target: { tag:target.tagName,id:target.id,className:target.className },
        timing: { ...timing, iterations:String(timing.iterations) }, keyframes:animation.effect.getKeyframes(),
        css: { name:style.animationName,duration:style.animationDuration,delay:style.animationDelay,direction:style.animationDirection,
          fillMode:style.animationFillMode,iterations:style.animationIterationCount,timingFunction:style.animationTimingFunction,playState:style.animationPlayState } };
    });
    // Inspect the original declarations before either page's animations are paused.
    const original = await before.evaluate(declarations);
    assert.deepEqual(await after.evaluate(declarations),original,'original animation identities and declarations unchanged');
    return original;
  }
  async function screenshot(page, name) { await page.bringToFront(); await settle(page); return page.screenshot({ path:path.join(out, name + '.png'), animations:'allow' }); }
  async function articleState(page, article) {
    const link = page.locator('.page-footer a[href="' + article.target + '"]');
    assert.equal(await link.textContent(), article.label); assert.equal(await link.getAttribute('target'), null);
    assert.equal(await page.locator('a[href="play/"]').count(), 2);
    assert.match(await page.locator('.page-footer p').nth(1).textContent(), /Built by Trent Sterling\./);
    return link;
  }
  const measureProject = () => {
    const box = element => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return { x:rect.x,y:rect.y,width:rect.width,height:rect.height,color:style.color,background:style.background,font:style.font };
    };
    return { scrollWidth:document.documentElement.scrollWidth,heading:box(document.querySelector('h1')),nav:box(document.querySelector('nav')),
      navControls:[...document.querySelectorAll('nav a, nav button')].map(element => ({ text:element.textContent,href:element.getAttribute('href'),...box(element) })),
      primaryControls:[...document.querySelectorAll('a.btn')].map(element => ({ text:element.textContent,href:element.getAttribute('href'),...box(element) })) };
  };
  async function projectFonts(page, article) {
    const state = await page.evaluate(() => ({ status:document.fonts.status,
      body:getComputedStyle(document.body).fontFamily,heading:getComputedStyle(document.querySelector('h1')).fontFamily,
      footer:getComputedStyle(document.querySelector('footer')).fontFamily,
      faces:[...document.fonts].map(font => ({ family:font.family.replace(/['"]/g,''),weight:font.weight,status:font.status })) }));
    assert.equal(state.status,'loaded','normal page fonts have finished loading');
    assert.ok(state.faces.every(font => font.status !== 'error'),'no failed normal font face');
    if (article.file === 'notesdash/index.html') for (const family of ['Inter','Fira Code']) {
      assert.ok(state.faces.some(font => font.family === family && font.status === 'loaded'),family + ' authentic font face loaded');
      assert.equal(await page.evaluate(family => document.fonts.check('400 16px "' + family + '"'),family),true);
    }
    return state;
  }
  async function projectArticleState(page, article, credit) {
    const footer = page.locator('footer'), link = footer.locator('a[href="' + article.target + '"]');
    const anchor='<a href="' + article.target + '"' + (article.color ? ' style="color: ' + article.color + '"' : '') + '>' + article.label + '</a>';
    assert.equal(await footer.count(),1);
    assert.equal(await footer.locator('p').count(),2,'only one contextual footer paragraph added');
    assert.equal(await footer.locator('p').first().evaluate(element => element.outerHTML),credit,'original rendered footer credit unchanged');
    assert.equal(await page.locator('a[href="' + article.target + '"]').count(),1,'exactly one native article anchor');
    assert.equal(await link.evaluate(element => element.outerHTML),anchor);
    assert.equal(await footer.locator('p').nth(1).evaluate(element => element.outerHTML),'<p>' + anchor + '</p>');
    assert.equal(await link.getAttribute('target'),null);
    assert.equal(await link.getAttribute('download'),null);
    assert.equal(await link.evaluate(element => element.href),origin + article.target);
    if(article.color) assert.equal(await link.evaluate(element=>getComputedStyle(element).color),'rgb(' + article.color.slice(1).match(/../g).map(value=>parseInt(value,16)).join(', ') + ')','approved scoped article color is rendered');
    return link;
  }
  async function projectContrast(link, article) {
    const contrast=await link.evaluate(element=>{
      const rgb=color=>color.match(/[\d.]+/g).map(Number),foreground=getComputedStyle(element).color;
      let background='';
      for(let ancestor=element;ancestor;ancestor=ancestor.parentElement) {
        const color=getComputedStyle(ancestor).backgroundColor,channels=rgb(color);
        if(channels.length===3 || channels[3]===1) { background=color;break; }
      }
      const luminance=color=>rgb(color).slice(0,3).map(channel=>channel/255).map(channel=>channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4)
        .reduce((sum,channel,index)=>sum+channel*[0.2126,0.7152,0.0722][index],0);
      const values=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
      return {foreground,background,solidBackgroundRatio:(values[0]+0.05)/(values[1]+0.05)};
    });
    assert.ok(contrast.solidBackgroundRatio>=4.5,'article link has readable normal-text contrast');
    return contrast;
  }
  try {
    for (const file of products) for (const width of [1440,390,320]) {
      const before = await open(baseline,file,width), after = await open(root,file,width);
      const animations = await animationParity(before.page,after.page);
      const name = 'author-' + file.split('/')[0] + '-' + width;
      const imageBefore = await screenshot(before.page,name+'-before'), stateBefore = await before.page.evaluate(measure);
      const imageAfter = await screenshot(after.page,name+'-after');
      assert.deepEqual(await after.page.evaluate(measure),stateBefore,'metadata-only page geometry unchanged');
      assert.deepEqual(imageAfter,imageBefore,'metadata-only page pixels unchanged');
      assert.equal(await after.page.locator('script[type="application/ld+json"]').evaluateAll(nodes => nodes.map(n=>JSON.parse(n.textContent)).find(v=>v['@type']==='SoftwareApplication').author['@id']),personId);
      await after.page.reload({waitUntil:'networkidle'});
      assert.deepEqual(before.errors,[]);assert.deepEqual(after.errors,[]);assert.deepEqual(before.missing,[]);assert.deepEqual(after.missing,[]);
      report.cases.push({ file,width,animations,metadataOnlyPixelIdentical:true,directRouteAndReload:true });
      await before.context.close();await after.context.close();console.log('PASS author identity',file,width);
    }
    for (const article of articles) for (const [width,zoom,javaScriptEnabled] of [[1440,1,true],[375,1,true],[320,1,true],[375,2,true],[320,2,true],[320,1,false]]) {
      const before=await open(baseline,article.file,width,zoom,javaScriptEnabled),after=await open(root,article.file,width,zoom,javaScriptEnabled);
      const animations = await animationParity(before.page,after.page);
      const name='devlog-'+article.file.split('/')[0]+'-'+width+'-'+zoom+'-'+javaScriptEnabled;
      await screenshot(before.page,name+'-top-before');const beforeMeasure=await before.page.evaluate(measure);
      await screenshot(after.page,name+'-top-after');assert.deepEqual(await after.page.evaluate(measure),beforeMeasure,'existing heading, navigation and primary play controls unchanged');
      await before.page.locator('.page-footer').evaluate(e=>e.scrollIntoView({behavior:'instant',block:'end'}));await screenshot(before.page,name+'-footer-before');
      await after.page.bringToFront();
      // Set up the footer-level interaction without relying on smooth scroll
      // animation callbacks in a no-script WebKit context.
      await after.page.locator('.page-footer').evaluate(e=>e.scrollIntoView({behavior:'instant',block:'end'}));
      let link=await articleState(after.page,article);
      await after.page.locator('.page-footer a[href="https://tront.xyz/discord/"]').focus();await after.page.keyboard.press('Tab');
      assert.equal(await link.evaluate(a=>document.activeElement===a),true,'native Tab reaches appended article');
      // Verify native focus visibility within the footer viewport.
      await screenshot(after.page,name+'-footer-after');
      const focus=await link.evaluate(a=>{const s=getComputedStyle(a),range=document.createRange();range.selectNodeContents(a);return{visible:a.matches(':focus-visible'),outline:s.outlineStyle,outlineWidth:parseFloat(s.outlineWidth),viewport:{width:innerWidth,height:innerHeight},rects:[...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}))};});
      assert.ok(focus.visible);assert.notEqual(focus.outline,'none');assert.ok(focus.outlineWidth>0);assert.ok(focus.rects.length>0);
      for(const rect of focus.rects){assert.ok(rect.width>0 && rect.height>0);assert.ok(rect.left>=-1 && rect.right<=width+1,'every wrapped article text segment is horizontally visible');assert.ok(rect.top>=0 && rect.bottom<=focus.viewport.height+1,'focused article remains in viewport');}
      await Promise.all([after.page.waitForURL(origin+article.target),after.page.keyboard.press('Enter')]);
      await after.page.goBack({waitUntil:'networkidle'});await articleState(after.page,article);
      await after.page.reload({waitUntil:'networkidle'});await articleState(after.page,article);
      assert.deepEqual(before.errors,[]);assert.deepEqual(after.errors,[]);assert.deepEqual(before.missing,[]);assert.deepEqual(after.missing,[]);
      report.cases.push({file:article.file,width,zoom,javaScriptEnabled,animations,unchangedPrimaryGeometry:true,keyboard:focus,backAndReload:true});
      await before.context.close();await after.context.close();console.log('PASS contextual devlog',article.file,width,zoom,javaScriptEnabled);
    }
    assert.equal(report.interceptedDestinations.length,12);assert.equal(report.downloads,0);assert.equal(report.runtimeRequests,0);
    const projectCases = [[1440,1,true],[390,1,true],[320,1,true],[320,2,true],[320,1,false]];
    for (const article of projectArticles) {
      for (const source of [baseline,root]) assert.equal(fs.readFileSync(path.join(source,article.file),'utf8').split(article.credit).length,2,'original footer credit source retained exactly once');
      for (const [width,zoom,javaScriptEnabled] of projectCases) {
        const before=await open(baseline,article.file,width,zoom,javaScriptEnabled),after=await open(root,article.file,width,zoom,javaScriptEnabled);
        const animations=await animationParity(before.page,after.page);
        const name='project-devlog-'+article.file.split('/')[0]+'-'+width+'-'+zoom+'-'+javaScriptEnabled;
        await screenshot(before.page,name+'-top-before');const beforeMeasure=await before.page.evaluate(measureProject);
        await screenshot(after.page,name+'-top-after');
        assert.ok(beforeMeasure.primaryControls.length>0,'real primary actions are measured');
        assert.deepEqual(await after.page.evaluate(measureProject),beforeMeasure,'existing heading, navigation and primary action geometry unchanged');
        const fonts=await projectFonts(after.page,article);
        assert.deepEqual(fonts,await projectFonts(before.page,article),'normal font state unchanged');
        const baselineLinks=await before.page.locator('footer a[href="' + article.target + '"]').count();
        assert.ok(baselineLinks===0 || baselineLinks===1,'baseline has zero or one reviewed article link');
        assert.equal(await before.page.locator('footer p').count(),1+baselineLinks,'baseline has only its original credit and optional reviewed addition');
        const credit=await before.page.locator('footer p').first().evaluate(element=>element.outerHTML);
        if(baselineLinks) await projectArticleState(before.page,article,credit);
        await before.page.locator('footer').evaluate(element=>element.scrollIntoView({behavior:'instant',block:'end'}));
        await screenshot(before.page,name+'-footer-before');
        await after.page.bringToFront();
        await after.page.locator('footer').evaluate(element=>element.scrollIntoView({behavior:'instant',block:'end'}));
        const link=await projectArticleState(after.page,article,credit);
        const contrast=await projectContrast(link,article);
        await after.page.locator('footer p').first().locator('a').focus();await after.page.keyboard.press('Tab');
        assert.equal(await link.evaluate(element=>document.activeElement===element),true,'native Tab reaches the appended project article');
        await screenshot(after.page,name+'-footer-after');
        const focus=await link.evaluate(element=>{
          const style=getComputedStyle(element),range=document.createRange();range.selectNodeContents(element);
          const rects=range=>[...range.getClientRects()].map(rect=>({left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height}));
          const footerText=[],walker=document.createTreeWalker(element.closest('footer'),NodeFilter.SHOW_TEXT);
          while(walker.nextNode()) if(walker.currentNode.textContent.trim() && walker.currentNode.parentElement.tagName!=='SCRIPT') {
            const textRange=document.createRange();textRange.selectNodeContents(walker.currentNode);footerText.push(...rects(textRange));
          }
          return {visible:element.matches(':focus-visible'),outline:style.outlineStyle,outlineWidth:parseFloat(style.outlineWidth),
            viewport:{width:innerWidth,height:innerHeight},rects:rects(range),footerText};
        });
        assert.ok(focus.visible);assert.notEqual(focus.outline,'none');assert.ok(focus.outlineWidth>0);assert.ok(focus.rects.length>0);
        for(const rect of [...focus.rects,...focus.footerText]) {
          assert.ok(rect.width>0 && rect.height>0);
          assert.ok(rect.left>=-1 && rect.right<=width+1,'every wrapped footer text segment is horizontally visible');
          assert.ok(rect.top>=0 && rect.bottom<=focus.viewport.height+1,'all focused footer text remains in the viewport');
        }
        const destinationCount=report.interceptedDestinations.length;
        await Promise.all([after.page.waitForURL(origin+article.target),after.page.keyboard.press('Enter')]);
        assert.equal(report.interceptedDestinations.length,destinationCount+1,'native Enter reaches the inert destination exactly once');
        assert.equal(report.interceptedDestinations.at(-1),origin+article.target);
        assert.equal(await after.page.title(),'Intercepted devlog destination');
        await after.page.goBack({waitUntil:'networkidle'});await projectArticleState(after.page,article,credit);
        await after.page.reload({waitUntil:'networkidle'});await projectArticleState(after.page,article,credit);
        assert.deepEqual(before.errors,[]);assert.deepEqual(after.errors,[]);assert.deepEqual(before.missing,[]);assert.deepEqual(after.missing,[]);
        report.cases.push({file:article.file,width,zoom,javaScriptEnabled,animations,unchangedPrimaryGeometry:true,unchangedFooterCredit:true,
          exactNativeArticle:true,normalFonts:fonts,contrast,keyboard:focus,directRouteAndReload:true,backAndReload:true});
        await before.context.close();await after.context.close();console.log('PASS project contextual devlog',article.file,width,zoom,javaScriptEnabled);
      }
    }
    assert.equal(report.interceptedDestinations.length,12+projectArticles.length*projectCases.length);
    assert.equal(report.downloads,0);assert.equal(report.runtimeRequests,0);report.status='passed';
  } catch(error){report.status='failed';report.error=error.stack;throw error;}
  finally{report.durationMs=Date.now()-started;fs.writeFileSync(path.join(out,'author-links-report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
