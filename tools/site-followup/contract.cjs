'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const HOST = 'https://tront.xyz';
const TUTORIAL_BASELINE = 'cab52f2e322bb478aa13b198a446451604c6dc7b';
const TUTORIAL_CANDIDATE = '279510283f8519f7fa4a36adf2ebf02151075616';
const GEMINI_MARKDOWN_SHA256 = '204c34e887d2df8fcce5be1329fb8c34043d7da2b397f76addd868cbff4fda71';
const BLOG_RELEASE = '7f0471eba88b129331ae13404876f621ec62db37';
const BLOG_SVG_SOURCE = '7f0471eba88b129331ae13404876f621ec62db37';
const FIXED_IMAGE = '/blog/assets/img/better_performance_lower_memory_shits_working.jpg';
const FIXED_POST = '/blog/posts/away3dlite-and-new-recording-software/';
const CATEGORY_NAMES = ['ai','devblog','experiments','hardware','personal','projects','tools'];
const GAMES = Object.freeze({
  htmlSha256:'f2c528e17ad3347d60f604d88e436a49449fa1fcb07c38d28511c0f18d15dbf5',
  cardId:'preview-binding-of-isaac-clone-2014',
  title:'Binding of Isaac Clone (2014)',
  blurb:'Twitch-streamed prototype of a Binding of Isaac-like dungeon crawler with procedural generation.',
  video:'/games/media/binding-of-isaac-clone-2014.mp4?v=898704224836',
  poster:'/games/media/binding-of-isaac-clone-2014.webp?v=cdb245371a48',
  files:{
    '/games/media/binding-of-isaac-clone-2014.mp4?v=898704224836':{bytes:325535,sha256:'898704224836c8e1ea4c39048de153acba6ae93586987a8026237d9cab5d6c4b',type:'video/mp4'},
    '/games/media/binding-of-isaac-clone-2014.webp?v=cdb245371a48':{bytes:20240,sha256:'cdb245371a4877dd5d406293428cce52623a2c2cc3a713e3e4e39d8130ae8879',type:'image/webp'}
  }
});
function gamesMarkers(html) {
  const titles=[...html.matchAll(/<h3\b[^>]*class="card-title"[^>]*>([\s\S]*?)<\/h3>/g)].map(m=>m[1]);
  assert.equal(titles.length,117,'all 117 gallery cards remain');
  const years=titles.map(title=>title.match(/<span>\((\d{4}(?:-(?:\d{4}|Present))?)\)<\/span>/)?.[1]);
  assert.ok(years.every(Boolean),'all 117 cards have year/range labels');
  assert.match(titles[0],/^Project Demigod /,'Project Demigod remains first');
  const card=[...html.matchAll(/<a\b[^>]*class="item\b[^>]*>[\s\S]*?<\/a>/g)].map(m=>m[0]).find(c=>c.includes('id="'+GAMES.cardId+'"'));
  assert.ok(card,'Isaac card exists');assert.ok(card.includes('Binding of Isaac Clone <span>(2014)</span>'));assert.ok(card.includes('<p class="blurb">'+GAMES.blurb+'</p>'));
  assert.ok(card.includes('data-preview="'+GAMES.video+'"'));assert.ok(card.includes('src="'+GAMES.poster+'"'));
  return{cards:titles.length,yearsPresent:years.length,isaacTitle:GAMES.title,fullBlurb:GAMES.blurb,video:GAMES.video,poster:GAMES.poster};
}
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const gitBlob = data => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${data.length}\0`), data])).digest('hex');
function tutorialDiff(before, after) {
  const old = '<a href="/tutorials/gemini/">Project Roadmap</a>';
  const next = '<a href="/tutorials/gemini.html">Project Roadmap</a>';
  assert.equal(gitBlob(before), 'd46b1246914496d8a856bd244775c46a99788c34', 'exact tutorial baseline blob');
  assert.equal(gitBlob(after), '7daa337d20726f51aede9f90de1704c0951ad05b', 'exact href-plus-gemini-only candidate blob');
  assert.equal(before.toString().split(old).length, 2);
  const expected=before.toString().replace(old,next)
    .replace('fetch(`${id}/README.md`)',"fetch(id === 'gemini' ? 'gemini.md' : `${id}/README.md`)")
    .replace("document.querySelector('main').scrollTop = 0;\n\n                try {","document.querySelector('main').scrollTop = 0;\n\n                if (id === 'gemini') return;\n\n                try {");
  assert.equal(after.toString(),expected,'only the approved href, gemini Markdown path and no-demo guard differ');
  for (const pattern of [/preventDefault\s*\(/, /addEventListener\s*\(\s*['"]click['"]/, /\.onclick\s*=/, /\sonclick\s*=/i, /<base\b/i]) assert.equal(pattern.test(after.toString()), false, 'no generic navigation interception');
  return {baselineCommit:TUTORIAL_BASELINE,candidateCommit:TUTORIAL_CANDIDATE,baselineBlob:gitBlob(before),candidateBlob:gitBlob(after),baselineSha256:sha256(before),candidateSha256:sha256(after),exactAllowedChanges:true,changes:['static Roadmap href','gemini-only root Markdown fetch','gemini-only early return before demo fetch']};
}
function attributes(tag) {
  const result = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) result[m[1].toLowerCase()] = m[2] ?? m[3];
  return result;
}
function svgMarkers(html) {
  const result = {};
  for (const [id, label] of [['sidebar-trigger','Menu'],['search-trigger','Search']]) {
    const block = html.match(new RegExp(`<button\\b[^>]*\\bid=["']${id}["'][^>]*>[\\s\\S]*?<\\/button>`, 'i'))?.[0];
    assert.ok(block, `raw HTML includes ${id}`);
    const button = attributes(block.match(/<button\b[^>]*>/i)[0]);
    assert.equal(button['aria-label'], label);
    const svg = block.match(/<svg\b[^>]*>/i)?.[0];assert.ok(svg, `${id} contains inline SVG in raw response`);
    const a = attributes(svg);
    assert.equal(a['aria-hidden'],'true');assert.equal(a.focusable,'false');assert.equal(a.stroke,'currentColor');
    const shapes = [...block.matchAll(/<(path|circle)\b[^>]*>/gi)].map(m=>({tag:m[1].toLowerCase(),attrs:attributes(m[0])}));
    assert.ok(shapes.length);
    result[id]={label,svg:a,shapes};
  }
  return result;
}
function categoryMarkers(html) {
  const h1s=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>m[1].replace(/<[^>]*>/g,'').trim());
  assert.equal(h1s.filter(t=>t==='Categories').length,1,'exactly one Categories heading');
  const hrefs=[...html.matchAll(/<a\b[^>]*>/gi)].map(m=>attributes(m[0]).href);
  const links=CATEGORY_NAMES.map(name=>'/blog/categories/'+name+'/');
  for(const href of links)assert.ok(hrefs.includes(href),'category index links '+href);
  return{h1:'Categories',knownCategoryLinks:links};
}
function repairedPostMarker(html) {
  const hrefs=[...html.matchAll(/<a\b[^>]*>/gi)].map(m=>attributes(m[0]).href);
  assert.ok(hrefs.includes(FIXED_IMAGE),'fixed image enlargement destination exists in the post');
  assert.equal(hrefs.includes(FIXED_IMAGE.replace('/blog/','/')),false,'old wrong-root enlargement destination is absent');
  return{fixedHref:FIXED_IMAGE,oldWrongRootHrefAbsent:true};
}
function unavailable(text) {return /site\s*unavailable|this\s+site\s+is\s+currently\s+unavailable/i.test(text.slice(0,3000));}
// This function is serialized into the page by Playwright. It is self-contained.
// It observes real text fragments and hit targets; it never scrolls or clicks.
function geometry(element) {
  const rect=element.getBoundingClientRect(),css=getComputedStyle(element),vp={width:innerWidth,height:innerHeight};
  let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};const ancestors=[];
  for(let p=element.parentElement;p;p=p.parentElement){
    const s=getComputedStyle(p),r=p.getBoundingClientRect();
    if(/hidden|clip|scroll|auto/.test(s.overflowX)){clip.left=Math.max(clip.left,r.left);clip.right=Math.min(clip.right,r.right);}
    if(/hidden|clip|scroll|auto/.test(s.overflowY)){clip.top=Math.max(clip.top,r.top);clip.bottom=Math.min(clip.bottom,r.bottom);}
    if(/hidden|clip/.test(s.overflowX+' '+s.overflowY))ancestors.push({tag:p.tagName,id:p.id,className:p.className,overflowX:s.overflowX,overflowY:s.overflowY,rect:[r.x,r.y,r.width,r.height]});
  }
  const inside=rect.width>0&&rect.height>0&&rect.left>=clip.left&&rect.top>=clip.top&&rect.right<=clip.right&&rect.bottom<=clip.bottom;
  const styled=css.display!=='none'&&css.visibility==='visible'&&Number(css.opacity)>0;
  const fragments=[...element.getClientRects()].map(r=>({x:r.x,y:r.y,width:r.width,height:r.height,left:r.left,top:r.top,right:r.right,bottom:r.bottom}));
  const triedPoints=[];let clickPoint=null;
  for(const r of fragments){
    const left=Math.max(r.left,clip.left),right=Math.min(r.right,clip.right),top=Math.max(r.top,clip.top),bottom=Math.min(r.bottom,clip.bottom);
    if(right<=left||bottom<=top)continue;
    // Text-fragment centers first; then exposed regions of large masks.
    for(const[fx,fy]of[[.5,.5],[.75,.5],[.25,.5],[.9,.5],[.1,.5],[.5,.25],[.5,.75],[.9,.25],[.9,.75]]){
      const x=left+(right-left)*fx,y=top+(bottom-top)*fy,hit=document.elementFromPoint(x,y),matched=!!hit&&(hit===element||element.contains(hit));
      triedPoints.push({x,y,hitTag:hit?.tagName||null,hitId:hit?.id||null,matched});
      if(styled&&matched){clickPoint={x,y};break;}
    }
    if(clickPoint)break;
  }
  const center=inside?document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2):null;
  return{rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},viewport:vp,clip,styled,inside,hitTest:!!clickPoint,clickPoint,centerHitTag:center?.tagName||null,fragments,triedPoints,clippingAncestors:ancestors,href:element.getAttribute('href')};
}
function visibleBox(box, viewport) {return Boolean(box && box.width>0 && box.height>0 && box.x>=0 && box.y>=0 && box.x+box.width<=viewport.width && box.y+box.height<=viewport.height);}
function assertPublic(url) {const u=new URL(url);assert.equal(u.origin,HOST);assert.equal(u.username,'');assert.equal(u.password,'');return u;}
module.exports={HOST,TUTORIAL_BASELINE,TUTORIAL_CANDIDATE,BLOG_RELEASE,BLOG_SVG_SOURCE,GEMINI_MARKDOWN_SHA256,FIXED_IMAGE,FIXED_POST,CATEGORY_NAMES,GAMES,gamesMarkers,categoryMarkers,repairedPostMarker,sha256,gitBlob,tutorialDiff,svgMarkers,unavailable,geometry,visibleBox,assertPublic};
