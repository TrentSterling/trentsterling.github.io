import * as THREE from 'three';
import { initRenderer, updateCamera, raycastGround, render, scene, updateDayNight, isNightTime } from './renderer.js';
import { createWorld, getTile, setTileType, initHighlight, showHighlight, hideHighlight, TILE, WORLD_SIZE, isInFarm, serializeWorld, loadWorld, expandFarm, getFarmLevel, getNextExpansionCost, setFarmLevel } from './world.js';
import { createPlayer, moveTo, updatePlayer, getPlayerPos, getPlayerWorldPos, isMoving, setPlayerPos } from './player.js';
import { plantCrop, harvestCrop, updateCrops, CROPS, rebuildCropMeshes } from './farm.js';
import { createInventory, ITEMS } from './inventory.js';
import { updateHotbar, updateHUD, updateToolLabel, getHotbarSlots, notify, showShop, hideShop, showMarket, hideMarket, showBarn, hideBarn, isOverlayOpen } from './ui.js';
import { saveGame, loadGame, deleteSave } from './save.js';
import { playTill, playPlant, playHarvest, playBuy, playSell, playDeny, playExpand, playWalk, playWater, playStore, playWithdraw, playNewDay, updateAmbient } from './audio.js';

// ——— Game State ———

const inventory = createInventory();
const barnStorage = createInventory();
let barnCapacity = 50;
let barnLevel = 1;
const BARN_UPGRADE_COSTS = [150, 300, 600, 1200];
let coins = 100;
let day = 1;
let gameTime = 0;
let selectedSlot = 0;
let pendingAction = null;
let stepTimer = 0;
const DAY_LENGTH = 300; // seconds per day

// ——— Init ———

const container = document.getElementById('game-container');
initRenderer(container);
createWorld();
initHighlight();
createPlayer();

// Starting inventory
inventory.add('carrot_seed', 8);
inventory.add('tomato_seed', 4);
inventory.add('potato_seed', 6);

// Try loading save
const saved = loadGame();
if (saved) {
    coins = saved.coins ?? 100;
    day = saved.day ?? 1;
    gameTime = saved.gameTime ?? 0;
    inventory.load(saved.inventory ?? {});
    if (saved.barnStorage) barnStorage.load(saved.barnStorage);
    if (saved.barnLevel) { barnLevel = saved.barnLevel; barnCapacity = 50 * barnLevel; }
    setPlayerPos(saved.playerX ?? 24, saved.playerZ ?? 24);
    if (saved.farmLevel) setFarmLevel(saved.farmLevel);
    loadWorld(saved.tiles, saved.farmLevel);
    rebuildCropMeshes();
    notify('Game loaded!');
}

refreshUI();

// ——— Input ———

const hotbarSlots = getHotbarSlots();

function getSelectedTool() {
    return hotbarSlots[selectedSlot];
}

function selectSlot(index) {
    if (index < 0 || index >= hotbarSlots.length) return;
    selectedSlot = index;
    updateToolLabel(hotbarSlots[index].label);
    refreshUI();
}

// Click handler
container.addEventListener('click', (e) => {
    if (isOverlayOpen()) return;

    const hit = raycastGround(e);
    if (!hit) return;

    const tx = hit.x;
    const tz = hit.z;

    // Clamp to world bounds
    if (tx < 0 || tx >= WORLD_SIZE || tz < 0 || tz >= WORLD_SIZE) return;

    const tile = getTile(tx, tz);

    // If no tile data (wild area), still allow walking there
    if (tile && tile.type === TILE.WATER) return;

    const tool = getSelectedTool();
    const pos = getPlayerPos();
    const dist = Math.abs(pos.x - tx) + Math.abs(pos.z - tz);

    if (dist <= 1 && tile) {
        performAction(tx, tz, tool);
    } else {
        pendingAction = tile ? { x: tx, z: tz, tool } : null;
        moveTo(tx, tz);
    }
});

// Right-click to quick-harvest
container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (isOverlayOpen()) return;

    const hit = raycastGround(e);
    if (!hit) return;

    const tile = getTile(hit.x, hit.z);
    if (!tile) return;

    const pos = getPlayerPos();
    const dist = Math.abs(pos.x - hit.x) + Math.abs(pos.z - hit.z);
    if (dist <= 1 && tile.type === TILE.PLANTED && tile.cropStage >= 3) {
        doHarvest(hit.x, hit.z);
    }
});

// Hover highlight
container.addEventListener('mousemove', (e) => {
    if (isOverlayOpen()) { hideHighlight(); return; }

    const hit = raycastGround(e);
    if (hit && hit.x >= 0 && hit.x < WORLD_SIZE && hit.z >= 0 && hit.z < WORLD_SIZE) {
        showHighlight(hit.x, hit.z);
    } else {
        hideHighlight();
    }
});

