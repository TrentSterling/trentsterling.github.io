'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { files, block, buttonBefore, buttonAfter, normalize, assertResponsive } = require('./legacy-navbar.cjs');
const { block: deviceBlock } = require('./device-responsive.cjs');
const root = path.resolve(__dirname, '../..');
const read = (file, source = root) => fs.readFileSync(path.join(source, file), 'utf8');
for (const file of files) test(file + ': only the exact responsive block and action name change', () => {
  const base = process.env.THEME_BASELINE_ROOT;
  assert.ok(base, 'THEME_BASELINE_ROOT identifies the actual PR base');
  const html = read(file), before = read(file, base);
  assertResponsive(html);
  assert.equal(normalize(html, file), normalize(before, file), 'all other HTML/CSS/metadata/copy remains exact');
  assert.equal(normalize(normalize(html, file), file), normalize(html, file), 'already-normalized source is stable');
  const nav = html.match(/<nav id="magic-navbar-container">[\s\S]*?<\/nav>/)[0];
  assert.deepEqual([...nav.matchAll(/<a href="([^"]+)"/g)].map(match => match[1]), ['/discord/', '/blog/', '/games/', '/']);
  assert.equal(nav.split(buttonAfter).length, 2);
  assert.equal(nav.includes(buttonBefore), false);
  assert.ok(html.indexOf(block) < html.indexOf('</style>'), 'override stays inside the existing page stylesheet');
});
test('the page-local geometry uses the reviewed Device History precedent without changing desktop rules', () => {
  assert.equal(block, deviceBlock.replace('Device History: retain', 'Retain').replace('padding: 0 8px', 'padding: 0 6px'));
  assert.ok(block.includes('padding: 0 6px'), 'outer padding also fits Notesdash Purple at 361px');
  assert.equal((block.match(/@media/g) || []).length, 2);
  assert.ok(block.includes('@media (max-width: 600px)'));
  assert.ok(block.includes('@media (max-width: 360px)'));
  assert.ok(block.includes('.theme-label { display: inline; }'), 'do not hide the only visible name with the icons');
  assert.ok(block.includes('flex: 0 0 auto;'));
});
test('the accessible action describes the unchanged five-mode cycle, not an editor', () => {
  assert.ok(buttonAfter.includes('aria-label="Cycle color theme"'));
  const source = read('assets/js/tront-theme.js');
  assert.deepEqual([...source.matchAll(/id: '([^']+)'/g)].map(match => match[1]), ['dark', 'tront-cyan', 'tront-purple', 'tront-ember', 'light']);
  assert.ok(source.includes("btn.addEventListener('click', function ()"));
  assert.ok(source.includes('idx = (idx + 1) % THEMES.length;'));
  assert.doesNotMatch(buttonAfter, /editor|dialog|menu|aria-expanded|aria-pressed/);
});
test('exact normalization rejects duplicate regions and cannot hide CSS, label, destination or copy mutations', () => {
  for (const file of files) {
    const html = read(file), plain = normalize(html, file);
    assert.throws(() => normalize(html + block, file), /duplicate/);
    assert.throws(() => normalize(html + buttonAfter, file), /duplicate/);
    assert.throws(() => assertResponsive(plain));
    for (const changed of [
      html.replace(block, block.replace('gap: 5px', 'gap: 50px')),
      html.replace(buttonAfter, buttonAfter.replace('Cycle color theme', 'Open editor')),
      html.replace('href="/games/"', 'href="/unreviewed/"'),
      html.replace('>Home</span>', '>Start</span>'),
      html + '<p>Unreviewed copy</p>'
    ]) assert.notEqual(normalize(changed, file), plain);
    assert.equal(normalize(html, 'audiobounce/index.html'), html, 'no broader page allowance');
  }
});
test('shared navigation, theme behavior and all original style declarations stay exact', () => {
  const base = process.env.THEME_BASELINE_ROOT;
  assert.ok(base);
  for (const file of ['assets/css/tront-navbar.css', 'assets/css/tront-themes.css', 'assets/js/tront-theme.js', 'assets/js/tront-theme-editor.js', 'assets/js/tront-system.js']) assert.equal(read(file), read(file, base), file);
  const styles = html => [...html.matchAll(/<style\b[\s\S]*?<\/style>/g)].map(match => match[0]);
  for (const file of files) assert.deepEqual(styles(normalize(read(file), file)), styles(normalize(read(file, base), file)), file);
});
test('CI retains all four consumer triggers and runs focused browser proof', () => {
  const workflow = read('.github/workflows/site-checks.yml');
  for (const file of files) assert.ok(workflow.includes('- ' + file));
  assert.ok(workflow.includes('- tools/navigation/**'));
  assert.ok(workflow.includes('node --test tools/navigation/*.test.cjs'));
  assert.ok(workflow.includes('node tools/navigation/legacy-navbar-browser.cjs'));
  assert.ok(workflow.includes('npm install --prefix "$RUNNER_TEMP/site-tests" --no-save --package-lock=false --ignore-scripts playwright@1.62.0 pngjs@7.0.0'), 'main browser job installs the exact PNG decoder required by its pixel gate');
});

const grid = require('./snapscan-grid.cjs');
test('SnapScan changes only the exact feature-grid minimum and is stable with an already-fixed base', () => {
  const html = read(grid.file), base = read(grid.file, process.env.THEME_BASELINE_ROOT);
  grid.assertFixed(html);
  assert.equal(grid.normalize(html, grid.file), grid.normalize(base, grid.file));
  assert.equal(grid.normalize(grid.normalize(html, grid.file), grid.file), grid.normalize(html, grid.file));
  assert.throws(() => grid.normalize(html + grid.after, grid.file), /duplicate/);
  assert.throws(() => grid.assertFixed(html + grid.before));
  assert.equal(grid.normalize(html, 'notesdash/index.html'), html);
  for (const mutated of [
    html.replace(grid.after, grid.after.replace('.features-grid', '.other-grid')),
    html.replace(grid.after, grid.after.replace('gap: 20px', 'gap: 21px')),
    html.replace(grid.after, grid.after.replace('300px', '301px')),
    html.replace('Everything you need', 'Changed copy'),
    html.replace('href="/games/"', 'href="/unreviewed/"')
  ]) assert.notEqual(grid.normalize(mutated, grid.file), grid.normalize(html, grid.file));
});
test('the grid browser allowance requires the exact defect and changes only overflow and below-grid Y', () => {
  const rect = (left, top, width, height) => ({ left, right:left+width, top, bottom:top+height, width, height });
  const oldGrid = { width:320, zoom:1, rect:rect(24, 1000, 272, 700), cards:Array.from({length:7}, (_, i) => rect(24, 1000+i*100, 300, 80)), text:Array(7).fill('Preserved feature'), textOverflow:[], otherRight:560, gap:'20px', supports:true };
  const fixedGrid = structuredClone(oldGrid); fixedGrid.rect.height += 84; fixedGrid.rect.bottom += 84;
  fixedGrid.cards = oldGrid.cards.map((card, i) => rect(24, card.top+i*12, 272, 92));
  const oldState = { scrollWidth:324, primaryControls:[{ text:'Top', href:'#top', rect:rect(24, 500, 200, 40) }, { text:'Below', href:'#below', rect:rect(24, 1800, 200, 40) }] };
  const fixedState = structuredClone(oldState); fixedState.scrollWidth=320; fixedState.primaryControls[1].rect.top+=84; fixedState.primaryControls[1].rect.bottom+=84;
  const proof = grid.compare(oldGrid, fixedGrid, grid.before, grid.after, oldState, fixedState);
  assert.deepEqual(proof.expected, fixedState); assert.equal(proof.reflow, 84); assert.ok(proof.correctedOverflow);
  assert.deepEqual(grid.compare(fixedGrid, fixedGrid, grid.after, grid.after, fixedState, fixedState).expected, fixedState);
  assert.throws(() => grid.compare(oldGrid, fixedGrid, grid.after, grid.after, oldState, fixedState), /already-fixed/);
  for (const mutate of [value => value.otherRight++, value => value.cards.pop(), value => value.text[0]='Changed', value => value.textOverflow.push(0), value => value.cards[0].right++]) {
    const invalid = structuredClone(fixedGrid); mutate(invalid);
    assert.throws(() => grid.compare(oldGrid, invalid, grid.before, grid.after, oldState, fixedState));
  }
  assert.throws(() => grid.compare(oldGrid, fixedGrid, grid.before, grid.after, oldState, {...fixedState,scrollWidth:321}));
  const zoomOld = structuredClone(oldGrid), zoomFixed = structuredClone(fixedGrid);
  for (const value of [zoomOld, zoomFixed]) {
    value.zoom = 2;
    for (const box of [value.rect, ...value.cards]) for (const field of Object.keys(box)) box[field] *= 2;
  }
  const zoomState = {...oldState, scrollWidth:648}, zoomCandidate = {...fixedState, scrollWidth:526};
  assert.ok(grid.compare(zoomOld, zoomFixed, grid.before, grid.after, zoomState, zoomCandidate).correctedOverflow);
  for (const scrollWidth of [319,648,649]) assert.throws(() => grid.compare(zoomOld, zoomFixed, grid.before, grid.after, zoomState, {...zoomCandidate,scrollWidth}));
  const wrongAction = structuredClone(fixedState); wrongAction.primaryControls[0].rect.left++;
  assert.notDeepEqual(proof.expected, wrongAction, 'the caller still compares every action field to the exact expected state');
});

test('only the measured SnapScan narrow reflow permits first-row and sparse one-level RGB changes', () => {
  const original = { width:320, height:96, data:Buffer.alloc(320*96*4,100) };
  const candidate = { ...original, data:Buffer.from(original.data) };
  const context = { file:grid.file, width:320, reflow:84 };
  candidate.data[0] += 4;
  assert.deepEqual(grid.pixelParity(original,candidate,context), {pixelIdentical:false,firstRowChangedPixels:1,sparseChangedPixels:0,maxChannelDelta:4});
  // Both measured allowances may coexist; the sparse count is per pixel, not
  // per channel, and cannot grow beyond 96 of the 30,720 crop pixels.
  for (let pixel=320;pixel<416;pixel++) for (let channel=0;channel<3;channel++) candidate.data[pixel*4+channel]++;
  assert.deepEqual(grid.pixelParity(original,candidate,context), {pixelIdentical:false,firstRowChangedPixels:1,sparseChangedPixels:96,maxChannelDelta:4});
  assert.deepEqual(grid.pixelParity(original,original,{...context,reflow:0}), {pixelIdentical:true,firstRowChangedPixels:0,sparseChangedPixels:0,maxChannelDelta:0});
  for (const wrong of [{...context,reflow:0},{...context,reflow:-1},{...context,width:390},{...context,file:'notesdash/index.html'}]) assert.throws(()=>grid.pixelParity(original,candidate,wrong));
  for (const [offset,delta] of [[0,5],[320*4,2],[3,1],[320*4+3,1]]) {
    const invalid={...original,data:Buffer.from(original.data)};invalid.data[offset]+=delta;
    assert.throws(()=>grid.pixelParity(original,invalid,context));
  }
  const tooMany={...candidate,data:Buffer.from(candidate.data)};tooMany.data[416*4]++;
  assert.throws(()=>grid.pixelParity(original,tooMany,context), /at most 96/);
  for (const dimensions of [{width:319,height:96},{width:320,height:97},{width:1440,height:96}]) {
    const a={...dimensions,data:Buffer.alloc(dimensions.width*dimensions.height*4,100)};
    const b={...a,data:Buffer.from(a.data)};b.data[0]++;
    assert.throws(()=>grid.pixelParity(a,b,context));
  }
});
