'use strict';
(() => {
  const root = document.documentElement;
  const theme = document.querySelector('#themeToggle');
  const applyTheme = value => {
    root.dataset.theme = value;
    theme.textContent = value === 'dark' ? 'Light mode' : 'Dark mode';
    theme.setAttribute('aria-label', `Switch to ${value === 'dark' ? 'light' : 'dark'} mode`);
    document.querySelector('meta[name="theme-color"]').content = value === 'dark' ? '#151719' : '#f5f2ea';
  };
  applyTheme(root.dataset.theme);
  theme.addEventListener('click', () => {
    const value = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(value);
    try { localStorage.setItem('boxel-theme', value); } catch {}
  });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const wordmark = document.querySelector('.wordmark');
  let bounceTimer;
  function bounce() {
    if (reducedMotion.matches) return;
    clearTimeout(bounceTimer);
    wordmark.classList.remove('bouncing');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wordmark.classList.add('bouncing');
      bounceTimer = setTimeout(() => wordmark.classList.remove('bouncing'), 1300);
    }));
  }
  document.querySelector('.bounce-trigger').addEventListener('click', bounce);
  bounce();
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) wordmark.classList.remove('bouncing');
  });
  const playground = document.querySelector('.face-playground');
  const tabs = [...playground.querySelectorAll('[data-face]')];
  const swatches = [...playground.querySelectorAll('[data-color]')];
  const colors = { front: '#f36a67', top: '#eee9dc', right: '#729cf2' };
  let selected = 'front';
  function updateSwatches() {
    for (const swatch of swatches) swatch.setAttribute('aria-pressed', String(swatch.dataset.color === colors[selected]));
  }
  tabs.forEach(tab => tab.addEventListener('click', () => {
    selected = tab.dataset.face;
    tabs.forEach(item => item.setAttribute('aria-pressed', String(item === tab)));
    playground.querySelector('.paint-status').textContent = `${tab.textContent} face selected. Pick a color.`;
    updateSwatches();
  }));
  swatches.forEach(swatch => swatch.addEventListener('click', () => {
    colors[selected] = swatch.dataset.color;
    playground.style.setProperty(`--${selected}`, colors[selected]);
    const faceName = selected === 'right' ? 'Side' : selected[0].toUpperCase() + selected.slice(1);
    playground.querySelector('.paint-status').textContent = `${faceName} painted ${swatch.dataset.name.toLowerCase()}. The other faces stay as they are.`;
    updateSwatches();
  }));
  updateSwatches();
})();
