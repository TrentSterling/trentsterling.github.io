#!/usr/bin/env node
// Sitemap regression smoke check: run from the repository root.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const xml = fs.readFileSync('sitemap-pages.xml', 'utf8');
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URLs');
assert(urls.includes('https://tront.xyz/craftmine/'), 'Missing canonical CraftMine landing page');
assert(!urls.includes('https://tront.xyz/craftmine/play/'), 'CraftMine play canonicalizes to /craftmine/ and must stay out of the sitemap');
assert(!urls.some(url => /\/aqua-empire\/game\.html/.test(url)), 'Aqua runtime canonicalizes to /aqua-empire/ and must stay out of the sitemap');
for (const name of ['calm','colony','crumplecar','hardpoint','jennsfarm','machinelearning','megabunk']) {
  const url = 'https://tront.xyz/' + name + '/';
  assert(urls.includes(url), 'Missing sitemap URL: ' + url);
  const html = fs.readFileSync(name + '/index.html', 'utf8');
  assert(/<title\b[^>]*>[^<]+<\/title>/i.test(html), 'Missing title: ' + name);
  assert(html.includes('rel="canonical"') && html.includes('href="' + url + '"'), 'Missing self canonical: ' + name);
}
for (const name of ['crumplecar','hardpoint']) {
  const html = fs.readFileSync(name + '/index.html', 'utf8');
  assert(/<meta\s+name="description"\s+content="[^"]{40,}"/i.test(html), 'Missing meta description: ' + name);
}
// Other projects are separate GitHub Pages mounts, not folders in this repo.
for (const name of ['craftmine2','hearthwild','scrapyard','tinyzombies','vectorrush']) {
  assert(urls.includes('https://tront.xyz/' + name + '/'), 'Missing published external project: ' + name);
}
console.log('SEO smoke checks passed: sitemap URLs, canonicals, and game metadata.');
