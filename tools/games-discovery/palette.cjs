'use strict';
// Exact additive palette allowance for the production-file preservation gate.
const addition = '/* Legacy light themes use selector overrides, not the gallery\'s dark variables. */\n' +
  'html[data-te-gallery="native"][data-theme="light"] :is(.games-discovery,.games-empty,.games-result-count){--text-color:#1d1d1f;--text-muted:#444;--item-bg:#fff;--border-color:#767676;--accent-purple:#0756b8;--te-accent:#0756b8}\n' +
  'html[data-te-gallery="custom"] :is(.games-discovery,.games-empty,.games-result-count){--text-color:var(--te-ink);--text-muted:var(--te-muted);--item-bg:var(--te-elem);--border-color:var(--te-line);--accent-purple:var(--te-accent)}\n';
module.exports = { addition, normalize: css => css.replace(addition, '') };