// Keyboard
document.addEventListener('keydown', (e) => {
    const num = parseInt(e.key);
    if (num >= 1 && num <= hotbarSlots.length) {
        selectSlot(num - 1);
        return;
    }
    if (e.key === 'Escape') {
        hideShop();
        hideMarket();
        hideBarn();
    }
});

// ——— Actions ———

function performAction(tx, tz, tool) {
    const tile = getTile(tx, tz);
    if (!tile) return;

    switch (tool.id) {
        case 'move':
            handleBuildingInteraction(tile);
            break;

        case 'hoe':
            if (tile.type === TILE.GRASS && isInFarm(tx, tz)) {
                setTileType(tx, tz, TILE.SOIL);
                playTill();
                notify('Tilled soil!');
                triggerAutoSave();
            } else if (tile.type === TILE.GRASS && !isInFarm(tx, tz)) {
                playDeny();
                notify('Outside your farm! Expand first.');
            }
            handleBuildingInteraction(tile);
            break;

        case 'water':
            if (tile.type === TILE.PLANTED || tile.type === TILE.SOIL) {
                tile.watered = true;
                playWater();
                notify('Watered!');
            }
            handleBuildingInteraction(tile);
            break;

        case 'hand':
            if (tile.type === TILE.PLANTED && tile.cropStage >= 3) {
                doHarvest(tx, tz);
            }
            handleBuildingInteraction(tile);
            break;

        default:
            if (tool.id.endsWith('_seed')) {
                if (tile.type === TILE.SOIL && inventory.has(tool.id)) {
                    const cropId = ITEMS[tool.id].cropId;
                    if (plantCrop(tx, tz, cropId)) {
                        inventory.remove(tool.id);
                        playPlant();
                        notify(`Planted ${CROPS[cropId].name}!`);
                        refreshUI();
                        triggerAutoSave();
                    }
                }
            }
            handleBuildingInteraction(tile);
            break;
    }
}

function handleBuildingInteraction(tile) {
    if (tile.type === TILE.SHOP) {
        const barnCost = getNextBarnUpgradeCost();
        showShop(coins, inventory, buyItem, buyExpansion, buyBarnUpgrade, barnCost);
    } else if (tile.type === TILE.MARKET) {
        showMarket(inventory, sellItem);
    } else if (tile.type === TILE.BARN) {
        openBarn();
    }
}

function getNextBarnUpgradeCost() {
    const idx = barnLevel - 1;
    return idx < BARN_UPGRADE_COSTS.length ? BARN_UPGRADE_COSTS[idx] : null;
}

function buyBarnUpgrade() {
    const cost = getNextBarnUpgradeCost();
    if (cost === null) {
        notify('Barn is max level!');
        return;
    }
    if (coins < cost) {
        playDeny();
        notify("Can't afford barn upgrade!");
        return;
    }
    coins -= cost;
    barnLevel++;
    barnCapacity = 50 * barnLevel;
    playExpand();
    notify(`Barn upgraded! Capacity: ${barnCapacity}`);
    refreshUI();
    const nextCost = getNextBarnUpgradeCost();
    showShop(coins, inventory, buyItem, buyExpansion, buyBarnUpgrade, nextCost);
    triggerAutoSave();
}

function doHarvest(tx, tz) {
    const result = harvestCrop(tx, tz);
    if (result) {
        inventory.add(result.itemId, result.qty);
        playHarvest();
        notify(`Harvested ${result.qty} ${ITEMS[result.itemId].name}!`);
        setTileType(tx, tz, TILE.SOIL);
        refreshUI();
        triggerAutoSave();
    }
}

function buyItem(itemId) {
    const item = ITEMS[itemId];
    if (!item || coins < item.buyPrice) {
        playDeny();
        notify("Can't afford that!");
        return;
    }
    coins -= item.buyPrice;
    inventory.add(itemId, 1);
    playBuy();
    notify(`Bought ${item.name}!`);
    refreshUI();
    showShop(coins, inventory, buyItem, buyExpansion, buyBarnUpgrade, getNextBarnUpgradeCost());
    triggerAutoSave();
}

function buyExpansion() {
    const cost = getNextExpansionCost();
    if (cost === null) {
        notify('Farm is max size!');
        return;
    }
    if (coins < cost) {
        playDeny();
        notify("Can't afford expansion!");
        return;
    }
    coins -= cost;
    expandFarm();
    playExpand();
    const level = getFarmLevel();
    notify(`Farm expanded to level ${level}!`);
    refreshUI();
    showShop(coins, inventory, buyItem, buyExpansion, buyBarnUpgrade, getNextBarnUpgradeCost());
    triggerAutoSave();
}

