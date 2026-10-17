'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../404.html'),'utf8');

test('404 uses shared Color Magic with the same site palette key',()=>{
  assert.match(html,/<html[^>]*data-tront-theme-editor[^>]*data-tront-theme-surface="grid"/);
  for (const asset of ['/assets/css/tront-theme-editor.css','/assets/css/tront-navbar.css','/assets/js/tront-system.js','/assets/js/tront-theme-editor.js'])
    assert.ok(html.includes('="'+asset+'"'),'missing shared asset: '+asset);
  assert.doesNotMatch(html,/\/assets\/js\/tront-theme\.js/);
  assert.ok(html.indexOf('/assets/js/tront-system.js')<html.indexOf('/assets/js/tront-theme-editor.js'));
  assert.match(html,/<button id="tront-theme-btn"[^>]*type="button" hidden>/);
  assert.match(html,/<main\s+id="main"/);
  assert.match(html,/<meta name="robots" content="noindex, follow">/);
});
test('404 keeps case-sensitive route recovery and proper navigation',()=>{
  const start=html.indexOf('var ROUTES ='),end=html.indexOf('</script>',start);
  assert.ok(start>=0 && end>start);
  const recovery=html.slice(start,end);
  for(const route of ['spaceview','craftmine','eos-native','tutorials','games'])assert.ok(recovery.includes('"'+route+'"'),route);
  assert.match(recovery,/MAP\[first\.toLowerCase\(\)\]/);
  assert.match(recovery,/location\.replace\(parts\.join\("\/"\) \+ location\.search \+ location\.hash\)/);
  for(const url of ['/', '/games/', '/blog/', '/discord/'])assert.ok(html.includes('href="'+url+'"'));
});
