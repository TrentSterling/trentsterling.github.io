'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {summarize}=require('./summarize.cjs');
const data=frames=>({paints:[{name:'first-contentful-paint',startTime:20}],frames,shifts:[],fontsStatus:'loaded',sampleCapReached:false});
const frame=(t,nav,more={})=>({t,visible:true,nav,body:{color:'white'},...more});
test('changes before FCP do not count as a painted flash',()=>{
 const r=summarize(data([frame(1,['old']),frame(21,['new']),frame(30,['new'])]));assert.equal(r.status,'no-observed-delta');
});
test('visible navbar geometry changes are retained with both endpoints',()=>{
 const r=summarize(data([frame(21,[{x:10}]),frame(30,[{x:20}])]));assert.equal(r.status,'review-delta');assert.equal(r.deltas.nav.before[0].x,10);
});
test('hidden initial content is not called a flash',()=>{
 const r=summarize(data([frame(21,['old'],{visible:false}),frame(30,['new'])]));assert.equal(r.status,'no-observed-delta');
});
test('Games native fade alone does not fail appearance comparison',()=>{
 const r=summarize(data([frame(21,['same'],{opacity:'0.1'}),frame(30,['same'],{opacity:'1'})]));assert.equal(r.status,'no-observed-delta');
});
test('missing visible data remains inconclusive',()=>assert.equal(summarize(data([])).status,'inconclusive-no-visible-frame'));
test('late Games card accents are explicit deltas',()=>{
 const r=summarize(data([frame(21,['same'],{cardAccents:[{accent:''}]}),frame(30,['same'],{cardAccents:[{accent:'#abc'}]})]));assert.ok(r.deltas.cardAccents);
});
test('classifier reports available samples without claiming every frame',()=>{
 const r=summarize({...data([frame(25,['same'])]),sampleCapReached:true,fontsStatus:'loading'});assert.equal(r.sampleCapReached,true);assert.equal(r.fontsStatus,'loading');assert.ok(r.notes.length);
});

test('single intermediate bad frame is caught even if first and last match',()=>{
 const r=summarize(data([frame(21,['same']),frame(22,['flash']),frame(23,['same'])]));assert.equal(r.status,'review-delta');assert.equal(r.deltas.nav.changes.length,2);
});

const {isIntermediary,applyReadiness}=require('./readiness.cjs');
test('known 195-byte Site Unavailable intermediary is never a passing site response',()=>{
 const body='<html><title>Site Unavailable</title><body>Site Unavailable</body></html>'.padEnd(195,' ');
 assert.equal(Buffer.byteLength(body),195);assert.equal(isIntermediary(body),true);assert.equal(isIntermediary('SiteUnavailable'),true);
 assert.equal(applyReadiness({status:'no-observed-delta'},{text:body,status:200}).status,'blocked-or-incomplete');
});
test('failed critical dependency prevents a clean visual verdict',()=>{
 assert.equal(applyReadiness({status:'no-observed-delta'},{criticalFailures:[{type:'stylesheet',status:404}]}).status,'blocked-or-incomplete');
});
test('unsettled fonts are explicit and cannot produce a clean verdict',()=>{
 const r=applyReadiness({status:'no-observed-delta'},{fontsStatus:'loading'});assert.equal(r.unsettledFonts,true);assert.equal(r.status,'inconclusive-fonts-unsettled');
});
