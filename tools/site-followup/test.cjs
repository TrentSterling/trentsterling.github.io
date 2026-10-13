'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {svgMarkers,unavailable,visibleBox,assertPublic,categoryMarkers,repairedPostMarker,CATEGORY_NAMES,FIXED_IMAGE,geometry,GAMES,gamesMarkers}=require('./contract.cjs');
const html=`<button id="sidebar-trigger" aria-label="Menu"><svg width="1.25em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" focusable="false"><path d="M4 6h16M4 12h16M4 18h16"></path></svg></button><button id="search-trigger" aria-label="Search"><svg width="1.25em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 5 5"></path></svg></button>`;
test('extract exact inline SVG marker shapes and attributes',()=>{const m=svgMarkers(html);assert.equal(m['sidebar-trigger'].shapes[0].attrs.d,'M4 6h16M4 12h16M4 18h16');assert.equal(m['search-trigger'].shapes.length,2);});
test('formatting whitespace does not alter marker comparison',()=>assert.deepEqual(svgMarkers(html),svgMarkers(html.replaceAll('><','>\n <'))));
test('font glyph fallback cannot pass SVG marker check',()=>assert.throws(()=>svgMarkers(html.replace(/<svg[\s\S]*?<\/svg>/,'<i class="fas fa-bars"></i>'))));
test('missing accessible control name fails',()=>assert.throws(()=>svgMarkers(html.replace('aria-label="Menu"','aria-label=""'))));
test('proxy page detection includes whitespace',()=>{assert.ok(unavailable('<title>Site Unavailable</title>'));assert.ok(unavailable('SiteUnavailable'));assert.equal(unavailable('Tront Dev'),false);});
test('hidden, zero-size and offscreen anchors are not clickable evidence',()=>{assert.equal(visibleBox({x:390,y:0,width:100,height:20},{width:390,height:844}),false);assert.equal(visibleBox({x:0,y:0,width:0,height:20},{width:390,height:844}),false);assert.ok(visibleBox({x:20,y:100,width:100,height:20},{width:390,height:844}));});
test('HTTP probe destination is exact public origin only',()=>{assertPublic('https://tront.xyz/blog/');for(const u of ['http://tront.xyz/blog/','https://tront.xyz.evil.example/','https://evil.example/','https://user:pass@tront.xyz/'])assert.throws(()=>assertPublic(u));});

test('category index marker requires its heading and all seven known links',()=>{const doc='<h1>Categories</h1>'+CATEGORY_NAMES.map(n=>'<a href="/blog/categories/'+n+'/">'+n+'</a>').join('');assert.equal(categoryMarkers(doc).knownCategoryLinks.length,7);assert.throws(()=>categoryMarkers(doc.replace('/blog/categories/ai/','/wrong/')));});
test('fixed enlargement link cannot retain the broken root variant',()=>{assert.equal(repairedPostMarker('<a href="'+FIXED_IMAGE+'">image</a>').oldWrongRootHrefAbsent,true);assert.throws(()=>repairedPostMarker('<a href="'+FIXED_IMAGE+'">image</a><a href="'+FIXED_IMAGE.replace('/blog/','/')+'">old</a>'));});

function fakeGeometry(rect,fragments,hitTest){
 const keys=['innerWidth','innerHeight','getComputedStyle','document'],saved=Object.fromEntries(keys.map(k=>[k,global[k]]));
 const element={tagName:'A',parentElement:null,getBoundingClientRect:()=>rect,getClientRects:()=>fragments,contains:()=>false,getAttribute:()=>'/tutorials/gemini.html'};
 Object.assign(global,{innerWidth:390,innerHeight:900,getComputedStyle:()=>({display:'inline',visibility:'visible',opacity:'1'}),document:{elementFromPoint:(x,y)=>hitTest(x,y,element)}});
 try{return geometry(element);}finally{for(const k of keys)if(saved[k]===undefined)delete global[k];else global[k]=saved[k];}
}
const rect=(x,y,w,h)=>({x,y,width:w,height:h,left:x,top:y,right:x+w,bottom:y+h});
test('wrapped anchor chooses actual visible text, not the line gap',()=>{
 const first=rect(260,384,43,16),second=rect(260,407,66,16),union=rect(260,384,66,39);
 const result=fakeGeometry(union,[first,second],(x,y,el)=>[first,second].some(r=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)?el:{tagName:'LI'});
 assert.equal(result.centerHitTag,'LI');assert.equal(result.hitTest,true);assert.deepEqual(result.clickPoint,{x:281.5,y:392});
});
test('sidebar-covered mask center chooses uncovered real mask point',()=>{
 const r=rect(0,0,320,844),result=fakeGeometry(r,[r],(x,y,el)=>x<187?{tagName:'ASIDE'}:el);
 assert.equal(result.centerHitTag,'ASIDE');assert.equal(result.hitTest,true);assert.ok(result.clickPoint.x>187);assert.ok(result.triedPoints[0].matched===false);
});
test('fully covered element remains blocked without a forced click',()=>{
 const r=rect(0,0,100,40),result=fakeGeometry(r,[r],()=>({tagName:'ASIDE'}));assert.equal(result.hitTest,false);assert.equal(result.clickPoint,null);
});

function gameFixture(){
 const title=(t,y)=>'<h3 class="card-title">'+t+' <span>('+y+')</span></h3>';
 return '<a class="item">'+title('Project Demigod','2025-Present')+'</a>'+Array.from({length:115},(_,i)=>'<a class="item">'+title('Project '+i,'2026')+'</a>').join('')+'<a class="item tag-prototype"><div id="'+GAMES.cardId+'" data-preview="'+GAMES.video+'"><img src="'+GAMES.poster+'"></div>'+title('Binding of Isaac Clone','2014')+'<p class="blurb">'+GAMES.blurb+'</p></a>';
}
test('Games contract accepts all 117 years and exact Isaac media/blurb',()=>{const m=gamesMarkers(gameFixture());assert.equal(m.yearsPresent,117);assert.equal(m.fullBlurb,GAMES.blurb);});
test('Games contract rejects missing years or shortened Isaac copy',()=>{assert.throws(()=>gamesMarkers(gameFixture().replace('<span>(2026)</span>','')));assert.throws(()=>gamesMarkers(gameFixture().replace(GAMES.blurb,'Shortened.')));});
