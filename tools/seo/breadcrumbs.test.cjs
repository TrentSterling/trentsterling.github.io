'use strict';
// Run from the repository root:
// THEME_BASELINE_ROOT=/path/to/pr-base node --test tools/seo/breadcrumbs.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pages, expected, addition, withoutAddition } = require('./breadcrumbs.cjs');
const root = path.resolve(__dirname, '../..');
const baseline = process.env.THEME_BASELINE_ROOT;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const jsonLd = html => [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
  .flatMap(match => {
    const value = JSON.parse(match[1]);
    return Array.isArray(value) ? value : [value];
  }).flatMap(value => value['@graph'] || value);
const canonical = html => html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
const links = html => [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
  .map(match => ({ url: new URL(match[1], 'https://tront.xyz/').href, body: match[2] }));

for (const page of pages) {
  const html = read(page.file);
  test(page.file + ': one parseable, correctly ordered BreadcrumbList', () => {
    const lists = jsonLd(html).filter(value => value['@type'] === 'BreadcrumbList');
    assert.equal(lists.length, 1);
    assert.deepEqual(lists[0], expected(page));
    assert.ok(lists[0].itemListElement.length >= 2);
    for (const [index, item] of lists[0].itemListElement.entries()) {
      assert.equal(item['@type'], 'ListItem');
      assert.equal(item.position, index + 1);
      assert.ok(Number.isInteger(item.position));
      assert.ok(item.name.length > 0);
      const url = new URL(item.item);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.origin, 'https://tront.xyz');
      assert.equal(url.search + url.hash, '');
      const target = url.pathname === '/' ? 'index.html' : url.pathname.slice(1) + 'index.html';
      assert.equal(canonical(read(target)), item.item, target + ': exact canonical URL');
    }
    assert.equal(lists[0].itemListElement.at(-1).item, canonical(html));
    const start = html.indexOf(addition(page));
    assert.ok(start >= 0 && start < html.indexOf('</head>'), 'exact additive block belongs in head');
  });

  test(page.file + ': hierarchy follows real navigation and gallery membership', () => {
    assert.ok(links(read('index.html')).some(link => link.url === pages[0].url && link.body.trim() === 'Games'));
    assert.ok(links(html).some(link => link.url === 'https://tront.xyz/'));
    if (page.file !== 'games/index.html') {
      const card = links(read('games/index.html')).find(link => link.url === page.url);
      assert.ok(card, 'game has an actual gallery link');
      assert.ok(card.body.includes('<h3 class="card-title">' + page.name + ' <span>'), 'gallery title matches');
      assert.ok(html.includes('<h1>' + page.name + '</h1>'), 'game heading matches');
      assert.ok(links(html).some(link => link.url === pages[0].url && link.body.trim() === 'Games'));
    }
  });

  test(page.file + ': every byte outside the exact addition matches the PR base', () => {
    assert.ok(baseline, 'THEME_BASELINE_ROOT must identify a checkout of the PR base');
    const before = fs.readFileSync(path.join(baseline, page.file), 'utf8');
    assert.deepEqual(
      Buffer.from(withoutAddition(html, page.file)),
      Buffer.from(withoutAddition(before, page.file)),
      'preserve all existing markup, schema entities, copy, dates, credits, layout, cards and scripts'
    );
  });
}

test('preservation exemption never hides other script or content changes', () => {
  for (const page of pages) {
    const block = addition(page);
    const original = read(page.file);
    const plain = withoutAddition(original, page.file);
    assert.equal(withoutAddition(block + plain, page.file), plain);
    assert.equal(withoutAddition(block + plain + 'changed', page.file), plain + 'changed');
    const changed = block.replace('"name": "Home"', '"name": "Unapproved"');
    assert.equal(withoutAddition(changed + plain, page.file), changed + plain);
    assert.throws(() => withoutAddition(block + block + plain, page.file), /duplicate/);
  }
});
