'use strict';
const assert = require('node:assert/strict');
const file = "minecraft-modding/index.html";
const tokens = {
  "--bg": "#011405",
  "--panel": "#071e0c",
  "--elem": "#112815",
  "--elem-hover": "#003a00",
  "--elem-active": "#004504",
  "--line-subtle": "#005218",
  "--line": "#14632c",
  "--line-hover": "#2f7e43",
  "--solid": "#1fe065",
  "--solid-hover": "#4bfa7d",
  "--muted": "#abccb0",
  "--text": "#dff5e2",
  "--on-solid": "#000000",
  "--accent": "#1fe065",
  "--accent-on-bg": "#1fe065",
  "--seed": "#17dd62",
  "--danger": "#eda79d",
  "--warn": "#ebaa3c",
  "--ok": "#62c88d"
};
const options = {
  "variant": "product",
  "crosslink": true,
  "links": [
    {
      "label": "Start",
      "href": "#lesson-0"
    },
    {
      "label": "The sword",
      "href": "#lesson-4"
    },
    {
      "label": "The realm",
      "href": "#lesson-8"
    },
    {
      "label": "Exercises",
      "href": "#exercises"
    },
    {
      "label": "2026 names",
      "href": "#names"
    },
    {
      "label": "Template",
      "href": "trontmod-template.zip"
    }
  ]
};
const css = "  /* Fixed emerald defaults match Tront.applyTheme before shared JavaScript loads. */\n  :root{--bg:#011405;--panel:#071e0c;--elem:#112815;--elem-hover:#003a00;--elem-active:#004504;--line-subtle:#005218;--line:#14632c;--line-hover:#2f7e43;--solid:#1fe065;--solid-hover:#4bfa7d;--muted:#abccb0;--text:#dff5e2;--on-solid:#000000;--accent:#1fe065;--accent-on-bg:#1fe065;--seed:#17dd62;--danger:#eda79d;--warn:#ebaa3c;--ok:#62c88d}\n";
const emptyNav = "<nav id=\"nav\" aria-label=\"Page\"></nav>";
const staticNav = "<nav id=\"nav\" class=\"t-nav t-nav--product\" aria-label=\"Page\"><a class=\"t-nav__mark\" href=\"https://tront.xyz/\"><span aria-hidden=\"true\">&#9664;</span> tront.xyz</a><div class=\"t-nav__links\"><a class=\"t-nav__link\" href=\"#lesson-0\">Start</a><a class=\"t-nav__link\" href=\"#lesson-4\">The sword</a><a class=\"t-nav__link\" href=\"#lesson-8\">The realm</a><a class=\"t-nav__link\" href=\"#exercises\">Exercises</a><a class=\"t-nav__link\" href=\"#names\">2026 names</a><a class=\"t-nav__link\" href=\"trontmod-template.zip\">Template</a><details class=\"t-nav__more\"><summary class=\"t-nav__link\">More</summary><div class=\"t-nav__menu\"><a href=\"https://punk.tront.xyz/\">HackerPunk</a><a href=\"https://monke.tront.xyz/\">MonkePortals</a><a href=\"https://tront.xyz/eos-native/\">EOS Native</a><a href=\"https://tront.xyz/spaceview/\">SpaceView</a><a href=\"https://tront.xyz/critters/\">critters</a><a href=\"https://tront.xyz/snapscan/\">SnapScan</a><a href=\"https://tront.xyz/toaster/\">Toaster</a><a href=\"https://tront.xyz/colony/\">Colony</a><a href=\"https://tront.xyz/lofigen/\">lofigen</a><a href=\"https://tront.xyz/megabunk/\">megabunk</a></div></details></div></nav>";
const oldRuntime = "  if (window.Tront) {\n    Tront.applyTheme('#17dd62', true);\n    Tront.mountNav({ variant: 'product', crosslink: true, links: [\n      { label: 'Start', href: '#lesson-0' }, { label: 'The sword', href: '#lesson-4' }, { label: 'The realm', href: '#lesson-8' },\n      { label: 'Exercises', href: '#exercises' }, { label: '2026 names', href: '#names' },\n      { label: 'Template', href: 'trontmod-template.zip' }\n    ] }, document.getElementById('nav'));\n  }";
const newRuntime = "  if (window.Tront) {\n    Tront.applyTheme('#17dd62', true);\n  }";
function normalize(html, target) {
  if (target !== file) return html;
  for (const part of [css, staticNav, newRuntime]) assert.ok(html.split(part).length <= 2, 'duplicate reviewed Minecraft initial-render addition');
  return html.replace(css, '').replace(staticNav, emptyNav).replace(newRuntime, oldRuntime);
}
module.exports = { file, tokens, options, css, emptyNav, staticNav, oldRuntime, newRuntime, normalize };
