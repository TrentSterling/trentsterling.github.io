// js/buildmenu.js — the Sims-style "Build" catalog. A single panel listing every
// placeable: structures (beehive, coop) and cosmetic decor. Picking one closes the
// panel and hands the entry to the caller, which enters placement mode. Reuses the
// shared shop-item styling so it matches every other panel (#56).

const overlay = document.getElementById('build-overlay');
const list = document.getElementById('build-items');

function row(entry, coins, count) {
    const div = document.createElement('div');
    div.className = 'shop-item';
    const maxed = entry.max != null && count >= entry.max;
    const afford = coins >= entry.cost && !maxed;
    if (!afford) div.classList.add('cant-afford');
    const built = count != null ? ` · ${count}${entry.max ? '/' + entry.max : ''} built` : '';
    const note = (entry.note || '') + built;
    div.innerHTML = `
        <div class="item-info">
            <span class="item-name">${entry.emoji} ${entry.name}</span>
            <span class="item-qty">${maxed ? 'at limit' : note}</span>
        </div>
        <span class="item-price">🪙 ${entry.cost}</span>`;
    return { div, afford };
}

// catalog: [{ id, emoji, name, cost, note, max?, count? , start() }]
export function showBuildMenu(coins, catalog, onPick) {
    if (!list || !overlay) return;
    list.innerHTML = '';
    let section = null;
    for (const entry of catalog) {
        if (entry.section && entry.section !== section) {
            section = entry.section;
            const h = document.createElement('div');
            h.className = 'shop-header';
            h.textContent = section;
            list.appendChild(h);
            continue;
        }
        const { div, afford } = row(entry, coins, entry.count);
        if (afford) div.addEventListener('click', () => onPick(entry));
        list.appendChild(div);
    }
    overlay.classList.remove('hidden');
}

export function hideBuildMenu() { if (overlay) overlay.classList.add('hidden'); }
export function isBuildMenuOpen() { return overlay && !overlay.classList.contains('hidden'); }
