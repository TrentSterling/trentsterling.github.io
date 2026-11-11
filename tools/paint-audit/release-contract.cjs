'use strict';
function blogContract(kind, text) {
  if (kind === 'blog-css') return {
    pendingSlot: /#tront-theme-btn\[hidden\]\[data-te-pending-slot\]\s*\{[^}]*display:\s*flex\s*!important;[^}]*visibility:\s*hidden;[^}]*pointer-events:\s*none;/s.test(text),
    searchTransparent: /#search-input\s*\{[^}]*background:\s*transparent;/s.test(text),
    searchNoTween: /#search-input\s*\{[^}]*transition:\s*none;/s.test(text),
    searchFocus: /#search:focus-within\s*\{[^}]*outline:\s*2px solid var\(--te-accent\)/s.test(text)
  };
  if (kind === 'blog-page') return {
    pendingMarker: text.includes("button.setAttribute('data-te-pending-slot', '')"),
    honestDialogGate: text.includes("typeof window.HTMLDialogElement.prototype.showModal !== 'function'"),
    finalThemeLabel: /class="theme-label">\s*Theme\s*<\/span>/.test(text),
    realSearchReset: /input\.value\s*=\s*''/.test(text),
    correctBridge: text.includes('/blog/assets/css/tront-theme-bridge.css')
  };
  return {};
}
module.exports = { blogContract };
