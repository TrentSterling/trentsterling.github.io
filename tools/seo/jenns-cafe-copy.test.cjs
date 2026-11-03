'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {normalize}=require('./copy-review.cjs');
const root=path.resolve(__dirname,'../..');
test('historical cafe copy describes building, not itch metadata or an unimplemented service loop',()=>{
  const html=fs.readFileSync(path.join(root,'games/index.html'),'utf8');
  const old='Cafe game prototype from 2017. The itch page still says the build is incoming.';
  const replacement='A restaurant-building prototype I made for Jennifer, inspired by The Sims and Diner Dash. Arrange furniture, stack props, and save your cafe layout.';
  assert.equal(html.split(replacement).length-1,1);
  assert.ok(!html.includes(old));
  const card=[...html.matchAll(/<a\b[^>]*class="item\b[^>]*>[\s\S]*?<\/a>/g)].map(m=>m[0]).find(s=>s.includes('https://trent.itch.io/jenns-cafe'));
  assert.ok(card);
  assert.ok(card.includes("Jenn's Cafe <span>(2017)</span>"));
  assert.ok(card.includes('preview-jenn-s-cafe-2017'));
  assert.ok(card.includes(replacement));
  assert.ok(!/manage staff|customer satisfaction|build is incoming/i.test(card));
  if(process.env.THEME_BASELINE_ROOT){
    const original=fs.readFileSync(path.join(process.env.THEME_BASELINE_ROOT,'games/index.html'),'utf8');
    assert.equal(normalize(html,'games/index.html'),normalize(original,'games/index.html'));
  }
});
