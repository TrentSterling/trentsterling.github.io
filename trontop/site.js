'use strict';
const modeButton = document.querySelector('#mode');
function labelMode() { modeButton.textContent = document.documentElement.dataset.mode === 'light' ? 'Dark page' : 'Light page'; }
labelMode();
modeButton.addEventListener('click', () => {
  const mode = document.documentElement.dataset.mode === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.mode = mode;
  try { localStorage.setItem('trontop-site-mode', mode); } catch {}
  labelMode();
});
let previewRequest = 0;
document.querySelectorAll('[data-preview]').forEach(button => button.addEventListener('click', async () => {
  const request = ++previewRequest;
  const slug = button.dataset.preview;
  const image = new Image();
  image.src = `media/${slug}-overview.png`;
  try {
    await image.decode();
    if (request !== previewRequest) return;
    const hero = document.querySelector('#hero-image');
    hero.src = image.src;
    hero.alt = `Trontop Overview in the ${button.textContent} theme, rendered with demo data`;
    hero.closest('a').href = image.src;
    document.querySelector('#active-theme').textContent = button.textContent;
    document.querySelectorAll('[data-preview]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.querySelector('#preview-status').textContent = `${button.textContent} theme loaded.`;
  } catch {
    if (request === previewRequest) document.querySelector('#preview-status').textContent = 'Could not load that preview. The previous image is still shown.';
  }
}));
const lightbox = document.querySelector('#lightbox');
document.querySelectorAll('[data-zoom]').forEach(link => link.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || !lightbox.showModal) return;
  event.preventDefault();
  const image = document.querySelector('#lightbox-image');
  image.src = link.href;
  image.alt = link.querySelector('img').alt;
  document.querySelector('#lightbox-caption').textContent = image.alt;
  lightbox.showModal();
}));
document.querySelector('#close-lightbox').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', event => { if (event.target === lightbox && event.clientX < lightbox.getBoundingClientRect().left) lightbox.close(); });