function sellItem(itemId) {
    const item = ITEMS[itemId];
    if (!item || !inventory.has(itemId)) return;
    const qty = inventory.count(itemId);
    inventory.remove(itemId, qty);
    const earned = qty * item.sellPrice;
    coins += earned;
    playSell();
    notify(`Sold ${qty} ${item.name} for 🪙${earned}!`);
    refreshUI();
    showMarket(inventory, sellItem);
    triggerAutoSave();
}

// ——— Barn ———

function openBarn() {
    showBarn(barnStorage, barnCapacity, inventory, barnDeposit, barnWithdraw, barnDepositAll);
}

function barnDeposit(itemId) {
    const totalStored = Object.values(barnStorage.getAll()).reduce((s, v) => s + v, 0);
    if (totalStored >= barnCapacity) {
        playDeny();
        notify('Barn is full!');
        return;
    }
    const available = inventory.count(itemId);
    const space = barnCapacity - totalStored;
    const qty = Math.min(available, space);
    if (qty <= 0) return;
    inventory.remove(itemId, qty);
    barnStorage.add(itemId, qty);
    playStore();
    notify(`Stored ${qty} ${ITEMS[itemId].name} in barn!`);
    refreshUI();
    openBarn();
    triggerAutoSave();
}

function barnWithdraw(itemId) {
    const qty = barnStorage.count(itemId);
    if (qty <= 0) return;
    barnStorage.remove(itemId, qty);
    inventory.add(itemId, qty);
    playWithdraw();
    notify(`Took ${qty} ${ITEMS[itemId].name} from barn!`);
    refreshUI();
    openBarn();
    triggerAutoSave();
}

function barnDepositAll() {
    const crops = Object.entries(ITEMS).filter(([, v]) => v.type === 'crop');
    let totalMoved = 0;
    let totalStored = Object.values(barnStorage.getAll()).reduce((s, v) => s + v, 0);

    for (const [id] of crops) {
        const available = inventory.count(id);
        if (available <= 0) continue;
        const space = barnCapacity - totalStored;
        if (space <= 0) break;
        const qty = Math.min(available, space);
        inventory.remove(id, qty);
        barnStorage.add(id, qty);
        totalStored += qty;
        totalMoved += qty;
    }
    if (totalMoved > 0) {
        playStore();
        notify(`Stored ${totalMoved} items in barn!`);
    } else {
        notify('Nothing to store!');
    }
    refreshUI();
    openBarn();
    triggerAutoSave();
}

// ——— UI Refresh ———

function getDayProgress() {
    return (gameTime % DAY_LENGTH) / DAY_LENGTH;
}

function getTimeString(progress) {
    const totalHours = (progress * 24 + 6) % 24; // 0 progress = 6 AM
    const hours = Math.floor(totalHours);
    const minutes = Math.floor((totalHours - hours) * 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${h12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function refreshUI() {
    const progress = getDayProgress();
    updateHUD(coins, day, getTimeString(progress));
    updateHotbar(selectedSlot, inventory, selectSlot);
}

// ——— Save ———

let saveTimer = null;
function triggerAutoSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        const pos = getPlayerPos();
        saveGame({
            version: 3,
            coins,
            day,
            gameTime,
            farmLevel: getFarmLevel(),
            barnLevel,
            playerX: pos.x,
            playerZ: pos.z,
            inventory: inventory.serialize(),
            barnStorage: barnStorage.serialize(),
            tiles: serializeWorld(),
        });
    }, 1000);
}

// ——— Game Loop ———

let lastTime = performance.now();

function gameLoop(now) {
    requestAnimationFrame(gameLoop);

    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    gameTime += dt;

    updatePlayer(dt);

    // Footstep sounds
    if (isMoving()) {
        stepTimer += dt;
        if (stepTimer > 0.35) {
            playWalk();
            stepTimer = 0;
        }
    } else {
        stepTimer = 0;
    }

    if (pendingAction && !isMoving()) {
        const pos = getPlayerPos();
        const dist = Math.abs(pos.x - pendingAction.x) + Math.abs(pos.z - pendingAction.z);
        if (dist <= 1) {
            performAction(pendingAction.x, pendingAction.z, pendingAction.tool);
        }
        pendingAction = null;
    }

    updateCrops(dt);

    const ppos = getPlayerWorldPos();
    updateCamera(new THREE.Vector3(ppos.x, 0, ppos.z), dt);

    // Day/night cycle
    const dayProgress = getDayProgress();
    updateDayNight(dayProgress);
    updateAmbient(isNightTime(dayProgress));

    const newDay = Math.floor(gameTime / DAY_LENGTH) + 1;
    if (newDay > day) {
        day = newDay;
        playNewDay();
        notify(`Day ${day} begins!`);
        refreshUI();
        triggerAutoSave();
    }

    render();
}

requestAnimationFrame(gameLoop);
