'use strict';

// The only approved breadcrumb additions. Kept separate from runtime code so
// preservation checks can remove these exact bytes, never arbitrary JSON-LD.
const assert = require('node:assert/strict');
const pages = [
  { file: 'games/index.html', name: 'Games', url: 'https://tront.xyz/games/' },
  { file: 'colony/index.html', name: 'Colony', url: 'https://tront.xyz/colony/' },
  { file: 'jennsfarm/index.html', name: "Jenn's Farm", url: 'https://tront.xyz/jennsfarm/' }
];
function expected(page) {
  const trail = [
    ['Home', 'https://tront.xyz/'],
    ['Games', 'https://tront.xyz/games/']
  ];
  if (page.file !== 'games/index.html') trail.push([page.name, page.url]);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, item], i) => ({
      '@type': 'ListItem', position: i + 1, name, item
    }))
  };
}
function addition(page) {
  return '    <script type="application/ld+json" id="page-breadcrumbs">\n' +
    JSON.stringify(expected(page), null, 2).split('\n').map(line => '    ' + line).join('\n') +
    '\n    </script>\n';
}
function withoutAddition(html, file) {
  const page = pages.find(page => page.file === file);
  if (!page) return html;
  const block = addition(page);
  assert.ok(html.split(block).length <= 2, file + ': duplicate exact breadcrumb block');
  return html.replace(block, '');
}
module.exports = { pages, expected, addition, withoutAddition };
