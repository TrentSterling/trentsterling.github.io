'use strict';
// Exact reviewed replacements only; never remove arbitrary runtime or CSS.
const replacements = [
  ["            document.fonts.ready.then(() => { document.body.classList.add('fonts-loaded'); });",
   "            document.body.classList.add('fonts-loaded');"],
  ['position:relative;overflow-x:hidden;opacity:0;visibility:hidden;transition:opacity .4s ease-in-out',
   'position:relative;overflow-x:hidden;opacity:1;visibility:visible;transition:opacity .4s ease-in-out']
];
function normalize(html, file) {
  if (file !== 'games/index.html') return html;
  for (const [before, after] of replacements) html = html.replace(after, before);
  return html;
}
module.exports = { replacements, normalize };
