import { ITEMS } from './inventory.js';
import { CROPS } from './farm.js';
import { getFarmLevel, getNextExpansionCost } from './world.js';
import { createToolIcon } from './textures.js';
import { ANIMALS } from './animals.js';
import { RECIPES } from './craft.js';
import { FACTORY_TYPES, ownsFactory, getFactories, employeeCost } from './factories.js';
import { getRank, getLifetime, getRankProgress, getSellBonus } from './corp.js';
import { sellableValue } from './market.js';
import { getToolName, nextUpgrade } from './equipment.js';
import { healValue } from './foods.js';
import { getHiveCount, HIVE_COST } from './bees.js';
import { getCoopCount, COOP_COST } from './coop.js';
import { hasFountain, FOUNTAIN_COST } from './fountain.js';
import { hasPet, PET_COST } from './pets.js';
import { hasFoodBowl, FOOD_BOWL_COST } from './visitors.js';
import { hasGreenhouse, GREENHOUSE_COST } from './greenhouse.js';
import { getFlytrapCount, FLYTRAP_COST } from './flytrap.js';

// Handlers registered once by main.js (avoids threading through every showShop call)
let _onUpgrade = null, _onBuyHive = null, _onBuyFountain = null, _onBuyPet = null, _onBuyFoodBowl = null, _onBuyGreenhouse = null, _onBuyFlytrap = null, _onBuyCoop = null;
export function setShopHandlers({ onUpgrade, onBuyHive, onBuyFountain, onBuyPet, onBuyFoodBowl, onBuyGreenhouse, onBuyFlytrap, onBuyCoop } = {}) {
    if (onUpgrade) _onUpgrade = onUpgrade;
    if (onBuyHive) _onBuyHive = onBuyHive;
    if (onBuyFountain) _onBuyFountain = onBuyFountain;
    if (onBuyPet) _onBuyPet = onBuyPet;
    if (onBuyFoodBowl) _onBuyFoodBowl = onBuyFoodBowl;
    if (onBuyGreenhouse) _onBuyGreenhouse = onBuyGreenhouse;
    if (onBuyFlytrap) _onBuyFlytrap = onBuyFlytrap;
    if (onBuyCoop) _onBuyCoop = onBuyCoop;
}

// Small helper for the emoji-based "buildables" rows in the shop
function shopBuildRow(emoji, label, note, cost, can, owned, onBuy) {
    const div = document.createElement('div');
    div.className = 'shop-item';
    if (owned) {
        div.innerHTML = `<div class="item-info"><span class="item-name">${emoji} ${label}</span><span class="item-qty">${note}</span></div><span class="item-price">✓</span>`;
    } else {
        if (!can) div.classList.add('cant-afford');
        div.innerHTML = `<div class="item-info"><span class="item-name">${emoji} ${label}</span><span class="item-qty">${note}</span></div><span class="item-price">🪙 ${cost}</span>`;
        if (can && onBuy) div.addEventListener('click', () => onBuy());
    }
    return div;
}

// DOM refs
const hudCoins = document.getElementById('hud-coins');
const hudDay = document.getElementById('hud-day');
const hudTime = document.getElementById('hud-time');
const toolLabel = document.getElementById('tool-label');
const hotbarEl = document.getElementById('hotbar');
const tooltipEl = document.getElementById('tooltip');
const shopOverlay = document.getElementById('shop-overlay');
const shopItems = document.getElementById('shop-items');
const marketOverlay = document.getElementById('market-overlay');
const marketItems = document.getElementById('market-items');
const barnOverlay = document.getElementById('barn-overlay');
const barnItems = document.getElementById('barn-items');
const barnCapacityEl = document.getElementById('barn-capacity');
const notifEl = document.getElementById('notification');
const bagEl = document.getElementById('bag');
const healthEl = document.getElementById('health');
const healthFill = document.getElementById('health-fill');
const craftOverlay = document.getElementById('craft-overlay');
const craftItems = document.getElementById('craft-items');
const factoryOverlay = document.getElementById('factory-overlay');
const factoryItems = document.getElementById('factory-items');
const homeOverlay = document.getElementById('home-overlay');
const homeItems = document.getElementById('home-items');
const homeNote = document.getElementById('home-note');

let notifTimer = null;

// --- Hotbar ---

