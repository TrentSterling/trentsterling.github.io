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
  // Restore the interaction used by the original museum brand page. Every
  // letter is the authored Boxel render; only its page position is animated.
  const letters = [...wordmark.querySelectorAll('img')];
  let settle;
  const resetLetters = () => letters.forEach(letter => letter.style.transform = '');
  wordmark.addEventListener('pointermove', event => {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    wordmark.classList.remove('bouncing');
    const rect = wordmark.getBoundingClientRect();
    letters.forEach((letter, index) => {
      const x = rect.left + rect.width * (index + .5) / letters.length;
      const y = rect.top + rect.height / 2;
      const dx = x - event.clientX, dy = y - event.clientY;
      const distance = Math.hypot(dx, dy) || 1;
      const push = Math.max(0, 140 - distance) / 140;
      letter.style.transform = `translate(${dx / distance * push * 35}px,${dy / distance * push * 26}px) rotate(${(index % 2 ? 1 : -1) * push * 10}deg)`;
    });
    clearTimeout(settle);
    settle = setTimeout(resetLetters, 450);
  });
  wordmark.addEventListener('pointerleave', resetLetters);
  reducedMotion.addEventListener('change', resetLetters);

  const boxelViews = {
    front: ['img/brand/one-front.png', 'One boxel, viewed from the front: white, blue and red face materials.'],
    back: ['img/brand/one-back.png', 'The same boxel from behind, showing its other face materials.'],
    below: ['img/brand/one-below.png', 'The same boxel from underneath, showing the bottom face material.'],
  };
  const faceButtons = [...document.querySelectorAll('[data-boxel-view]')];
  faceButtons.forEach(button => button.addEventListener('click', () => {
    const [src, alt] = boxelViews[button.dataset.boxelView];
    const image = document.querySelector('#face-model');
    image.src = src; image.alt = alt;
    faceButtons.forEach(view => view.setAttribute('aria-pressed', String(view === button)));
  }));
})();
