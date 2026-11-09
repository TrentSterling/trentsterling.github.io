/* Progressive enhancement: the original cards and CSS category filters stay usable
 * without this file. Filter evidence is documented in tools/games-discovery/README.md. */
(() => {
  'use strict';
  // Explicit browser destinations, not a guess based on a tront.xyz URL or a video.
  // Desktop downloads, devlogs, store pages, and unlisted projects are excluded.
  const browserPaths = new Set([
    'craftmine2', 'megabutt', 'dustline', 'jetgame', 'lastrun', 'scrapyard',
    'vectorrush', 'hearthwild', 'machinelearning', 'tinyzombies', 'crumplecar',
    'gemstogether', 'voxelheroes', 'smear', 'deadends', 'buttloads2', 'biomass',
    'tunnelrat', 'campfire', 'slopeloop', 'ringriot', 'ltc', 'froxel', 'aqua-empire',
    'fellswoop', 'inkride', 'tinytreads', 'senddudes', 'breakmass', 'buddy',
    'vixels', 'tinyrise', 'terrainlab', 'floatingorigin', 'terrainarray',
    'asciicity', 'ballpit', 'critters', 'jennsfarm', 'colony', 'megabunk',
    'threejs-volumetric-beam', 'craftmine', 'vibesand', 'vibewater', 'vibeduders',
    'vibevoxelprobes', 'quantumvibes', 'vibestar', 'vibecraft', 'vibebounce',
    'vibecar', 'spheres', 'lerp', 'vibebeats', 'vibeprime', 'wolfenstein',
    'sudoku', 'pachinko', 'shortpath', 'vibespace', 'vibepong', 'vibemaze', 'splitter'
  ]);
  // The current card descriptions explicitly describe these multiplayer projects.
  // This does not promise that an archived project still has active servers.
  const multiplayerTitles = new Set([
    'Gems Together', 'Voxel Heroes', 'DEAD ENDS', 'Campfire', 'INKRIDE',
    'Tiny Treads', 'Buddy Bonk', 'CraftMine', 'BoostMelon', 'HackerPunk VR',
    'Guys, Girls, and Guns', 'MP Zombie Shooter', 'Magic Archer'
  ]);
  const normalize = text => text.normalize('NFKD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  function browserProject(href) {
    try {
      const url = new URL(href, 'https://tront.xyz/');
      return url.origin === 'https://tront.xyz' && browserPaths.has(url.pathname.replace(/^\/|\/$/g, ''));
    } catch { return false; }
  }
  function matches(record, state) {
    return (state.category === 'all' || record.categories.includes(state.category)) &&
      (!state.browser || record.browser) && (!state.multiplayer || record.multiplayer) &&
      normalize(state.query).split(/\s+/).filter(Boolean).every(word => record.text.includes(word));
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { browserPaths, multiplayerTitles, normalize, browserProject, matches };
  }
  if (typeof document === 'undefined') return;
  const grid = document.querySelector('main.grid');
  const categoryNav = document.querySelector('.filter-nav');
  const radios = [...document.querySelectorAll('input[name="filter"]')];
  if (!grid || !categoryNav || !radios.length || document.getElementById('games-search')) return;
  const records = [...grid.querySelectorAll('.item')].map(card => {
    const title = card.querySelector('.card-title').textContent.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const browser = browserProject(card.getAttribute('href'));
    const multiplayer = multiplayerTitles.has(title);
    return { card, browser, multiplayer,
      categories: [...card.classList].filter(c => c.startsWith('tag-')).map(c => c.slice(4)),
      text: normalize([...card.querySelectorAll('.card-title, .blurb, .tag')].map(e => e.textContent).join(' ') +
        (browser ? ' browser' : '') + (multiplayer ? ' multiplayer' : '')) };
  });
  const controls = document.createElement('form');
  controls.className = 'games-discovery';
  controls.setAttribute('role', 'search');
  controls.setAttribute('aria-label', 'Search projects');
  controls.innerHTML = `
    <label class="games-search-label" for="games-search">Find a project</label>
    <div class="games-search-row">
      <input id="games-search" type="search" placeholder="Search names, descriptions, tags or years…" maxlength="200" autocomplete="off" spellcheck="false" aria-describedby="games-search-help" aria-controls="games-results">
      <button id="games-reset" type="button">Clear all</button>
    </div>
    <fieldset class="games-refinements">
      <legend>Show only</legend>
      <label><input id="games-browser" type="checkbox" aria-controls="games-results"> Runs in browser</label>
      <label><input id="games-multiplayer" type="checkbox" aria-controls="games-results"> Multiplayer projects</label>
    </fieldset>
    <p id="games-search-help">Search and filters work together. Some browser projects need a desktop or WebGPU.</p>`;
  categoryNav.before(controls);
  categoryNav.setAttribute('aria-label', 'Project categories');
  grid.id = 'games-results';
  const status = document.createElement('p');
  status.id = 'games-result-count';
  status.className = 'games-result-count';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  categoryNav.after(status);
  const empty = document.createElement('section');
  empty.className = 'games-empty';
  empty.hidden = true;
  empty.innerHTML = '<h2>No projects found</h2><p>Try another search or clear the filters.</p><button type="button">Show all projects</button>';
  grid.after(empty);
  const search = controls.querySelector('#games-search');
  const browser = controls.querySelector('#games-browser');
  const multiplayer = controls.querySelector('#games-multiplayer');
  const reset = controls.querySelector('#games-reset');
  const categories = new Set(radios.map(radio => radio.id.slice(7)));
  const state = () => ({ query: search.value, browser: browser.checked, multiplayer: multiplayer.checked,
    category: radios.find(radio => radio.checked)?.id.slice(7) || 'all' });
  function readURL() {
    const params = new URLSearchParams(location.search);
    search.value = (params.get('q') || '').slice(0, 200);
    browser.checked = params.get('browser') === '1';
    multiplayer.checked = params.get('multiplayer') === '1';
    const category = categories.has(params.get('category')) ? params.get('category') : 'all';
    radios.forEach(radio => { radio.checked = radio.id === 'filter-' + category; });
  }
  function render(writeURL = true) {
    const current = state();
    let count = 0;
    records.forEach(record => {
      record.card.hidden = !matches(record, current);
      if (!record.card.hidden) count++;
    });
    status.textContent = `${count} of ${records.length} projects`;
    empty.hidden = count !== 0;
    reset.disabled = !current.query && current.category === 'all' && !current.browser && !current.multiplayer;
    if (writeURL) {
      const url = new URL(location.href);
      for (const [name, value] of Object.entries({ q: current.query.trim(), category: current.category === 'all' ? '' : current.category,
        browser: current.browser ? '1' : '', multiplayer: current.multiplayer ? '1' : '' })) {
        if (value) url.searchParams.set(name, value); else url.searchParams.delete(name);
      }
      // Keep unrelated parameters/hash, do not add a history entry for each keystroke.
      try { history.replaceState(history.state, '', url); } catch { /* Search still works without history access. */ }
    }
  }
  function clear() {
    search.value = '';
    browser.checked = multiplayer.checked = false;
    radios.find(radio => radio.id === 'filter-all').checked = true;
    render();
    search.focus({ preventScroll: true });
  }
  controls.addEventListener('submit', event => event.preventDefault());
  search.addEventListener('input', () => render());
  search.addEventListener('search', () => render());
  search.addEventListener('keydown', event => {
    if (event.key === 'Escape' && search.value) { event.preventDefault(); search.value = ''; render(); }
  });
  browser.addEventListener('change', () => render());
  multiplayer.addEventListener('change', () => render());
  radios.forEach(radio => radio.addEventListener('change', () => render()));
  reset.addEventListener('click', clear);
  empty.querySelector('button').addEventListener('click', clear);
  addEventListener('popstate', () => { readURL(); render(false); });
  addEventListener('pageshow', () => { readURL(); render(false); });
  readURL();
  render(false);
})();
