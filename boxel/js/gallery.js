'use strict';
(() => {
  const links = [...document.querySelectorAll('.model-shelf a')];
  const dialog = document.querySelector('#art-viewer');
  const image = dialog.querySelector('img');
  const caption = dialog.querySelector('#art-caption');
  const count = dialog.querySelector('#art-count');
  let current = 0;
  const show = index => {
    current = (index + links.length) % links.length;
    const link = links[current];
    image.src = link.href;
    image.alt = link.querySelector('img').alt;
    caption.textContent = link.querySelector('span').textContent;
    count.textContent = `${current + 1} / ${links.length}`;
  };
  links.forEach((link, index) => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    show(index);
    dialog.showModal();
  }));
  dialog.querySelector('[data-art-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-art-prev]').addEventListener('click', () => show(current - 1));
  dialog.querySelector('[data-art-next]').addEventListener('click', () => show(current + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => links[current].focus({preventScroll:true}));
})();