const HOTBAR_SLOTS = [
    { id: 'move',       label: 'Walk' },
    { id: 'hoe',        label: 'Hoe' },
    { id: 'water',      label: 'Water' },
    { id: 'hand',       label: 'Harvest' },
    { id: 'axe',        label: 'Axe' },
    { id: 'sprinkler',  label: 'Sprinkler' },
    { id: 'carrot_seed', label: 'Carrot Seeds' },
    { id: 'tomato_seed', label: 'Tomato Seeds' },
    { id: 'potato_seed', label: 'Potato Seeds' },
    { id: 'wheat_seed',  label: 'Wheat Seeds' },
    { id: 'strawberry_seed', label: 'Strawberry Seeds' },
    { id: 'mint_seed',   label: 'Mint Seeds' },
    { id: 'lavender_seed', label: 'Lavender Seeds' },
    { id: 'tulip_seed',  label: 'Tulip Bulbs' },
    { id: 'sunflower_seed', label: 'Sunflower Seeds' },
    { id: 'rose_seed',   label: 'Rose Seeds' },
    { id: 'square_watermelon_seed', label: 'Square Melon Seeds' },
    { id: 'grape_seed',  label: 'Grape Vine' },
    { id: 'dragonfruit_seed', label: 'Dragonfruit' },
    { id: 'golden_pumpkin_seed', label: 'Golden Pumpkin' },
];

export function getHotbarSlots() { return HOTBAR_SLOTS; }

// Cache icons (canvas) AND their encoded data-URLs. toDataURL() re-encodes a PNG
// every call, which is surprisingly heavy when the hotbar rebuilds on every
// refreshUI — so cache the string and reuse it.
const iconCache = {};
const iconURLCache = {};
function getIcon(id) {
    if (!iconCache[id]) {
        iconCache[id] = createToolIcon(id);
    }
    return iconCache[id];
}
function getIconURL(id) {
    if (!iconURLCache[id]) iconURLCache[id] = getIcon(id).toDataURL();
    return iconURLCache[id];
}

export function updateHotbar(selectedIndex, inventory, onSelect) {
    hotbarEl.innerHTML = '';
    let seedBreakInserted = false;
    HOTBAR_SLOTS.forEach((slot, i) => {
        // Force seeds onto their own row(s), separate from the tool group
        if (!seedBreakInserted && slot.id.endsWith('_seed')) {
            const br = document.createElement('div');
            br.className = 'hotbar-break';
            hotbarEl.appendChild(br);
            seedBreakInserted = true;
        }

        const div = document.createElement('div');
        div.className = 'hotbar-slot';
        if (i === selectedIndex) div.classList.add('selected');

        // Seeds and placeables (sprinkler) show a stock count and grey out at 0
        const isCountable = slot.id.endsWith('_seed') || slot.id === 'sprinkler';
        const qty = isCountable ? inventory.count(slot.id) : null;
        if (isCountable && qty <= 0) div.classList.add('disabled');

        // Key hint
        const keyHint = document.createElement('span');
        keyHint.className = 'hotbar-key';
        keyHint.textContent = i + 1;
        div.appendChild(keyHint);

        // Icon
        const img = document.createElement('img');
        img.className = 'hotbar-icon';
        img.src = getIconURL(slot.id);
        div.appendChild(img);

        // Quantity for seeds & placeables
        if (isCountable) {
            const qtyEl = document.createElement('span');
            qtyEl.className = 'hotbar-qty';
            qtyEl.textContent = qty;
            div.appendChild(qtyEl);
        }

        div.addEventListener('click', () => onSelect(i));

        // Tooltip on hover
        div.addEventListener('mouseenter', (e) => {
            showTooltip(slot.label, e.clientX, e.clientY - 60);
        });
        div.addEventListener('mouseleave', hideTooltip);

        hotbarEl.appendChild(div);
    });
}

// --- HUD ---

export function updateHUD(coins, day, timeStr, season) {
    hudCoins.textContent = `🪙 ${coins}`;
    hudDay.textContent = season ? `${season.emoji} Day ${day}` : `Day ${day}`;
    if (timeStr && hudTime) hudTime.textContent = timeStr;
}

export function updateToolLabel(name) {
    toolLabel.textContent = name;
}

// --- Bag (held crops/produce/materials) ---

