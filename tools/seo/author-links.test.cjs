'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { personId, products, articles, projectArticles, changes, normalize, jsonLd } = require('./author-links.cjs');
const root = path.resolve(__dirname, '../..');
const read = (file, dir = root) => fs.readFileSync(path.join(dir, file), 'utf8');
for (const file of products) test(file + ': existing software author resolves to the canonical Person only', () => {
  const values = jsonLd(read(file));
  const app = values.filter(value => value['@type'] === 'SoftwareApplication');
  assert.equal(app.length, 1);
  assert.deepEqual(app[0].author, { '@type': 'Person', '@id': personId, name: 'Trent Sterling', url: 'https://tront.xyz/' });
  assert.ok(jsonLd(read('index.html')).some(value => value['@type'] === 'Person' && value['@id'] === personId));
  assert.equal(values.filter(value => value['@type'] === 'ProfilePage').length, 0);
});
for (const article of articles) test(article.file + ': contextual published devlog link preserves play actions and credits', () => {
  const html = read(article.file), footer = html.match(/<footer class="page-footer">([\s\S]*?)<\/footer>/)[1];
  assert.equal(footer.split('<a href="' + article.target + '">' + article.label + '</a>').length, 2);
  assert.ok(footer.includes('Built by <a href="https://tront.xyz">Trent Sterling</a>.'));
  assert.equal([...html.matchAll(/<a\b[^>]*href="play\/"/g)].length, 2);
  assert.equal(jsonLd(html).find(value => value['@type'] === 'VideoGame').author['@id'], personId);
  assert.doesNotMatch(footer, /farmvr|HARDPOINT|WIPtutorial/);
});
for (const article of projectArticles) test(article.file + ': exact published article complements the existing software credit', () => {
  const html = read(article.file), footer = html.match(/<footer>([\s\S]*?)<\/footer>/)[1];
  const anchor = '<a href="' + article.target + '"' + (article.color ? ' style="color: ' + article.color + '"' : '') + '>' + article.label + '</a>';
  assert.equal(html.split(anchor).length, 2, 'one exact article anchor');
  assert.ok(footer.includes('<p>' + anchor + '</p>'), 'separate footer link, never a nested anchor');
  assert.ok(footer.includes(article.credit), 'original full credit paragraph remains exact');
  assert.ok(html.includes('<a href="/blog/" class="nav-link">Blog</a>'), 'generic Blog navigation stays available');
  assert.equal(jsonLd(html).find(value => value['@type'] === 'SoftwareApplication').author['@id'], personId);
  assert.equal(jsonLd(html).filter(value => value['@type'] === 'ProfilePage').length, 0);
  assert.doesNotMatch(footer, /HARDPOINT|WIPtutorial|snapscan-local-ai-pipeline/);
});
test('all reviewed files preserve every original byte outside their exact additions', () => {
  const base = process.env.THEME_BASELINE_ROOT;
  assert.ok(base, 'THEME_BASELINE_ROOT must identify the PR base checkout');
  for (const change of changes) {
    const html = read(change.file);
    assert.equal(html.split(change.after).length, 2, change.file + ': one exact addition');
    assert.equal(normalize(html, change.file), normalize(read(change.file, base), change.file));
  }
});
test('new project article additions preserve all schema values and cannot hide changed credits', () => {
  const base = process.env.THEME_BASELINE_ROOT;
  assert.ok(base);
  for (const article of projectArticles) {
    const html = read(article.file), plain = normalize(html, article.file);
    assert.deepEqual(jsonLd(html), jsonLd(read(article.file, base)), 'metadata remains unchanged');
    assert.notEqual(normalize(html.replace(article.credit, article.credit + 'unreviewed credit'), article.file), plain);
    assert.notEqual(normalize(html.replace(article.target, '/blog/posts/unrelated/'), article.file), plain);
    assert.notEqual(normalize(html.replace(article.label, 'Unreviewed article'), article.file), plain);
    if (article.color) {
      assert.ok(article.file === 'snapscan/index.html' ? html.includes('var(--accent) 0%, ' + article.color + ' 50%') : html.includes('a { color: ' + article.color + ';'), 'new link borrows an existing page color');
      assert.notEqual(normalize(html.replace('style="color: ' + article.color + '"', 'style="color: #444"'), article.file), plain, 'unreviewed new-link color is not normalized');
    }
    assert.equal(normalize(html, 'audiobounce/index.html'), html, 'no unreviewed page is normalized');
  }
});
test('normalization rejects duplicates and never hides changed copy, destinations, roles or IDs', () => {
  for (const change of changes) {
    const html = read(change.file), plain = normalize(html, change.file);
    assert.equal(normalize(html + 'changed', change.file), plain + 'changed');
    assert.equal(normalize(html, 'unrelated/index.html'), html);
    assert.throws(() => normalize(html + change.after, change.file), /duplicate/);
    for (const [from, to] of [['Trent Sterling', 'Someone Else'], ['#trent-sterling', '#different-person'], ['/blog/posts/', '/blog/wrong/'], ['devlog', 'news'], ['"Person"', '"Organization"']]) {
      if (change.after.includes(from)) assert.notEqual(normalize(html.replace(change.after, change.after.replace(from, to)), change.file), plain);
    }
  }
});
test('CI watches every new author consumer and exercises the browser links', () => {
  const workflow = read('.github/workflows/site-checks.yml');
  for (const change of changes) assert.ok(workflow.includes('- ' + change.file));
  assert.ok(workflow.includes('node --test tools/seo/*.test.cjs'));
  assert.ok(workflow.includes('node tools/seo/author-links-browser.cjs'));
});

test('settled visual comparisons lock the same animation phase without weakening appearance equality', () => {
  const browser = read('tools/seo/author-links-browser.cjs');
  assert.ok(browser.includes('animation.pause(); animation.currentTime = 0;'));
  assert.ok(browser.includes("assert.equal(animation.state, 'paused')"));
  assert.ok(browser.includes('assert.equal(animation.time, 0)'));
  assert.ok(browser.includes("animations:'allow'"));
  assert.ok(browser.includes("assert.deepEqual(await after.evaluate(declarations),original,'original animation identities and declarations unchanged')"));
  assert.ok(browser.includes("assert.deepEqual(imageAfter,imageBefore,'metadata-only page pixels unchanged')"));
  assert.ok(browser.includes("assert.deepEqual(await after.page.evaluate(measure),beforeMeasure"));
});


test('production animation declarations remain byte-identical to the actual PR base', () => {
  const base = process.env.THEME_BASELINE_ROOT;
  assert.ok(base);
  for (const change of changes) {
    const styles = html => [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/g)].map(match => match[0]);
    assert.deepEqual(styles(read(change.file)),styles(read(change.file,base)),change.file + ': every original style declaration unchanged');
  }
});
