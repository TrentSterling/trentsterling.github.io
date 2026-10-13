'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const HOST = 'https://tront.xyz';
const TUTORIAL_BASELINE = 'cab52f2e322bb478aa13b198a446451604c6dc7b';
const TUTORIAL_CANDIDATE = 'f46659445e27f821f859d5aae9180ace3f415bac';
const BLOG_RELEASE = '7f0471eba88b129331ae13404876f621ec62db37';
const BLOG_SVG_SOURCE = '7f0471eba88b129331ae13404876f621ec62db37';
const FIXED_IMAGE = '/blog/assets/img/better_performance_lower_memory_shits_working.jpg';
const FIXED_POST = '/blog/posts/away3dlite-and-new-recording-software/';
const CATEGORY_NAMES = ['ai','devblog','experiments','hardware','personal','projects','tools'];
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const gitBlob = data => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${data.length}\0`), data])).digest('hex');
function tutorialDiff(before, after) {
  const old = '<a href="/tutorials/gemini/">Project Roadmap</a>';
  const next = '<a href="/tutorials/gemini.html">Project Roadmap</a>';
  assert.equal(gitBlob(before), 'd46b1246914496d8a856bd244775c46a99788c34', 'exact tutorial baseline blob');
  assert.equal(gitBlob(after), 'aad95ed0233835dff5d7a6c0b6276955e0c92065', 'exact one-href candidate blob');
  assert.equal(before.toString().split(old).length, 2);
  assert.equal(after.toString(), before.toString().replace(old, next), 'only the approved href differs');
  for (const pattern of [/preventDefault\s*\(/, /addEventListener\s*\(\s*['"]click['"]/, /\.onclick\s*=/, /\sonclick\s*=/i, /<base\b/i]) assert.equal(pattern.test(after.toString()), false, 'no generic navigation interception');
  return {baselineCommit:TUTORIAL_BASELINE,candidateCommit:TUTORIAL_CANDIDATE,baselineBlob:gitBlob(before),candidateBlob:gitBlob(after),baselineSha256:sha256(before),candidateSha256:sha256(after),onlyHrefChanged:true};
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
function visibleBox(box, viewport) {return Boolean(box && box.width>0 && box.height>0 && box.x>=0 && box.y>=0 && box.x+box.width<=viewport.width && box.y+box.height<=viewport.height);}
function assertPublic(url) {const u=new URL(url);assert.equal(u.origin,HOST);assert.equal(u.username,'');assert.equal(u.password,'');return u;}
module.exports={HOST,TUTORIAL_BASELINE,TUTORIAL_CANDIDATE,BLOG_RELEASE,BLOG_SVG_SOURCE,FIXED_IMAGE,FIXED_POST,CATEGORY_NAMES,categoryMarkers,repairedPostMarker,sha256,gitBlob,tutorialDiff,svgMarkers,unavailable,visibleBox,assertPublic};
