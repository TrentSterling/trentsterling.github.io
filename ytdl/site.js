'use strict';
const root = document.documentElement;
const modeButton = document.querySelector('#mode');
function labelMode() {
  modeButton.textContent = root.dataset.mode === 'light' ? 'Dark page' : 'Light page';
}
labelMode();
modeButton.addEventListener('click', () => {
  root.dataset.mode = root.dataset.mode === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('ytdl-page-mode', root.dataset.mode); } catch {}
  labelMode();
});

const previewDescriptions = {
  video: "Tront YouTube Downloader's compact window, showing example video download data",
  theme: 'The integrated theme view with dark and light modes, palette presets, color pickers, and gradient sliders',
  light: 'The downloader in light mode, showing example completed video and MP3 files'
};
let previewRequest = 0;
document.querySelectorAll('[data-preview]').forEach(button => button.addEventListener('click', async () => {
  const request = ++previewRequest;
  const slug = button.dataset.preview;
  const image = new Image();
  image.src = `media/${slug}.png`;
  try {
    await image.decode();
    if (request !== previewRequest) return;
    const hero = document.querySelector('#hero-image');
    hero.src = image.src;
    hero.alt = previewDescriptions[slug];
    hero.closest('a').href = image.src;
    document.querySelectorAll('[data-preview]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.querySelector('#preview-status').textContent = `${button.textContent} preview loaded.`;
  } catch {
    if (request === previewRequest) document.querySelector('#preview-status').textContent = 'Could not load that screenshot. The previous image is still shown.';
  }
}));

const lightbox = document.querySelector('#lightbox');
let lightboxTrigger;
document.querySelectorAll('[data-zoom]').forEach(link => link.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || typeof lightbox.showModal !== 'function') return;
  event.preventDefault();
  lightboxTrigger = link;
  const image = document.querySelector('#lightbox-image');
  image.src = link.href;
  image.alt = link.querySelector('img').alt;
  lightbox.showModal();
}));
document.querySelector('#close-lightbox').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('close', () => lightboxTrigger?.focus());
lightbox.addEventListener('click', event => {
  if (event.target !== lightbox) return;
  const bounds = lightbox.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) lightbox.close();
});
