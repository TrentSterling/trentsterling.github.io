(() => {
  'use strict';
  const cards = [...document.querySelectorAll('[data-preview]')];
  const button = document.getElementById('preview-toggle');
  if (!cards.length || !button || !('IntersectionObserver' in window)) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const smallScreen = matchMedia('(max-width: 700px)');
  const connection = navigator.connection;
  const failed = new WeakSet();
  const lastStarted = new WeakMap();
  const turnMs = 6500;
  let userPaused = false;
  try { userPaused = localStorage.getItem('tront-previews-paused') === 'true'; } catch {}
  let timer = 0, frame = 0, stopped = false, hovered = null, focused = null;

  // Fill the visible desktop grid while keeping decoder allocation bounded.
  const slots = Array.from({length:12}, () => {
    const video = document.createElement('video');
    video.className = 'gameplay-preview';
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    video.tabIndex = -1;
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('disableremoteplayback', '');
    return {video, card:null, generation:0};
  });

  function release(slot) {
    if (!slot.card) return;
    slot.generation++;
    slot.card.classList.remove('preview-playing');
    slot.video.onplaying = slot.video.onerror = null;
    slot.video.pause();
    slot.video.removeAttribute('src');
    slot.video.load();
    slot.video.remove();
    slot.card = null;
  }

  function start(slot, card) {
    const token = ++slot.generation;
    slot.card = card;
    lastStarted.set(card, performance.now());
    card.appendChild(slot.video);
    const unavailable = () => {
      if (slot.generation !== token) return;
      failed.add(card);
      release(slot);
      schedule();
    };
    slot.video.onplaying = () => {
      if (slot.generation === token) card.classList.add('preview-playing');
    };
    slot.video.onerror = unavailable;
    slot.video.src = card.dataset.preview;
    slot.video.play().catch(unavailable);
  }

  function eligible(card) {
    if (failed.has(card) || !card.getClientRects().length) return false;
    const r = card.getBoundingClientRect();
    const top = Math.max(r.top, 64), bottom = Math.min(r.bottom, innerHeight);
    const left = Math.max(r.left, 0), right = Math.min(r.right, innerWidth);
    const fraction = r.width > 0 && r.height > 0 ? Math.max(0, bottom-top)*Math.max(0, right-left)/(r.width*r.height) : 0;
    return fraction > 0 && (fraction >= .55 || card === hovered || card === focused);
  }

  function update(rotate = false) {
    clearTimeout(timer);
    timer = 0;
    const constrained = reduced.matches || !!connection?.saveData;
    button.hidden = false;
    button.disabled = constrained;
    button.textContent = constrained ? 'Previews paused' : userPaused ? 'Play previews' : 'Pause previews';
    button.setAttribute('aria-pressed', String(userPaused || constrained));
    button.title = reduced.matches ? 'Paused for your reduced motion preference' : connection?.saveData ? 'Paused while data saver is on' : '';
    if (stopped || document.hidden || userPaused || constrained) {
      slots.forEach(release);
      return;
    }
    const limit = smallScreen.matches ? 2 : navigator.deviceMemory && navigator.deviceMemory <= 4 ? 4 : 12;
    const visible = cards.filter(eligible);
    const now = performance.now();
    const keep = slots.filter(s => s.card && visible.includes(s.card) && (!rotate || visible.length <= limit || now-(lastStarted.get(s.card)||0) < turnMs-100));
    const priority = [focused, hovered].filter(c=>c && visible.includes(c));
    const chosen = [...new Set([...priority, ...keep.map(s=>s.card)])].slice(0, limit);
    const waiting = visible.filter(c=>!chosen.includes(c)).sort((a,b)=>{
      const age=(lastStarted.get(a)||0)-(lastStarted.get(b)||0);
      if (age) return age;
      return Math.abs(a.getBoundingClientRect().top-innerHeight*.35)-Math.abs(b.getBoundingClientRect().top-innerHeight*.35);
    });
    chosen.push(...waiting.slice(0, limit-chosen.length));
    // Release first, then assign, so scroll/resize never exceeds the cap.
    slots.filter(s=>s.card&&!chosen.includes(s.card)).forEach(release);
    for (const card of chosen) {
      if (!slots.some(s=>s.card===card)) start(slots.find(s=>!s.card),card);
    }
    if (visible.length > limit) timer = setTimeout(()=>update(true), turnMs);
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(()=>{frame=0;update();});
  }
  const observer = new IntersectionObserver(schedule,{threshold:[0,.55,1]});
  cards.forEach(c=>{
    observer.observe(c);
    const link = c.closest('a') || c;
    link.addEventListener('pointerenter', e=>{if(e.pointerType==='mouse'){hovered=c;schedule();}});
    link.addEventListener('pointerleave', ()=>{if(hovered===c){hovered=null;schedule();}});
    link.addEventListener('focus', ()=>{focused=c;schedule();});
    link.addEventListener('blur', ()=>{if(focused===c){focused=null;schedule();}});
  });
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  document.querySelectorAll('input[name="filter"]').forEach(input=>input.addEventListener('change',schedule));
  document.addEventListener('visibilitychange',()=>update());
  reduced.addEventListener('change',()=>update());
  smallScreen.addEventListener('change',()=>update());
  connection?.addEventListener('change',()=>update());
  addEventListener('pagehide',()=>{stopped=true;cancelAnimationFrame(frame);frame=0;update();});
  addEventListener('pageshow',()=>{stopped=false;update();});
  button.addEventListener('click',()=>{
    userPaused=!userPaused;
    try {localStorage.setItem('tront-previews-paused',String(userPaused));} catch {}
    update();
  });
  update();
})();