export function updateBag(inventory, onEat) {
    if (!bagEl) return;
    const held = Object.entries(ITEMS).filter(([id, v]) => v.type === 'crop' && inventory.count(id) > 0);
    if (!held.length) { bagEl.innerHTML = ''; return; }
    bagEl.innerHTML = '<div class="bag-title">🎒 Bag <span class="bag-hint">click to eat</span></div>' + held
        .map(([id, v]) => `<div class="bag-chip" data-id="${id}"><span>${v.name}</span><span class="n">×${inventory.count(id)}</span></div>`)
        .join('');
    bagEl.querySelectorAll('.bag-chip').forEach(c => {
        const id = c.dataset.id;
        if (onEat) c.addEventListener('click', () => onEat(id));
        // Hover: show what it's worth + how much it heals, so you can choose to eat or sell
        const heal = healValue(id);
        const sell = ITEMS[id] ? ITEMS[id].sellPrice : 0;
        const tip = `Sells 🪙${sell} · ${heal > 0 ? '💚 +' + heal + ' health' : 'not food'}`;
        c.addEventListener('mouseenter', (e) => showTooltip(tip, e.clientX, e.clientY - 50));
        c.addEventListener('mouseleave', hideTooltip);
    });
}

// --- Health bar ---
export function updateHealth(h, max) {
    if (!healthFill) return;
    const pct = Math.max(0, Math.min(100, (h / max) * 100));
    healthFill.style.width = pct + '%';
    healthFill.style.background = pct < 25 ? '#e05a5a' : pct < 55 ? '#e0b24a' : 'linear-gradient(90deg,#6fd06f,#9be88a)';
    if (healthEl) healthEl.classList.toggle('low', pct < 25);
}

// --- Tooltip ---

export function showTooltip(text, x, y) {
    tooltipEl.style.display = 'block';
    tooltipEl.textContent = text;
    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
}

export function hideTooltip() {
    tooltipEl.style.display = 'none';
}

// --- Notification ---

export function notify(text) {
    notifEl.textContent = text;
    notifEl.classList.add('show');
    if (notifTimer) clearTimeout(notifTimer);
    notifTimer = setTimeout(() => {
        notifEl.classList.remove('show');
    }, 2000);
}

// --- Shop ---

function shopHeader(text) {
    const h = document.createElement('div');
    h.className = 'shop-header';
    h.textContent = text;
    return h;
}

