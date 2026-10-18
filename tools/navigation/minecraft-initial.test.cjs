'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {file,tokens,options,css,emptyNav,staticNav,oldRuntime,newRuntime,normalize,defectControl}=require('./minecraft-initial.cjs');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,file),'utf8');
const output={},attributes={};
const context={window:{},document:{documentElement:{style:{setProperty:(key,value)=>output[key]=value},setAttribute:(key,value)=>attributes[key]=value}}};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/js/tront-system.js'),'utf8'),context);
context.window.Tront.applyTheme('#17dd62',true);
test('Minecraft static emerald tokens equal every unchanged engine token',()=>{
 assert.deepEqual(output,tokens);assert.deepEqual(attributes,{'data-mode':'dark'});
 assert.equal(html.split(css).length,2);assert.ok(html.indexOf(css)<html.indexOf('</head>'));
 const parsed=Object.fromEntries([...css.matchAll(/(--[a-z-]+):(#[a-f0-9]{6})/g)].map(m=>[m[1],m[2]]));assert.deepEqual(parsed,tokens);
 assert.ok(html.includes('<html lang="en" data-mode="dark">'));
});
test('prerendered product navigation equals the unchanged central registry output',()=>{
 assert.equal(staticNav,'<nav id="nav" class="t-nav t-nav--product" aria-label="Page">'+context.window.Tront.nav(options)+'</nav>');
 assert.equal(html.split(staticNav).length,2);assert.equal(html.includes(emptyNav),false);
 assert.equal(html.includes(oldRuntime),false);assert.equal(html.split(newRuntime).length,2);
 assert.doesNotMatch(html,/Tront\.mountNav|localStorage\.getItem\(['"]tront-theme|tront-theme\.js|tront-theme-editor\.js/);
 for(const link of options.links.filter(link=>link.href.startsWith('#')))assert.ok(html.includes('id="'+link.href.slice(1)+'"'));
 assert.ok(fs.existsSync(path.join(root,'minecraft-modding/trontmod-template.zip')));
});
test('Minecraft preserves every other byte, including tutorial text, fonts, scripts and media references',()=>{
 assert.ok(process.env.THEME_BASELINE_ROOT);const before=fs.readFileSync(path.join(process.env.THEME_BASELINE_ROOT,file),'utf8');
 assert.equal(normalize(html,file),normalize(before,file));
});
test('exact initial-render normalization never masks palette, nav or script drift',()=>{
 const plain=normalize(html,file);assert.equal(normalize(html+'changed',file),plain+'changed');assert.equal(normalize(html,'other.html'),html);
 for(const part of [css,staticNav,newRuntime]){assert.throws(()=>normalize(html+part,file),/duplicate/);assert.notEqual(normalize(html.replace(part,part+'changed'),file),plain);}
 for(const [from,to] of [['--bg:#011405','--bg:#000000'],['>The sword</a>','>Changed</a>'],['href="#lesson-4"','href="#lesson-8"'],["'#17dd62'","'#ffffff'"]])assert.notEqual(normalize(html.replace(from,to),file),plain);
});
test('CI runs initial-render controls and retains observation-free video evidence',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/site-checks.yml'),'utf8');
 assert.ok(workflow.includes('node tools/navigation/minecraft-initial-browser.cjs'));
 assert.ok(workflow.includes('install ffmpeg'));
 assert.ok(workflow.includes('.local/theme-review/*.webm'));
});

test('the reusable negative control reverses only the three reviewed regions and validates its input',()=>{
 const expected=html.replace(css,'').replace(staticNav,emptyNav).replace(newRuntime,oldRuntime);
 assert.equal(defectControl(html),expected);
 for(const part of[css,staticNav,newRuntime]){assert.throws(()=>defectControl(html.replace(part,'')));assert.throws(()=>defectControl(html+part));}
 assert.equal(defectControl(html+'outside unchanged'),expected+'outside unchanged');
 const browser=fs.readFileSync(path.join(root,'tools/navigation/minecraft-initial-browser.cjs'),'utf8');
 assert.ok(browser.includes("assert.deepEqual(a.state,b.state,'already-fixed actual PR base retains identical initial appearance')"));
 assert.ok(browser.includes("negative control reproduces missing navigation"));
 assert.ok(browser.includes("negative control reproduces fallback palette"));
});
