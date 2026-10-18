'use strict';
// Exact reviewed replacements only; never remove arbitrary runtime or CSS.
const replacements = [
  ["        .filter-controls{display:none}", "        .filter-controls{position:fixed;top:0;left:0;width:1px;height:1px;padding:0;margin:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}\n        #filter-all:focus~.main-container .filter-nav label[for=filter-all],#filter-vr:focus~.main-container .filter-nav label[for=filter-vr],#filter-game-jam:focus~.main-container .filter-nav label[for=filter-game-jam],#filter-tool:focus~.main-container .filter-nav label[for=filter-tool],#filter-prototype:focus~.main-container .filter-nav label[for=filter-prototype],#filter-mod:focus~.main-container .filter-nav label[for=filter-mod],#filter-game:focus~.main-container .filter-nav label[for=filter-game],#filter-flash-game:focus~.main-container .filter-nav label[for=filter-flash-game]{outline:3px solid var(--te-accent,var(--accent-teal));outline-offset:3px}\n        .filter-nav label{scroll-margin-block:5rem 1rem}"],
  ["", "    <script id=\"gallery-filter-focus\">\n        document.querySelectorAll('input[name=\"filter\"]').forEach(input => {\n            input.addEventListener('focus', () => {\n                setTimeout(() => {\n                    if (document.activeElement !== input) return;\n                    document.querySelector('label[for=\"' + input.id + '\"]').scrollIntoView({block:'nearest',inline:'nearest'});\n                }, 0);\n            });\n        });\n    </script>\n"],
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
