// tront-theme.js — 5-way theme cycle for tront.xyz
(function () {
    var THEMES = [
        { id: 'dark',         icon: '\uD83C\uDF19', label: 'Dark' },
        { id: 'tront-cyan',   icon: '\u26A1',       label: 'Cyan' },
        { id: 'tront-purple', icon: '\uD83D\uDD2E', label: 'Purple' },
        { id: 'tront-ember',  icon: '\uD83D\uDD25', label: 'Ember' },
        { id: 'light',        icon: '\u2600\uFE0F', label: 'Light' }
    ];
    var KEY = 'tront-theme';

    function getIndex() {
        var stored = localStorage.getItem(KEY) || 'dark';
        for (var i = 0; i < THEMES.length; i++) {
            if (THEMES[i].id === stored) return i;
        }
        return 0;
    }

    function apply(theme) {
        if (theme.id === 'dark') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', theme.id);
        }
        localStorage.setItem(KEY, theme.id);
    }

    function updateBtn(btn, theme) {
        var span = btn.querySelector('.theme-label');
        btn.querySelector('.theme-icon').textContent = theme.icon;
        if (span) span.textContent = ' ' + theme.label;
    }

    function init() {
        var btn = document.getElementById('tront-theme-btn');
        if (!btn) return;

        var idx = getIndex();
        updateBtn(btn, THEMES[idx]);

        btn.addEventListener('click', function () {
            idx = (idx + 1) % THEMES.length;
            apply(THEMES[idx]);
            updateBtn(btn, THEMES[idx]);
        });
    }

    // Expose for pages that build navbar via JS (games/md)
    window.trontThemeInit = init;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
