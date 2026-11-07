// Keep the standalone game's document, viewport, controls and storage intact.
// Only load it after Play. The outer URL stays under /aqua-empire/.
const params = new URLSearchParams(location.search);
const playURL = new URL(location.href);
playURL.searchParams.set('play', '1');
playURL.hash = '';
const guideURL = new URL(location.href);
guideURL.searchParams.delete('play');
guideURL.hash = '';
for (const link of document.querySelectorAll('.play-link')) link.href = playURL.href;
for (const link of document.querySelectorAll('.guide-link')) link.href = guideURL.href;
if (params.get('play') === '1') {
  params.delete('play');
  const gameURL = 'game.html' + (params.size ? '?' + params.toString() : '');
  const introduction = document.getElementById('introduction');
  const status = document.getElementById('launch-status');
  const returnLink = document.getElementById('return-guide');
  status.hidden = false;
  document.getElementById('retry-game').href = playURL.href;
  document.getElementById('direct-game').href = gameURL;
  const frame = document.createElement('iframe');
  frame.title = 'Aqua Empire aquarium game';
  frame.allow = 'fullscreen';
  frame.allowFullscreen = true;
  frame.className = 'starting';
  frame.src = gameURL;
  const player = document.getElementById('player');
  let ready = false;
  let stopped = false;
  let poll;
  const deadline = performance.now() + 30000;
  function recover(message) {
    if (stopped) return;
    stopped = true;
    clearInterval(poll);
    document.body.classList.remove('playing');
    introduction.inert = false;
    status.hidden = false;
    document.getElementById('launch-title').textContent = 'The aquarium could not open';
    document.getElementById('launch-message').textContent = message;
    player.hidden = true;
    frame.remove();
  }
  function returnToGuide(event) {
    if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyG') {
      event.preventDefault();
      location.assign(guideURL.href);
    }
  }
  function inspect() {
    if (stopped) return;
    try {
      const doc = frame.contentDocument;
      if (doc && doc.getElementById('failure')?.hidden === false) {
        recover('The game could not start its renderer. You can retry, open the standalone game, or keep reading the guide.');
        return;
      }
      if (doc?.getElementById('boot')?.hidden && frame.contentWindow.AQUA_DIAGNOSTICS) {
        const game = frame.contentWindow.AQUA_DIAGNOSTICS();
        if (game.fatal) {
          recover('The aquarium stopped. You can retry or open the standalone game.');
          return;
        }
        if (!ready && game.phase === 'Running') {
          ready = true;
          status.hidden = true;
          introduction.inert = true;
          document.body.classList.add('playing');
          frame.classList.remove('starting');
        }
        returnLink.hidden = !(ready && (game.gameState === 'home' || game.panels));
      }
    } catch {
      recover('The game document could not load. Check your connection, retry, or open the standalone game.');
    }
    if (!ready && performance.now() >= deadline) {
      recover('The game is taking too long to start. Check your connection, retry, or open the standalone game.');
    }
  }
  frame.addEventListener('load', () => {
    try {
      if (!frame.contentDocument?.getElementById('scene')) {
        recover('The game document could not load. Check your connection, retry, or open the standalone game.');
        return;
      }
      frame.contentWindow.addEventListener('keydown', returnToGuide);
      for (const type of ['keydown', 'pointerup']) {
        frame.contentWindow.addEventListener(type, () => setTimeout(inspect, 0));
      }
      inspect();
    } catch {
      recover('The game document could not load. Check your connection, retry, or open the standalone game.');
    }
  });
  frame.addEventListener('error', () => recover('The game document could not load. Check your connection and try again.'));
  window.addEventListener('keydown', returnToGuide);
  // The browser suspends timers in its back/forward cache and discards them on
  // unload. Keep the monitor alive if this document is restored from that cache.
  player.hidden = false;
  poll = setInterval(inspect, 250);
  player.append(frame);
}
