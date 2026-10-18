'use strict';
const assert = require('node:assert/strict');
const personId = 'https://tront.xyz/#trent-sterling';
const authorBefore = '"author":{"@type":"Person","name":"Trent Sterling","url":"https://tront.xyz/"}';
const authorAfter = '"author":{"@type":"Person","@id":"' + personId + '","name":"Trent Sterling","url":"https://tront.xyz/"}';
const products = ['powershellmanager/index.html', 'trontop/index.html', 'ytdl/index.html'];
// Published article targets independently checked in released blog 2ae3d69.
const articles = [
  { file: 'colony/index.html', target: '/blog/posts/colony/', label: 'Colony devlog' },
  { file: 'jennsfarm/index.html', target: '/blog/posts/jenn-s-farm/', label: "Jenn's Farm devlog" }
];
// These exact article canonicals and reciprocal landing links were checked in
// released blog ddb16b66. Each page retains its existing credit and local style.
const projectArticles = [
  { file: 'runtimecsg/index.html', target: '/blog/posts/runtimecsg/', label: 'RuntimeCSG devlog', color: '#7db4ff', indent: '        ', credit: '<p>Made by <a href="https://tront.xyz">tront</a></p>' },
  { file: 'toaster/index.html', target: '/blog/posts/toaster/', label: 'Toaster devlog', color: '#fbbf24', indent: '        ', credit: '<p>Made by <a href="https://tront.xyz">tront</a></p>' },
  { file: 'notesdash/index.html', target: '/blog/posts/notesdash/', label: 'Notesdash devlog', indent: '            ', credit: '<p>&copy; <script>document.write(new Date().getFullYear())</script> <a href="https://tront.xyz">Trent Sterling</a>. Built with Rust and local AI.</p>' },
  { file: 'snapscan/index.html', target: '/blog/posts/snapscan/', label: 'SnapScan devlog', color: '#a78bfa', indent: '      ', credit: '<p>Built by <a href="https://tront.xyz">tront</a></p>' }
];
const footerBefore = '                <a href="https://tront.xyz/discord/" target="_blank">Discord</a>';
const changes = products.map(file => ({ file, before: authorBefore, after: authorAfter })).concat(articles.map(article => ({
  file: article.file,
  before: footerBefore,
  after: footerBefore + '\n                <span class="footer-sep">|</span>\n                <a href="' + article.target + '">' + article.label + '</a>'
}))).concat(projectArticles.map(article => ({
  file: article.file,
  before: article.indent + article.credit,
  after: article.indent + article.credit + '\n' + article.indent + '<p><a href="' + article.target + '"' + (article.color ? ' style="color: ' + article.color + '"' : '') + '>' + article.label + '</a></p>'
})));
function normalize(html, file) {
  const change = changes.find(change => change.file === file);
  if (!change) return html;
  assert.ok(html.split(change.after).length <= 2, 'duplicate reviewed author/discovery addition');
  return html.replace(change.after, change.before);
}
const jsonLd = html => [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].flatMap(match => {
  const value = JSON.parse(match[1]); return (Array.isArray(value) ? value : [value]).flatMap(value => value['@graph'] || value);
});
module.exports = { personId, products, articles, projectArticles, changes, normalize, jsonLd };