export function showShop(coins, inventory, onBuy, onExpand, onBarnUpgrade, barnUpgradeCost, onBuyAnimal) {
    shopItems.innerHTML = '';

    // Farm expansion option
    const cost = getNextExpansionCost();
    if (cost !== null) {
        const level = getFarmLevel();
        const div = document.createElement('div');
        div.className = 'shop-item';
        if (coins < cost) div.classList.add('cant-afford');
        div.innerHTML = `
            <div class="item-info">
                <span class="item-name">🌿 Expand Farm (Lv${level + 1})</span>
            </div>
            <span class="item-price">🪙 ${cost}</span>
        `;
        if (coins >= cost) {
            div.addEventListener('click', () => onExpand());
        }
        shopItems.appendChild(div);
    }

    // Barn upgrade option
    if (barnUpgradeCost !== null && onBarnUpgrade) {
        const div = document.createElement('div');
        div.className = 'shop-item';
        if (coins < barnUpgradeCost) div.classList.add('cant-afford');
        div.innerHTML = `
            <div class="item-info">
                <span class="item-name">🏚 Upgrade Barn (+50 slots)</span>
            </div>
            <span class="item-price">🪙 ${barnUpgradeCost}</span>
        `;
        if (coins >= barnUpgradeCost) {
            div.addEventListener('click', () => onBarnUpgrade());
        }
        shopItems.appendChild(div);
    }

    shopItems.appendChild(shopHeader('🌱 Seeds'));

    // Seeds
    const seeds = Object.entries(ITEMS).filter(([, v]) => v.type === 'seed');
    for (const [id, item] of seeds) {
        const div = document.createElement('div');
        div.className = 'shop-item';
        if (coins < item.buyPrice) div.classList.add('cant-afford');

        div.innerHTML = `
            <div class="item-info">
                <img class="item-icon" src="${getIconURL(id)}">
                <span class="item-name">${item.name}</span>
            </div>
            <span class="item-price">🪙 ${item.buyPrice}</span>
        `;

        if (coins >= item.buyPrice) {
            div.addEventListener('click', () => onBuy(id));
        }
        shopItems.appendChild(div);
    }

    // Tools / placeables section
    const tools = Object.entries(ITEMS).filter(([, v]) => v.type === 'tool');
    if (tools.length) {
        shopItems.appendChild(shopHeader('🔧 Tools'));
        for (const [id, item] of tools) {
            const div = document.createElement('div');
            div.className = 'shop-item';
            if (coins < item.buyPrice) div.classList.add('cant-afford');
            div.innerHTML = `
                <div class="item-info">
                    <img class="item-icon" src="${getIconURL(id)}">
                    <span class="item-name">${item.name}</span>
                    <span class="item-qty">auto-waters nearby tiles</span>
                </div>
                <span class="item-price">🪙 ${item.buyPrice}</span>
            `;
            if (coins >= item.buyPrice) div.addEventListener('click', () => onBuy(id));
            shopItems.appendChild(div);
        }
    }

    // Animals section
    if (onBuyAnimal && ANIMALS) {
        shopItems.appendChild(shopHeader('🐾 Animals'));

        const emoji = { chicken: '🐔', rooster: '🐓', goat: '🐐', cow: '🐄' };
        for (const id in ANIMALS) {
            const a = ANIMALS[id];
            const div = document.createElement('div');
            div.className = 'shop-item';
            if (coins < a.cost) div.classList.add('cant-afford');
            const note = a.produce
                ? `makes ${a.produce === 'goat_milk' ? 'goat milk' : a.produce === 'cow_milk' ? 'cow milk' : a.produce}`
                : 'farm friend';
            div.innerHTML = `
                <div class="item-info">
                    <span class="item-name">${emoji[id] || '🐾'} ${a.name}</span>
                    <span class="item-qty">${note}</span>
                </div>
                <span class="item-price">🪙 ${a.cost}</span>
            `;
            if (coins >= a.cost) {
                div.addEventListener('click', () => onBuyAnimal(id));
            }
            shopItems.appendChild(div);
        }
    }

    // Equipment upgrades — widen a tool's work area (single tile → 3x3 → 5x5) (#33)
    if (_onUpgrade) {
        shopItems.appendChild(shopHeader('⬆️ Tool Upgrades'));
        for (const tool of ['water', 'hoe']) {
            const up = nextUpgrade(tool);
            const div = document.createElement('div');
            div.className = 'shop-item';
            if (!up) {
                div.innerHTML = `
                    <div class="item-info">
                        <span class="item-name">🔧 ${getToolName(tool)}</span>
                        <span class="item-qty">max tier</span>
                    </div>
                    <span class="item-price">✓</span>`;
            } else {
                if (coins < up.cost) div.classList.add('cant-afford');
                div.innerHTML = `
                    <div class="item-info">
                        <span class="item-name">🔧 ${up.name}</span>
                        <span class="item-qty">covers a bigger area</span>
                    </div>
                    <span class="item-price">🪙 ${up.cost}</span>`;
                if (coins >= up.cost) div.addEventListener('click', () => _onUpgrade(tool));
            }
            shopItems.appendChild(div);
        }
    }

    // Buildables: beehive (#44), wishing fountain (#47), pet (#48)…
    if (_onBuyHive || _onBuyFountain || _onBuyPet || _onBuyFoodBowl || _onBuyGreenhouse || _onBuyFlytrap || _onBuyCoop) shopItems.appendChild(shopHeader('🏗️ Buildings & Pets'));
    if (_onBuyHive) shopItems.appendChild(shopBuildRow('🐝', 'Beehive', `makes honey · ${getHiveCount()} built`, HIVE_COST, coins >= HIVE_COST, getHiveCount() >= 6, _onBuyHive));
    if (_onBuyCoop) shopItems.appendChild(shopBuildRow('🐔', 'Chicken Coop', `lays eggs on its own · ${getCoopCount()} built`, COOP_COST, coins >= COOP_COST, getCoopCount() >= 6, _onBuyCoop));
    if (_onBuyFountain) shopItems.appendChild(shopBuildRow('⛲', 'Wishing Fountain', 'toss a coin for luck', FOUNTAIN_COST, coins >= FOUNTAIN_COST, hasFountain(), _onBuyFountain));
    if (_onBuyPet) {
        shopItems.appendChild(shopBuildRow('🐕', 'Puppy', 'follows you + fetches drops', PET_COST, coins >= PET_COST, hasPet(), () => _onBuyPet('dog')));
        shopItems.appendChild(shopBuildRow('🐈', 'Kitten', 'a cat of your own — follows + fetches', PET_COST, coins >= PET_COST, hasPet(), () => _onBuyPet('cat')));
    }
    if (_onBuyFoodBowl) shopItems.appendChild(shopBuildRow('🥣', 'Food Bowl', 'draws more visitor cats', FOOD_BOWL_COST, coins >= FOOD_BOWL_COST, hasFoodBowl(), _onBuyFoodBowl));
    if (_onBuyGreenhouse) shopItems.appendChild(shopBuildRow('🌿', 'Greenhouse', 'crops grow full-speed year-round', GREENHOUSE_COST, coins >= GREENHOUSE_COST, hasGreenhouse(), _onBuyGreenhouse));
    if (_onBuyFlytrap) shopItems.appendChild(shopBuildRow('🪤', 'Flytrap', `snaps crows, never skunks · ${getFlytrapCount()}`, FLYTRAP_COST, coins >= FLYTRAP_COST, getFlytrapCount() >= 6, _onBuyFlytrap));

    shopOverlay.classList.remove('hidden');
}

