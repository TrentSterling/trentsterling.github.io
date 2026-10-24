// Keep the standalone game's document, viewport, controls and storage intact.
// Only load it after Play. The outer URL stays under /aqua-empire/.
const params = new URLSearchParams(location.search);
const playURL = new URL(location.href);
playURL.searchParams.set('play', '1');
playURL.hash = '';
for (const link of document.querySelectorAll('.play-link')) link.href = playURL.href;
if (params.get('play') === '1') {
  params.delete('play');
  const frame = document.createElement('iframe');
  frame.title = 'Aqua Empire aquarium game';
  frame.allow = 'fullscreen';
  frame.allowFullscreen = true;
  frame.src = 'game.html' + (params.size ? '?' + params.toString() : '');
  const player = document.getElementById('player');
  document.body.classList.add('playing');
  document.getElementById('introduction').inert = true;
  player.hidden = false;
  player.append(frame);
}
