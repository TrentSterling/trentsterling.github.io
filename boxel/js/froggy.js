'use strict';
(() => {
  const stage = document.querySelector('.hero-art-stage');
  const poster = document.querySelector('#hero-model');
  const canvas = document.querySelector('#frog-canvas');
  const context = canvas.getContext('2d');
  const play = document.querySelector('#frog-play');
  const scrub = document.querySelector('#frog-time');
  const clock = document.querySelector('#frog-clock');
  const status = document.querySelector('#frog-status');
  const views = [...document.querySelectorAll('[data-frog-view]')];
  const posters = { pose: 'img/froggy-neutral-v2.webp', front: 'img/froggy-front-v2.webp', back: 'img/froggy-back-v2.webp' };
  const descriptions = {
    pose: 'Froggy, a green boxel knight with silver armor, a red cape and a sword at his side.',
    front: 'Froggy from the front: gold-rimmed eyes, a blue painted crest, and a red embroidered tabard.',
    back: 'Froggy from behind: spotted green skin and a sculpted red cape with folded panels.',
  };
  // Keep view navigation usable while an animation is withdrawn for art review.
  if (play.hidden) {
    views.forEach(button => button.addEventListener('click', () => {
      const view = button.dataset.frogView;
      poster.src = posters[view];
      poster.alt = descriptions[view];
      views.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    }));
    return;
  }
  let manifest, encodedSheets, loading, playing = false, frame = 0, raf = 0, started = 0, drawRequest = 0, action = 0;
  const sheets = new Map();
  async function sheet(index) {
    if (sheets.has(index)) return sheets.get(index);
    // Keep only neighboring decoded sheets. This caps canvas-image memory on phones.
    for (const [key, value] of sheets) {
      if (Math.abs(key - index) > 1) {
        sheets.delete(key);
        value.then(bitmap => bitmap.close(), () => {});
      }
    }
    const bitmap = createImageBitmap(encodedSheets[index]);
    sheets.set(index, bitmap);
    try { return await bitmap; } catch (error) { sheets.delete(index); throw error; }
  }
  async function ready() {
    if (manifest) return;
    if (!loading) loading = fetch('img/froggy/hello-v2/animation.json').then(response => {
      if (!response.ok) throw new Error('Animation unavailable');
      return response.json();
    }).then(async value => {
      // Buffer compressed bytes before playback so network jitter cannot stutter
      // the greeting. Decoded bitmaps remain limited to neighboring sheets.
      const blobs = await Promise.all(value.sheets.map(async url => {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Animation image unavailable');
        return response.blob();
      }));
      encodedSheets = blobs;
      manifest = value;
    }).catch(error => { loading = null; throw error; });
    await loading;
  }
  function stop() {
    ++action;
    ++drawRequest;
    playing = false;
    cancelAnimationFrame(raf);
    play.textContent = 'Play greeting';
    play.setAttribute('aria-pressed', 'false');
  }
  async function draw(value) {
    const ticket = ++drawRequest;
    const index = Math.min(95, Math.max(0, value));
    const bitmap = await sheet(Math.floor(index / 8));
    if (ticket !== drawRequest) return;
    context.clearRect(0, 0, 600, 600);
    context.drawImage(bitmap, (index % 4) * 600, Math.floor(index % 8 / 4) * 600, 600, 600, 0, 0, 600, 600);
    canvas.hidden = false;
    poster.hidden = true;
    frame = index;
    scrub.value = String(index);
    clock.textContent = `${(index / 24).toFixed(1)} / 4.0 s`;
    scrub.setAttribute('aria-valuetext', `${(index / 24).toFixed(1)} seconds of 4`);
    if (playing && index % 8 === 0) {
      const next = (Math.floor(index / 8) + 1) % manifest.sheets.length;
      void sheet(next).catch(() => {});
    }
  }
  function fail() {
    stop();
    canvas.hidden = true;
    poster.hidden = false;
    status.textContent = 'The animation could not load. Try Play greeting again.';
  }
  async function tick(now) {
    if (!playing) return;
    try {
      const elapsed = (now - started) / 1000;
      await draw(Math.min(95, Math.floor(elapsed * 24)));
      if (elapsed >= 4) { stop(); play.textContent = 'Replay greeting'; return; }
      if (playing) raf = requestAnimationFrame(tick);
    } catch { fail(); }
  }
  play.addEventListener('click', async () => {
    if (playing) { stop(); return; }
    const request = ++action;
    play.disabled = true;
    status.textContent = 'Loading Froggy’s greeting…';
    try {
      await ready();
      if (request !== action) return;
      if (frame >= 95) frame = 0;
      document.querySelector('.frog-timeline').hidden = false;
      await draw(frame);
      if (request !== action) return;
      views.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.frogView === 'pose')));
      playing = true;
      started = performance.now() - frame / 24 * 1000;
      play.textContent = 'Pause';
      play.setAttribute('aria-pressed', 'true');
      status.textContent = '';
      raf = requestAnimationFrame(tick);
    } catch { fail(); }
    finally { play.disabled = false; }
  });
  scrub.addEventListener('input', async () => {
    stop();
    const request = action;
    try {
      await ready();
      if (request !== action) return;
      await draw(Number(scrub.value));
      views.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.frogView === 'pose')));
      status.textContent = '';
    }
    catch { fail(); }
  });
  views.forEach(button => button.addEventListener('click', () => {
    stop();
    ++drawRequest;
    frame = 0;
    scrub.value = '0';
    document.querySelector('.frog-timeline').hidden = true;
    const view = button.dataset.frogView;
    poster.src = posters[view];
    poster.alt = descriptions[view];
    poster.hidden = false;
    canvas.hidden = true;
    views.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    status.textContent = '';
  }));
  new IntersectionObserver(entries => { if (!entries[0].isIntersecting) stop(); }).observe(stage);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
})();
