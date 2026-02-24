import { ITEMS } from './inventory.js';
import { CROPS } from './farm.js';
import { getFarmLevel, getNextExpansionCost } from './world.js';
import { createToolIcon } from './textures.js';

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

let notifTimer = null;

// --- Hotbar ---

const HOTBAR_SLOTS = [
    { id: 'move',       label: 'Walk' },
    { id: 'hoe',        label: 'Hoe' },
    { id: 'water',      label: 'Water' },
    { id: 'carrot_seed', label: 'Carrot Seeds' },
    { id: 'tomato_seed', label: 'Tomato Seeds' },
    { id: 'potato_seed', label: 'Potato Seeds' },
    { id: 'wheat_seed',  label: 'Wheat Seeds' },
    { id: 'hand',       label: 'Harvest' },
];

export function getHotbarSlots() { return HOTBAR_SLOTS; }

// Cache icons
const iconCache = {};
function getIcon(id) {
    if (!iconCache[id]) {
        iconCache[id] = createToolIcon(id);
    }
    return iconCache[id];
}

export function updateHotbar(selectedIndex, inventory, onSelect) {
    hotbarEl.innerHTML = '';
    HOTBAR_SLOTS.forEach((slot, i) => {
        const div = document.createElement('div');
        div.className = 'hotbar-slot';
        if (i === selectedIndex) div.classList.add('selected');

        // Check if seed and out of stock
        const isSeed = slot.id.endsWith('_seed');
        const qty = isSeed ? inventory.count(slot.id) : null;
        if (isSeed && qty <= 0) div.classList.add('disabled');

        // Key hint
        const keyHint = document.createElement('span');
        keyHint.className = 'hotbar-key';
        keyHint.textContent = i + 1;
        div.appendChild(keyHint);

        // Icon
        const iconCanvas = getIcon(slot.id);
        const img = document.createElement('img');
        img.className = 'hotbar-icon';
        img.src = iconCanvas.toDataURL();
        div.appendChild(img);

        // Quantity for seeds
        if (isSeed) {
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

export function updateHUD(coins, day, timeStr) {
    hudCoins.textContent = `🪙 ${coins}`;
    hudDay.textContent = `Day ${day}`;
    if (timeStr && hudTime) hudTime.textContent = timeStr;
}

export function updateToolLabel(name) {
    toolLabel.textContent = name;
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

export function showShop(coins, inventory, onBuy, onExpand, onBarnUpgrade, barnUpgradeCost) {
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

    // Separator
    const sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid rgba(255,255,255,0.1);margin:8px 0;';
    shopItems.appendChild(sep);

    // Seeds
    const seeds = Object.entries(ITEMS).filter(([, v]) => v.type === 'seed');
    for (const [id, item] of seeds) {
        const div = document.createElement('div');
        div.className = 'shop-item';
        if (coins < item.buyPrice) div.classList.add('cant-afford');

        div.innerHTML = `
            <div class="item-info">
                <img class="item-icon" src="${getIcon(id).toDataURL()}">
                <span class="item-name">${item.name}</span>
            </div>
            <span class="item-price">🪙 ${item.buyPrice}</span>
        `;

        if (coins >= item.buyPrice) {
            div.addEventListener('click', () => onBuy(id));
        }
        shopItems.appendChild(div);
    }
    shopOverlay.classList.remove('hidden');
}

export function hideShop() {
    shopOverlay.classList.add('hidden');
}

// --- Market ---

export function showMarket(inventory, onSell) {
    marketItems.innerHTML = '';
    const crops = Object.entries(ITEMS).filter(([, v]) => v.type === 'crop');

    let hasAnything = false;
    for (const [id, item] of crops) {
        const qty = inventory.count(id);
        if (qty <= 0) continue;
        hasAnything = true;

        const div = document.createElement('div');
        div.className = 'market-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="item-name">${item.name}</span>
                <span class="item-qty">x${qty}</span>
            </div>
            <span class="item-price">🪙 ${item.sellPrice} each</span>
        `;
        div.addEventListener('click', () => onSell(id));
        marketItems.appendChild(div);
    }

    if (!hasAnything) {
        marketItems.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Nothing to sell!</p>';
    }
    marketOverlay.classList.remove('hidden');
}

export function hideMarket() {
    marketOverlay.classList.add('hidden');
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
           !barnOverlay.classList.contains('hidden');
}