export function hideShop() {
    shopOverlay.classList.add('hidden');
}

// --- Market ---

export function showMarket(inventory, onSell, getPrice, getTrend, onSellAll) {
    marketItems.innerHTML = '';

    // Build the sellable rows the player actually holds, valued at current price,
    // and sort most-valuable-stack first so the good stuff is on top.
    const rows = [];
    for (const [id, item] of Object.entries(ITEMS)) {
        if (item.type !== 'crop') continue;
        const qty = inventory.count(id);
        if (qty <= 0) continue;
        const price = getPrice ? getPrice(id) : item.sellPrice;
        rows.push({ id, item, qty, price, stack: price * qty });
    }
    rows.sort((a, b) => b.stack - a.stack);

    if (rows.length === 0) {
        marketItems.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Nothing to sell!</p>';
        marketOverlay.classList.remove('hidden');
        return;
    }

    // Bag-value header — total worth of everything sellable, at a glance.
    const bag = sellableValue(inventory);
    const header = document.createElement('div');
    header.className = 'market-total';
    header.innerHTML = `Bag value <span>🪙 ${bag.total.toLocaleString()}</span> · ${bag.count} item${bag.count === 1 ? '' : 's'}`;
    marketItems.appendChild(header);

    for (const { id, item, qty, price, stack } of rows) {
        const trend = getTrend ? getTrend(id) : 0;
        const arrow = trend > 0 ? '<span class="trend up">▲ hot</span>'
                    : trend < 0 ? '<span class="trend down">▼ glut</span>' : '';

        const div = document.createElement('div');
        div.className = 'market-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="item-name">${item.name}</span>
                <span class="item-qty">x${qty}</span>
            </div>
            <span class="item-price"><span class="ea">🪙 ${price} ea ${arrow}</span><small>🪙 ${stack.toLocaleString()}</small></span>
        `;
        div.title = `Sell all ${qty} for 🪙 ${stack.toLocaleString()}`;
        div.addEventListener('click', () => onSell(id));
        marketItems.appendChild(div);
    }

    if (onSellAll) {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.textContent = `Sell All · 🪙 ${bag.total.toLocaleString()}`;
        btn.addEventListener('click', () => onSellAll());
        marketItems.appendChild(btn);
    }
    marketOverlay.classList.remove('hidden');
}

export function hideMarket() {
    marketOverlay.classList.add('hidden');
}

// --- Workshop / crafting ---

export function showCraft(inventory, onCraft) {
    craftItems.innerHTML = '';
    for (const id in RECIPES) {
        const r = RECIPES[id];
        const out = ITEMS[r.out];
        const can = Object.keys(r.inputs).every(k => inventory.count(k) >= r.inputs[k]);
        const needs = Object.keys(r.inputs)
            .map(k => `${r.inputs[k]}× ${ITEMS[k] ? ITEMS[k].name : k}`)
            .join(', ');
        const div = document.createElement('div');
        div.className = 'craft-row' + (can ? '' : ' cant');
        div.innerHTML = `
            <div class="item-info">
                <span class="item-name">${r.name} <span style="color:#9c8;">· 🪙${out ? out.sellPrice : '?'}</span></span>
                <span class="needs">${needs}</span>
            </div>
            <button class="craft-mix" ${can ? '' : 'disabled'}>Mix</button>
        `;
        const btn = div.querySelector('.craft-mix');
        if (can) btn.addEventListener('click', () => onCraft(id));
        craftItems.appendChild(div);
    }
    craftOverlay.classList.remove('hidden');
}

export function hideCraft() {
    craftOverlay.classList.add('hidden');
}

// --- Factories (auto-production) ---

export function showFactory(coins, inventory, onBuild, onHire) {
    factoryItems.innerHTML = '';

    // Corporate-rank banner: your company value + the climb to Shampoo Corp (corp.js)
    const rank = getRank();
    const prog = Math.round(getRankProgress() * 100);
    const nextLine = rank.next
        ? `Next: ${rank.next.emoji} ${rank.next.name} at 🪙${rank.next.need.toLocaleString()}`
        : 'Top rank reached! 🎉';
    const banner = document.createElement('div');
    banner.className = 'corp-banner';
    banner.innerHTML = `
        <div class="corp-top"><span class="corp-rank">${rank.emoji} ${rank.name}</span><span class="corp-bonus">+${Math.round(getSellBonus() * 100)}% sales</span></div>
        <div class="corp-sub">Company value 🪙${getLifetime().toLocaleString()} · ${nextLine}</div>
        <div class="corp-track"><div class="corp-fill" style="width:${prog}%"></div></div>`;
    factoryItems.appendChild(banner);

    for (const type in FACTORY_TYPES) {
        const def = FACTORY_TYPES[type];
        const owns = ownsFactory(type);
        const fac = owns ? getFactories()[type] : null;
        const inName = ITEMS[def.input] ? ITEMS[def.input].name : def.input;
        const outName = ITEMS[def.output] ? ITEMS[def.output].name : def.output;

        const div = document.createElement('div');

        if (!owns) {
            const afford = coins >= def.cost;
            div.className = 'craft-row' + (afford ? '' : ' cant');
            div.innerHTML = `
                <div class="item-info">
                    <span class="item-name">${def.emoji} ${def.name} <span style="color:#9c8;">· makes ${outName}</span></span>
                    <span class="needs">${def.inCount}× ${inName} → 1 ${outName} · every ${def.every}s</span>
                </div>
                <button class="craft-mix" ${afford ? '' : 'disabled'}>Build 🪙${def.cost}</button>`;
            const btn = div.querySelector('.craft-mix');
            if (afford) btn.addEventListener('click', () => onBuild(type));
        } else {
            const spd = 1 + fac.employees * 0.5;
            const rate = Math.max(1, Math.round(def.every / spd));
            const eCost = employeeCost(type, fac.employees);
            const maxed = fac.employees >= def.maxEmployees;
            const afford = coins >= eCost;
            const stock = inventory.count(def.input);
            div.className = 'craft-row' + ((maxed || afford) ? '' : ' cant');
            div.innerHTML = `
                <div class="item-info">
                    <span class="item-name">${def.emoji} ${def.name} <span style="color:#9c8;">· 👷 ${fac.employees}/${def.maxEmployees}</span></span>
                    <span class="needs">~1 ${outName} / ${rate}s · ${inName} in stock: ${stock}</span>
                </div>
                <button class="craft-mix" ${(maxed || !afford) ? 'disabled' : ''}>${maxed ? 'Full crew' : 'Hire 🪙' + eCost}</button>`;
            const btn = div.querySelector('.craft-mix');
            if (!maxed && afford) btn.addEventListener('click', () => onHire(type));
        }
        factoryItems.appendChild(div);
    }
    factoryOverlay.classList.remove('hidden');
}

export function hideFactory() {
    factoryOverlay.classList.add('hidden');
}

// --- Home (cottage) ---

export function showHome(playerName, onSleep, letter, onClaim, stats) {
    if (homeNote) {
        homeNote.textContent = /^jenn$/i.test(playerName || '')
            ? 'A framed photo of you and Grandpa sits on the shelf — this farm was always meant for you, Jenn. ❤'
            : `${playerName || 'Your'}'s cosy cottage. A framed photo of the farm hangs by the door.`;
    }
    homeItems.innerHTML = '';

    // 📬 Grandpa's mail — a daily gift or a delivery request
    const mail = document.createElement('div');
    mail.className = 'craft-row';
    if (!letter) {
        mail.innerHTML = `<div class="item-info"><span class="item-name">📭 Mailbox</span><span class="needs">No new mail today — check back tomorrow.</span></div>`;
    } else {
        const can = letter.kind === 'gift' || letter.canDeliver;
        const label = letter.kind === 'gift' ? `Collect 🪙${letter.coins}` : 'Deliver';
        mail.className = 'craft-row' + (can ? '' : ' cant');
        mail.innerHTML = `
            <div class="item-info">
                <span class="item-name">📬 Letter from Grandpa</span>
                <span class="needs">${letter.text}</span>
            </div>
            <button class="craft-mix" ${can ? '' : 'disabled'}>${label}</button>`;
        const b = mail.querySelector('.craft-mix');
        if (can && onClaim) b.addEventListener('click', () => onClaim());
    }
    homeItems.appendChild(mail);

    // 📊 Farm ledger — feel-good lifetime counters (only the ones you've started)
    if (stats) {
        const rows = stats.filter(s => s.value > 0);
        if (rows.length) {
            const led = document.createElement('div');
            led.className = 'home-ledger';
            led.innerHTML = '<div class="ledger-title">📊 Your farm so far</div>' +
                rows.map(s => `<div class="ledger-row"><span>${s.label}</span><b>${s.value.toLocaleString()}</b></div>`).join('');
            homeItems.appendChild(led);
        }
    }

    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.textContent = '🛏️ Sleep until morning';
    btn.addEventListener('click', () => onSleep());
    homeItems.appendChild(btn);

    homeOverlay.classList.remove('hidden');
}

