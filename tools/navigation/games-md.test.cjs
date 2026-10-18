'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const contract = require('./games-md.cjs');
const root = path.resolve(__dirname, '../..');
const read = (file, dir = root) => fs.readFileSync(path.join(dir, file), 'utf8');
const digest = text => crypto.createHash('sha256').update(text).digest('hex');

test('legacy portfolio permits only four exact usability changes and preserves all 55 raw records', () => {
  assert.ok(process.env.THEME_BASELINE_ROOT, 'the real PR base is required');
  const html = read(contract.file), base = read(contract.file, process.env.THEME_BASELINE_ROOT);
  contract.assertFixed(html);
  assert.equal(contract.normalize(html, contract.file), contract.normalize(base, contract.file));
  const raw = contract.rawPortfolio(html);
  assert.equal(raw, contract.rawPortfolio(base), 'dates, copy, credits, URLs and order stay byte-identical');
  assert.equal(digest(raw), contract.rawSha256);
  const records = raw.trim().split('---').map(record => record.trim()).filter(record => record.startsWith('###'));
  assert.equal(records.length, 55);
  assert.ok(records[0].startsWith('### Project Demigod :: (2025-Present)'));
  assert.equal(contract.normalize(contract.normalize(html, contract.file), contract.file), contract.normalize(html, contract.file));
});

test('exact allowance cannot hide label, destination, copy, theme, metadata or CSS changes', () => {
  const html = read(contract.file), plain = contract.normalize(html, contract.file);
  for (const change of contract.changes) {
    assert.throws(() => contract.normalize(html + change.after, contract.file), /duplicate/);
    assert.throws(() => contract.assertFixed(html.replace(change.after, change.before)));
  }
  for (const changed of [
    html.replace('height: 102px', 'height: 103px'),
    html.replace('max-width: 700px', 'max-width: 699px'),
    html.replace('overflow-wrap:anywhere', 'overflow-wrap:normal'),
    html.replace('visibleToggle.focus();', 'toggleButton.focus();'),
    html.replace('[ DEACTIVATE HACKER MODE ]', '[ EXIT ]'),
    html.replace('>Home</span>', '>Start</span>'),
    html.replace('href="/blog/"', 'href="/unreviewed/"'),
    html.replace('class="theme-label"> Dark', 'class="theme-label"> Light'),
    html.replace('Network Programmer + Unity Generalist', 'Unreviewed credit'),
    html.replace('https://tront.xyz/games/md/', 'https://tront.xyz/games/'),
    html + '<p>Unreviewed content</p>'
  ]) assert.notEqual(contract.normalize(changed, contract.file), plain);
  assert.equal(contract.normalize(html, 'games/index.html'), html, 'no main Games allowance');
  assert.doesNotMatch(html, /application\/ld\+json/, 'no schema added');
});

test('the six-control page retains its order, action labels, JS startup and exact shared assets', () => {
  const html = read(contract.file);
  const nav = html.match(/navContainer.innerHTML = `([\s\S]*?)`;/)[1];
  assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map(match => match[1]), ['https://tront.xyz/discord/', '/blog/', '#', 'https://tront.xyz/', 'javascript:void(0);']);
  assert.match(html, /\[ ACTIVATE INTERFACE \]/);
  assert.match(nav, /\[ DEACTIVATE HACKER MODE \]/);
  assert.ok(html.includes('transition:opacity .4s ease-in-out;opacity:0'));
  assert.ok(html.includes("body.classList.add('loaded');"));
  assert.equal((html.match(/flex-wrap: wrap-reverse/g) || []).length, 1);
  for (const file of ['games/index.html', 'assets/css/tront-themes.css', 'assets/js/tront-theme.js', 'assets/js/tront-system.js']) {
    assert.equal(read(file), read(file, process.env.THEME_BASELINE_ROOT), file + ': unchanged');
  }
  const workflow = read('.github/workflows/site-checks.yml');
  for (const trigger of ['games/**', 'tools/navigation/**']) assert.ok(workflow.includes('- ' + trigger));
  assert.ok(workflow.includes('node tools/navigation/games-md-browser.cjs'));
});
