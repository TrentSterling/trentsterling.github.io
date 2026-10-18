'use strict';
const assert = require('node:assert/strict');
// Static HTML remains the no-JavaScript source. This exact comparison-only
// allowance never generates production markup or hides other attribute changes.
const changes = [
  { file: 'index.html', before: '<a href="/" class="nav-link home-link active">', after: '<a href="/" class="nav-link home-link active" aria-current="page">' },
  { file: 'games/index.html', before: '<a href="javascript:void(0);" class="nav-link active">Games</a>', after: '<a href="/games/" class="nav-link active" aria-current="page">Games</a>' },
  { file: 'discord/index.html', before: '<a href="#" class="nav-link active">Discord</a>', after: '<a href="/discord/" class="nav-link active" aria-current="page">Discord</a>' }
];
const pages = [
  { file: 'index.html', route: '/', current: 'Home' },
  { file: 'games/index.html', route: '/games/', current: 'Games' },
  { file: 'discord/index.html', route: '/discord/', current: 'Discord' },
  { file: '404.html', route: '/404.html', current: null }
];
function normalize(html, file) {
  const change = changes.find(item => item.file === file);
  if (!change) return html;
  assert.ok(html.split(change.after).length <= 2, file + ': duplicate reviewed navigation anchor');
  return html.replace(change.after, change.before);
}
function links(markup) {
  return [...markup.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/g)].map(([, attrs, text]) => ({
    href: attrs.match(/\bhref="([^"]+)"/)?.[1],
    label: text.replace(/<[^>]+>/g, '').trim(),
    current: attrs.match(/\baria-current="([^"]+)"/)?.[1] || null,
    active: /\bclass="[^"]*\bactive\b/.test(attrs)
  }));
}
function assertPrimary(html, page, hub) {
  const nav = html.match(/<nav id="magic-navbar-container" aria-label="Primary">([\s\S]*?)<\/nav>/);
  assert.ok(nav, page.file + ': named primary navigation');
  const actual = links(nav[1]);
  assert.equal(actual.length, hub.length);
  for (const [index, link] of actual.entries()) {
    const expected = hub[hub.length - 1 - index];
    assert.equal(link.label, expected.label, 'preserve established reverse-flex DOM order');
    assert.ok(link.href.startsWith('/') && !link.href.startsWith('//'), 'real same-origin route');
    assert.equal(new URL(link.href, 'https://tront.xyz').href, expected.href, 'destination matches Tront.HUB');
    assert.equal(link.current, link.label === page.current ? 'page' : null);
    assert.equal(link.active, link.label === page.current);
  }
  return actual;
}
module.exports = { changes, pages, normalize, links, assertPrimary };