export function hideHome() {
    homeOverlay.classList.add('hidden');
}

// --- Barn ---

export function showBarn(barnStorage, barnCapacity, inventory, onDeposit, onWithdraw, onDepositAll) {
    barnItems.innerHTML = '';

    // Capacity bar
    let totalStored = 0;
    const stored = barnStorage.getAll();
    for (const id in stored) totalStored += stored[id];
    barnCapacityEl.innerHTML = `
        <div class="capacity-bar">
            <div class="capacity-fill" style="width:${Math.min(100, (totalStored / barnCapacity) * 100)}%"></div>
        </div>
        <div class="capacity-text">${totalStored} / ${barnCapacity} items</div>
    `;

    // Crops the player has in inventory (can deposit)
    const cropIds = Object.entries(ITEMS).filter(([, v]) => v.type === 'crop');
    let hasAnyCrop = false;

    for (const [id, item] of cropIds) {
        const invQty = inventory.count(id);
        const barnQty = barnStorage.count(id);
        if (invQty <= 0 && barnQty <= 0) continue;
        hasAnyCrop = true;

        const div = document.createElement('div');
        div.className = 'barn-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="item-name">${item.name}</span>
                <span class="item-qty barn-qty">Barn: ${barnQty}</span>
                <span class="item-qty inv-qty">Inv: ${invQty}</span>
            </div>
            <div class="barn-actions">
                ${invQty > 0 ? `<button class="barn-btn deposit-btn">Store</button>` : ''}
                ${barnQty > 0 ? `<button class="barn-btn withdraw-btn">Take</button>` : ''}
            </div>
        `;

        const depositBtn = div.querySelector('.deposit-btn');
        const withdrawBtn = div.querySelector('.withdraw-btn');
        if (depositBtn) depositBtn.addEventListener('click', () => onDeposit(id));
        if (withdrawBtn) withdrawBtn.addEventListener('click', () => onWithdraw(id));

        barnItems.appendChild(div);
    }

    if (!hasAnyCrop) {
        barnItems.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">No crops to store!</p>';
    }

    // Store All button
    const storeAllBtn = document.getElementById('barn-store-all');
    if (storeAllBtn) {
        storeAllBtn.onclick = () => onDepositAll();
    }

    barnOverlay.classList.remove('hidden');
}

export function hideBarn() {
    barnOverlay.classList.add('hidden');
}

export function isOverlayOpen() {
    return !shopOverlay.classList.contains('hidden') ||
           !marketOverlay.classList.contains('hidden') ||
           !barnOverlay.classList.contains('hidden') ||
           !craftOverlay.classList.contains('hidden') ||
           !factoryOverlay.classList.contains('hidden') ||
           !homeOverlay.classList.contains('hidden');
}
