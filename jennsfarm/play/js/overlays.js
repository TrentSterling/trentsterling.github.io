// js/overlays.js — unified overlay dismissal (#56). Every menu is a `.overlay`
// (a full-screen backdrop wrapping an `.overlay-panel`). These helpers close them
// the same way everywhere — ESC and click-the-backdrop — so any menu, current or
// future, behaves consistently with no per-menu bookkeeping. Import-safe (touches
// only querySelectorAll/classList), so the suite can unit-test it directly.

// Close every overlay. Queried live, so menus added after startup are covered too.
export function hideAllOverlays(root = document) {
    root.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
}

// Is any overlay currently open? Lets ESC decide whether it has a menu to close.
export function anyOverlayOpen(root = document) {
    return !!root.querySelector('.overlay:not(.hidden)');
}

// Give every panel a consistent corner ✕ in the top-right (in addition to the
// bottom "Close"), so closing a menu is always one obvious click. Idempotent —
// safe to call again after new panels are added. (#56)
export function initOverlayChrome(root = document) {
    root.querySelectorAll('.overlay-panel').forEach(panel => {
        if (panel.querySelector(':scope > .overlay-x')) return; // already has one
        const x = document.createElement('button');
        x.className = 'overlay-x';
        x.type = 'button';
        x.setAttribute('aria-label', 'Close');
        x.textContent = '✕';
        x.addEventListener('click', () => {
            const ov = panel.closest('.overlay');
            if (ov) ov.classList.add('hidden');
        });
        panel.prepend(x);
    });
}

// Click the dark backdrop (outside the panel) to dismiss that overlay. A single
// delegated listener covers every overlay, including ones created later. Call once.
export function initOverlayDismiss(root = document) {
    root.addEventListener('click', (e) => {
        const t = e.target;
        if (t && t.classList && t.classList.contains('overlay') && !t.classList.contains('hidden')) {
            t.classList.add('hidden');
        }
    });
}
