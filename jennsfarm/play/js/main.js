import * as THREE from 'three';
import { initRenderer, updateCamera, raycastGround, render, scene, updateDayNight, isNightTime, setDebugCamera, addShake, panCamera } from './renderer.js';
import { createWorld, getTile, setTileType, initHighlight, showHighlight, hideHighlight, TILE, WORLD_SIZE, isInFarm, serializeWorld, loadWorld, expandFarm, getFarmLevel, getNextExpansionCost, setFarmLevel, forEachFarmTile, isSolidTile, updateOverlays } from './world.js';
import { createPlayer, moveTo, moveAlong, updatePlayer, getPlayerPos, getPlayerWorldPos, isMoving, setPlayerPos, getPlayerGroup, setHeldTool, setPlayerGender, getTarget, getPath } from './player.js';
import { initDebug, toggleDebug, setMouseHit, setPlayerTarget, setPath as setDebugPath, tickDebug, profBegin, profMark } from './debug.js';
import { findPath } from './pathfind.js';
import { plantCrop, harvestCrop, updateCrops, CROPS, rebuildCropMeshes, waterTile, setSeasonGrowth } from './farm.js';
import { harvestQuality } from './quality.js';
import { applyMeal, tickBuffs, luckMult, activeBuffs, fmtBuffTime } from './buffs.js';
import { bumpStat, allStats, serializeStats, loadStats } from './stats.js';
import { getSeason } from './seasons.js';
import { chopTree, updateTrees, serializeTrees, loadTrees, hasTreeNear, creditOfflineFruit, getNearestFruitDrop } from './trees.js';
import { createInventory, ITEMS } from './inventory.js';
import { updateHotbar, updateHUD, updateToolLabel, getHotbarSlots, notify, showShop, hideShop, showMarket, hideMarket, showBarn, hideBarn, showCraft, hideCraft, showFactory, hideFactory, showHome, hideHome, setShopHandlers, isOverlayOpen, updateBag, updateHealth } from './ui.js';
import { hideAllOverlays, initOverlayDismiss, initOverlayChrome } from './overlays.js';
import { nextMorning } from './home.js';
import { makeLetter, canFulfill, claimLetter, isClaimed, markClaimed, serializeMail, loadMail } from './mailbox.js';
import { healValue } from './foods.js';
import './weather.js';      // self-registers the weather system (#9)
import './fireflies.js';    // self-registers the fireflies/butterflies system (#9)
import './cloudshadows.js'; // self-registers drifting cloud shadows (#43) — mod-loader proof: one import, no other wiring
import './workers.js';      // self-registers the employee "vacuum dudes" that tidy loose drops
import { placeFoodBowl, hasFoodBowl, FOOD_BOWL_COST, serializeVisitors, loadVisitors } from './visitors.js'; // self-registers visitor cats (#54)
import { updateSystems } from './registry.js';
import { placeHive, updateBees, creditOfflineHoney, getHiveCount, HIVE_COST, serializeHives, loadHives } from './bees.js';
import { placeCoop, creditOfflineEggs, getCoopCount, COOP_COST, serializeCoops, loadCoops } from './coop.js';
import { rollBlessing, hasFountain, getFountainPos, fountainAt, buildFountain, updateFountain, FOUNTAIN_COST, TOSS_COST, serializeFountain, loadFountain } from './fountain.js';
import { hasPet, getPetPos, adoptPet, updatePet, PET_COST, serializePet, loadPet } from './pets.js';
import { pickFish, rollFishSize, tryFishRecord, serializeFishRecords, loadFishRecords } from './fishing.js';
import { hasGreenhouse, buildGreenhouse, effectiveGrowth, GREENHOUSE_COST, serializeGreenhouse, loadGreenhouse } from './greenhouse.js';
import { buyFlytrapPlacement, getFlytrapCount, FLYTRAP_COST, serializeFlytraps, loadFlytraps } from './flytrap.js';
import { festivalFor, startFestival } from './festivals.js';
import { RECIPES } from './craft.js';
import { FACTORY_TYPES, buildFactory, hireEmployee, employeeCost, getFactories, updateFactories, creditOfflineFactories, serializeFactories, loadFactories } from './factories.js';
import { addEarnings, getSellBonus, getRank, getRankIndex, serializeCorp, loadCorp } from './corp.js';
import { updateChunks } from './chunks.js';
import { CRATE_KINDS, updateCrates, crateAt, openCrateAt, creditOfflineCrates, serializeCrates, loadCrates } from './crates.js';
import { getToolRadius, nextUpgrade, upgradeTool, tilesInRadius, serializeEquipment, loadEquipment } from './equipment.js';
import { saveGame, loadGame, deleteSave } from './save.js';
import { playTill, playPlant, playHarvest, playBuy, playSell, playDeny, playExpand, playWalk, playWater, playStore, playWithdraw, playNewDay, playChop, playTimber, updateAmbient } from './audio.js';
import { initMarket, getPrice, getTrend, recordSale, dailyTick, serializeMarket, loadMarket, offlineBuyerSales } from './market.js';
import { initAnimals, updateAnimals, buyAnimalEntity, ANIMALS, serializeAnimals, loadAnimals, getLivestockCount, creditOfflineProduce, getNearestDrop, petNearest, feedNearest } from './animals.js';
import { woodBurst, chip, coinBurst, puff, sparkle, hearts, pop, updateJuice } from './juice.js';
import { initGrandpa, updateGrandpa, grandpaSayText } from './grandpa.js';
import { addSprinkler, updateSprinklers, serializeSprinklers, loadSprinklers } from './sprinklers.js';
import { isPlacing, placingName, beginPlacement, moveGhost, confirmPlace, cancelPlacement, rotatePlacement } from './placement.js';
import { DECOR_CATALOG, placeDecor, updateDecor, serializeDecor, loadDecor, countByType, beautyScore } from './decor.js';
import { showBuildMenu, hideBuildMenu } from './buildmenu.js';
import { spawnInitialWeeds, clearWeedAt, hasWeedAt, serializeWeeds, loadWeeds, getWeedCount, growWeeds, clearWeedsInRadius } from './weeds.js';
import { advanceCropsOffline } from './offline.js';
import { initBuyers, updateBuyers } from './buyers.js';
import { initQuests, questEvent, serializeQuests, loadQuests, setQuestName, completeSilently, getQuestIndex } from './quests.js';

// --- Game State ---

const inventory = createInventory();
const barnStorage = createInventory();
let barnCapacity = 50;
let barnLevel = 1;
const BARN_UPGRADE_COSTS = [150, 300, 600, 1200];
let coins = 100;
let day = 1;
let gameTime = 0;
let playerName = 'Jenn'; // the farmer is Jenn (nameable later - task #2)
let playerGender = 'girl';
let health = 100;
let season = getSeason(1);
const MAX_HEALTH = 100;
const HEALTH_DRAIN = 0.35;  // per second while actively playing (not AFK)
let healthUiTimer = 0;
let selectedSlot = 0;
let pendingAction = null;
let stepTimer = 0;
const DAY_LENGTH = 300; // seconds per day

// Idle autoplay (task #12): after the player is idle this long, an AI does
// MAINTENANCE only (harvest/water/plant) - and only once onboarding is done.
let lastInputAt = performance.now();
let autoActive = false;
let autoCheckTimer = 0;
let namePromptOpen = false;
const AFK_MS = 7000; // idle this long (post-onboarding) -> AI takes over
const autoSkip = new Set(); // auto-farm tiles we couldn't reach this AFK session
function markInput() { lastInputAt = performance.now(); autoSkip.clear(); }

// Nearest walkable tile next to a (possibly solid) target, so click-to-move on a
// building/cottage walks Jenn to an adjacent reachable spot instead of into it.
function walkableNeighbor(tx, tz) {
    const p = getPlayerPos();
    let best = null, bd = Infinity;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = tx + dx, nz = tz + dz;
        if (isSolidTile(nx, nz)) continue;
        const d = Math.abs(nx - p.x) + Math.abs(nz - p.z);
        if (d < bd) { bd = d; best = { x: nx, z: nz }; }
    }
    return best;
}

// Send Jenn to a tile. RESPONSIVENESS (#25): she steps off in a straight line
// THIS frame, and we compute the A* route on the NEXT frame (resolvePendingRoute),
// then upgrade to the routed path. The node search no longer blocks the click
// frame, so there's zero perceptible lag between click and movement.
let pendingRoute = null;
function routeTo(tx, tz) {
    moveTo(tx, tz);                 // commit instantly — walk straight toward the click
    pendingRoute = { tx, tz };      // ...and refine into an obstacle-avoiding route next frame
}

// Run once per frame: turn the last click into a real A* route around obstacles.
function resolvePendingRoute() {
    if (!pendingRoute) return;
    const { tx, tz } = pendingRoute;
    pendingRoute = null;
    const p = getPlayerPos();
    const route = findPath(p.x, p.z, tx, tz);
    const last = route && route.length ? route[route.length - 1] : null;
    // Follow A* only if it actually reaches the goal (or a walkable neighbour of a
    // solid target). On a far/open click that hit the node budget it returns a
    // partial path — in that case the straight walk we already started is fine.
    if (last && Math.abs(last.x - tx) + Math.abs(last.z - tz) <= 1) moveAlong(route);
}

// --- Init ---

const container = document.getElementById('game-container');
initRenderer(container);
createWorld();
initHighlight();
createPlayer();
initMarket();
initBuyers();

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
    health = saved.health ?? 100;
    inventory.load(saved.inventory ?? {});
    if (saved.barnStorage) barnStorage.load(saved.barnStorage);
    if (saved.barnLevel) { barnLevel = saved.barnLevel; barnCapacity = 50 * barnLevel; }
    setPlayerPos(saved.playerX ?? 24, saved.playerZ ?? 24);
    if (saved.farmLevel) setFarmLevel(saved.farmLevel);
    if (saved.market) loadMarket(saved.market);
    loadWorld(saved.tiles, saved.farmLevel);
    rebuildCropMeshes();
    if (saved.trees) loadTrees(saved.trees);
    if (saved.sprinklers) loadSprinklers(saved.sprinklers);
    if (saved.factories) loadFactories(saved.factories);
    if (saved.corp) loadCorp(saved.corp);
    if (saved.crates) loadCrates(saved.crates);
    if (saved.equipment) loadEquipment(saved.equipment);
    if (saved.mail) loadMail(saved.mail);
    if (saved.hives) loadHives(saved.hives);
    if (saved.coops) loadCoops(saved.coops);
    loadDecor(saved.decor); // build-mode props (safe with no data → clears)
    if (saved.fountain) loadFountain(saved.fountain);
    if (saved.pet) loadPet(saved.pet);
    if (saved.visitors) loadVisitors(saved.visitors);
    if (saved.greenhouse) loadGreenhouse(saved.greenhouse);
    if (saved.flytraps) loadFlytraps(saved.flytraps);
    if (saved.fishRecords) loadFishRecords(saved.fishRecords);
    if (saved.stats) loadStats(saved.stats);
    notify('Game loaded!');
}

// Dev/debug params: ?noon jumps to midday, ?money=N grants coins
const _params = new URLSearchParams(location.search);
if (_params.has('noon')) gameTime = DAY_LENGTH * 0.27;
if (_params.has('money')) coins += parseInt(_params.get('money')) || 0;

// Debug/free camera for automated screenshots:
//   ?camx=24&camz=24&camh=34&camd=2&campitch=-1.3
const _num = (k) => _params.has(k) ? parseFloat(_params.get(k)) : undefined;
if (['camx', 'camz', 'camh', 'camd', 'campitch'].some(k => _params.has(k))) {
    setDebugCamera({
        x: _num('camx'), z: _num('camz'),
        height: _num('camh'), distance: _num('camd'), pitch: _num('campitch'),
    });
}
if (_params.has('nofog')) scene.fog = null; // clean wide/top-down inspection shots

// Animals: wildlife + grandpa always; livestock restored from save, else a starter chicken
initAnimals(!saved);
if (saved && saved.animals) loadAnimals(saved.animals);

// Idle reward: advance the farm for the real time spent away (crops grow under
// sprinklers, livestock produce). Capped so a long absence can't run wild.
if (saved && saved.lastSaved) {
    const away = Math.min((Date.now() - saved.lastSaved) / 1000, 4 * 3600); // cap 4h
    if (away > 60) {
        gameTime += away;
        const cp = advanceCropsOffline(away);
        rebuildCropMeshes();
        const prod = creditOfflineProduce(away);
        let pcount = 0;
        for (const k in prod) { inventory.add(k, prod[k]); pcount += prod[k]; }
        const fruit = creditOfflineFruit(away);
        if (fruit) { inventory.add('apple', fruit); }
        const facProd = creditOfflineFactories(away, inventory); // factories ran on stored goods
        let facCount = 0;
        for (const k in facProd) facCount += facProd[k];
        const crateCount = creditOfflineCrates(away); // delivery trucks left crates by the road
        const honeyOff = creditOfflineHoney(away); // beehives kept making honey
        if (honeyOff) inventory.add('honey', honeyOff);
        const eggsOff = creditOfflineEggs(away); // coops kept laying eggs
        if (eggsOff) inventory.add('egg', eggsOff);
        const sales = offlineBuyerSales(inventory, away); // roadside buyers came by
        if (sales.count) {
            const bonused = Math.round(sales.coins * (1 + getSellBonus()));
            coins += bonused;
            addEarnings(bonused); // counts toward company value; no popup on load
            sales.coins = bonused;
        }
        const bits = [];
        if (cp.ripened) bits.push(`${cp.ripened} crops ripened`);
        if (pcount) bits.push(`+${pcount} produce`);
        if (fruit) bits.push(`+${fruit} fruit`);
        if (facCount) bits.push(`+${facCount} from factories`);
        if (crateCount) bits.push(`📦 ${crateCount} crate${crateCount > 1 ? 's' : ''} waiting`);
        if (honeyOff) bits.push(`+${honeyOff} honey`);
        if (sales.count) bits.push(`🪙${sales.coins} from ${sales.count} roadside sales`);
        const mins = Math.round(away / 60);
        setTimeout(() => notify(`🌙 While you were away (${mins}m): ${bits.length ? bits.join(', ') : 'the farm rested'}.`), 900);
    }
}

if (saved && saved.playerName) playerName = saved.playerName;
if (saved && saved.gender) { playerGender = saved.gender; setPlayerGender(saved.gender); }
season = getSeason(day);
setSeasonGrowth(effectiveGrowth(season.growth)); // greenhouse lifts the floor (#51)
startFestival(season.name); // put up the current season's bunting (#52)
initGrandpa();

// Starting weeds: fresh games get an overgrown farm to clear; saves restore theirs
if (!saved) {
    spawnInitialWeeds();
    if (!_params.has('noon')) gameTime = DAY_LENGTH * 0.2; // open in bright morning, not 6am dark
}
else if (saved.weeds) loadWeeds(saved.weeds);

// Grandpa's intro chore chain
function grantReward(r) {
    if (!r) return;
    if (r.coins) coins += r.coins;
    if (r.seeds) for (const k in r.seeds) inventory.add(k, r.seeds[k]);
    if (r.items) for (const k in r.items) inventory.add(k, r.items[k]);
    if (r.coins) notify(`Grandpa paid you 🪙${r.coins}!`);
    refreshUI();
    triggerAutoSave();
}
initQuests({
    name: playerName,
    reward: grantReward,
    complete: () => {
        coins += 100;
        const p = getPlayerWorldPos();
        hearts(p.x, 1.0, p.z);
        coinBurst(p.x, p.z);
        addShake(0.12);
        notify('🌻 Grandpa: the farm is all yours now! (+🪙100)');
        refreshUI();
        triggerAutoSave();
    },
});
if (saved && saved.quests) loadQuests(saved.quests);
// Un-stick old saves: if loading onto the very first chore with no weeds to
// clear (e.g. a save from before the weeds feature), skip the onboarding.
if (saved && getQuestIndex() === 0 && getWeedCount() === 0 && !serializeQuests().done) {
    completeSilently();
}

// First-time players name their farmer (defaults to Jenn). ?noname skips it (dev shots).
if (!saved && !_params.has('noname')) {
    showNamePrompt((name, g) => {
        playerName = name;
        playerGender = g;
        setPlayerGender(g);
        setQuestName(name);
        triggerAutoSave();
        // Easter egg: this farm (and this whole game) is really for Jenn ❤
        if (/^jenn$/i.test(name)) {
            setTimeout(() => {
                grandpaSayText('This farm was always meant for you, Jenn. ❤');
                const p = getPlayerWorldPos();
                hearts(p.x, 1.0, p.z);
            }, 2600);
        }
    });
}

function showNamePrompt(onDone) {
    const ov = document.createElement('div');
    ov.id = 'name-modal'; // styled via style.css (unified design system)
    ov.innerHTML = `
      <div class="name-card">
        <div style="font-size:34px;margin-bottom:4px">🌻</div>
        <h2>Welcome to the farm!</h2>
        <p>Grandpa's handing it over. What's your name?</p>
        <input id="jf-name" maxlength="14" value="Jenn" autocomplete="off">
        <div class="gender-row">
          <button class="gbtn sel" data-g="girl">👧 Girl</button>
          <button class="gbtn" data-g="boy">👦 Boy</button>
        </div>
        <button id="jf-go">Start farming 🌱</button>
      </div>`;
    document.body.appendChild(ov);
    namePromptOpen = true;
    let g = 'girl';
    ov.querySelectorAll('.gbtn').forEach(b => b.addEventListener('click', () => {
        g = b.dataset.g;
        ov.querySelectorAll('.gbtn').forEach(x => x.classList.toggle('sel', x === b));
    }));
    const input = ov.querySelector('#jf-name');
    input.focus(); input.select();
    const go = () => {
        const v = (input.value || '').trim().slice(0, 14) || 'Jenn';
        if (ov.parentNode) document.body.removeChild(ov);
        namePromptOpen = false;
        markInput();
        onDone(v, g);
    };
    ov.querySelector('#jf-go').addEventListener('click', go);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
}

// Collect produce that animals drop when the player walks over it
// Fruit picked up from fruit trees — quiet + frequent, so no toast spam
function onCollectFruit(itemId, qty) {
    inventory.add(itemId, qty);
    const p = getPlayerWorldPos();
    sparkle(p.x, 0.4, p.z, [0xe23b3b, 0xffd0d0]);
    refreshUI();
    triggerAutoSave();
}

function onCollectProduce(itemId, qty) {
    inventory.add(itemId, qty);
    playStore();
    { const pp = getPlayerWorldPos(); sparkle(pp.x, 0.5, pp.z); }
    notify(`Collected ${qty} ${ITEMS[itemId].name}!`);
    refreshUI();
    triggerAutoSave();
}

// Stream the first ring of terrain so Jenn doesn't start staring into the void
updateChunks(getPlayerWorldPos().x, getPlayerWorldPos().z);

refreshUI();
initDebug(); // debug overlay (FPS + mouse/target/path) — toggle with backtick

// --- Input ---

const hotbarSlots = getHotbarSlots();

function getSelectedTool() {
    return hotbarSlots[selectedSlot];
}

function selectSlot(index) {
    if (index < 0 || index >= hotbarSlots.length) return;
    selectedSlot = index;
    updateToolLabel(hotbarSlots[index].label);
    setHeldTool(hotbarSlots[index].id);
    refreshUI();
}

// Click handler
// --- Drag-to-pan camera (decoupled from player; re-centers when she moves) ---
let dragDown = false, dragMoved = false, dragLastX = 0, dragLastY = 0, dragStartX = 0, dragStartY = 0;
const PAN_SCALE = 0.03; // screen px -> world units
container.addEventListener('mousedown', (e) => {
    if (e.button !== 2) return; // RIGHT button drags the camera; left is for actions
    markInput();
    dragDown = true; dragMoved = false;
    dragStartX = dragLastX = e.clientX;
    dragStartY = dragLastY = e.clientY;
});
window.addEventListener('mouseup', () => {
    dragDown = false;
    container.style.cursor = '';
    setTimeout(() => { dragMoved = false; }, 0); // clear after the click event fires
});

container.addEventListener('click', (e) => {
    markInput();
    if (e.button !== 0) return; // only the left button acts
    if (isOverlayOpen()) return;
    if (fishing && fishing.state === 'bite') { hookFish(); return; } // reel it in!

    const hit = raycastGround(e);
    if (!hit) return;

    const tx = hit.x;
    const tz = hit.z;

    // Infinite world: you can click anywhere out in the wild (no hard edge),
    // just guard against a degenerate horizon hit.
    if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;

    // Build mode (Sims-style): a left-click drops the structure on this tile (#36)
    if (isPlacing()) {
        const r = confirmPlace(tx, tz);
        if (r === 'invalid') playDeny();
        return;
    }

    const tile = getTile(tx, tz);

    // Pond water → go fishing (cast if you're at the edge, else walk over first)
    if (tile && tile.type === TILE.WATER) {
        const pos = getPlayerPos();
        const wd = Math.abs(pos.x - tx) + Math.abs(pos.z - tz);
        if (wd <= 1.5) startCast();
        else { const nb = walkableNeighbor(tx, tz); pendingAction = { x: tx, z: tz, tool: { id: 'fish' } }; routeTo(nb ? nb.x : tx, nb ? nb.z : tz); }
        return;
    }

    // Delivered crate here? Click to open it (walk over first if out of reach).
    const crate = crateAt(tx, tz, 0.8);
    if (crate) {
        const pp = getPlayerPos();
        const cd = Math.abs(pp.x - crate.x) + Math.abs(pp.z - crate.z);
        if (cd <= 1.4) openCrateAndCollect(crate);
        else { pendingAction = { x: crate.x, z: crate.z, tool: { id: 'crate' } }; routeTo(crate.x, crate.z); }
        return;
    }

    // Wishing fountain? Click to toss a coin (walk over first if out of reach).
    if (fountainAt(tx, tz, 0.9)) {
        const pp = getPlayerPos(); const fp = getFountainPos();
        const fd = Math.abs(pp.x - fp.x) + Math.abs(pp.z - fp.z);
        if (fd <= 1.6) tossCoinAtFountain();
        else { pendingAction = { x: fp.x, z: fp.z, tool: { id: 'fountain' } }; routeTo(fp.x, fp.z); }
        return;
    }

    const tool = getSelectedTool();
    const pos = getPlayerPos();
    const dist = Math.abs(pos.x - tx) + Math.abs(pos.z - tz);

    // The axe works on trees in the wild, where there's no farm tile data
    const actionable = tile || tool.id === 'axe';

    if (dist <= 1 && actionable) {
        performAction(tx, tz, tool);
    } else {
        pendingAction = actionable ? { x: tx, z: tz, tool } : null;
        // A* routes around buildings/water/trees and, for a solid target tile
        // (e.g. the Market), ends on a walkable neighbour so the action still
        // fires on arrival (dist<=1). No more getting stuck in the corner.
        routeTo(tx, tz);
    }
});

// Right-click: TAP = quick-harvest, DRAG = pan camera (handled in mousemove)
container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (dragMoved) return;       // it was a camera pan, not a harvest tap
    if (isPlacing()) { cancelPlacement(); notify('Build cancelled.'); return; } // right-click exits build mode
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

// Tool-aware hover highlight: colour tells you what a click will do.
const HL = { ok: 0xffffff, plant: 0x7cff7c, water: 0x66bbff, harvest: 0xffd24a,
             till: 0xc8a86e, chop: 0xff8a4a, weed: 0xffe066, bad: 0xff5555 };

function highlightColor(toolId, tile, x, z) {
    if (hasWeedAt(x, z) && (toolId === 'hand' || toolId === 'hoe')) return HL.weed;
    if (toolId === 'axe') return hasTreeNear(x, z) ? HL.chop : HL.ok;
    if (!tile) return HL.ok;
    if (toolId === 'water') return (tile.type === TILE.PLANTED || tile.type === TILE.SOIL) ? HL.water : HL.ok;
    if (toolId === 'hand') return (tile.type === TILE.PLANTED && tile.cropStage >= 3) ? HL.harvest : HL.ok;
    if (toolId === 'hoe') return (tile.type === TILE.GRASS && isInFarm(x, z)) ? HL.till : HL.ok;
    if (toolId === 'sprinkler') return (isInFarm(x, z) && (tile.type === TILE.SOIL || tile.type === TILE.GRASS)) ? HL.water : HL.bad;
    if (toolId.endsWith('_seed')) return (tile.type === TILE.SOIL && !tile.crop) ? HL.plant : HL.ok;
    return HL.ok;
}

container.addEventListener('mousemove', (e) => {
    markInput();

    // Drag-to-pan: hold RIGHT button and drag to move the camera off the player
    if (dragDown && (e.buttons & 2)) {
        if (!dragMoved && Math.abs(e.clientX - dragStartX) + Math.abs(e.clientY - dragStartY) > 6) {
            dragMoved = true;
            container.style.cursor = 'grabbing';
        }
        if (dragMoved) {
            const dx = e.clientX - dragLastX, dy = e.clientY - dragLastY;
            dragLastX = e.clientX; dragLastY = e.clientY;
            panCamera(-dx * PAN_SCALE, -dy * PAN_SCALE); // map-style: world follows the cursor
            hideHighlight();
            return;
        }
    }

    if (isOverlayOpen()) { hideHighlight(); return; }

    // Build mode: slide the placement ghost to the hovered tile (#36)
    if (isPlacing()) {
        const ph = raycastGround(e);
        if (ph && Number.isFinite(ph.x)) moveGhost(ph.x, ph.z);
        hideHighlight();
        return;
    }

    const hit = raycastGround(e);
    if (hit) setMouseHit(hit.worldX, hit.worldZ); // debug: where the cursor actually lands
    if (hit && hit.x >= 0 && hit.x < WORLD_SIZE && hit.z >= 0 && hit.z < WORLD_SIZE) {
        const tile = getTile(hit.x, hit.z);
        showHighlight(hit.x, hit.z, highlightColor(getSelectedTool().id, tile, hit.x, hit.z));
    } else {
        hideHighlight();
    }
});

// Keyboard
document.addEventListener('keydown', (e) => {
    markInput();
    if (namePromptOpen) return; // don't act on shortcuts while naming the farmer
    const num = parseInt(e.key);
    if (num >= 1 && num <= hotbarSlots.length) {
        selectSlot(num - 1);
        return;
    }
    if (e.key === 'Escape') {
        if (isPlacing()) { cancelPlacement(); notify('Build cancelled.'); return; }
        hideAllOverlays(); // one call closes every menu — see overlays.js (#56)
    }
    if (e.key === 'c' || e.key === 'C') {
        toggleCraft();
    }
    if (e.key === 'f' || e.key === 'F') {
        const el = document.getElementById('factory-overlay');
        if (el && !el.classList.contains('hidden')) hideFactory();
        else openFactory();
    }
    if ((e.key === 'r' || e.key === 'R') && isPlacing()) { rotatePlacement(); return; } // spin the ghost
    if (e.key === 'b' || e.key === 'B') {
        const el = document.getElementById('build-overlay');
        if (el && !el.classList.contains('hidden')) el.classList.add('hidden');
        else openBuild();
    }
    if (e.key === '`' || e.code === 'Backquote') toggleDebug(); // debug overlay
});

initOverlayDismiss(); // click the dark backdrop to close any menu (#56)
initOverlayChrome();  // give every panel a corner ✕ (#56)

function toggleCraft() {
    const el = document.getElementById('craft-overlay');
    if (el && !el.classList.contains('hidden')) { hideCraft(); return; }
    showCraft(inventory, craftItem);
}

function craftItem(recipeId) {
    const r = RECIPES[recipeId];
    if (!r) return;
    const can = Object.keys(r.inputs).every(k => inventory.count(k) >= r.inputs[k]);
    if (!can) { playDeny(); notify('Missing ingredients!'); return; }
    for (const k in r.inputs) inventory.remove(k, r.inputs[k]);
    inventory.add(r.out, 1);
    recordStat('cooked');
    playBuy();
    notify(`Crafted ${ITEMS[r.out].name}!`);
    refreshUI();
    showCraft(inventory, craftItem);
    triggerAutoSave();
}

const craftBtn = document.getElementById('craft-btn');
if (craftBtn) craftBtn.addEventListener('click', toggleCraft);

// --- Factories (auto-production) ---
function openFactory() {
    showFactory(coins, inventory, buildFactoryAction, hireEmployeeAction);
}

function buildFactoryAction(type) {
    const def = FACTORY_TYPES[type];
    if (!def) return;
    if (coins < def.cost) { playDeny(); notify("Can't afford that factory!"); return; }
    if (!buildFactory(type)) { notify('Already built!'); return; }
    coins -= def.cost;
    playExpand();
    const p = getPlayerWorldPos(); coinBurst(p.x, p.z); addShake(0.08);
    notify(`Built the ${def.name}! It now turns your ${ITEMS[def.input].name} into ${ITEMS[def.output].name}.`);
    refreshUI();
    openFactory();
    triggerAutoSave();
}

function hireEmployeeAction(type) {
    const fac = getFactories()[type];
    if (!fac) return;
    const cost = employeeCost(type, fac.employees);
    if (coins < cost) { playDeny(); notify("Can't afford to hire!"); return; }
    if (!hireEmployee(type)) { notify('Full crew!'); return; }
    coins -= cost;
    playBuy();
    notify(`Hired a worker at the ${FACTORY_TYPES[type].name}! 👷 Faster production.`);
    refreshUI();
    openFactory();
    triggerAutoSave();
}

const factoryBtn = document.getElementById('factory-btn');
if (factoryBtn) factoryBtn.addEventListener('click', openFactory);

const buildBtn = document.getElementById('build-btn');
if (buildBtn) buildBtn.addEventListener('click', openBuild);

const resetBtn = document.getElementById('reset-btn');
if (resetBtn) resetBtn.addEventListener('click', () => {
    if (confirm('Start a New Game? This erases your current save.')) {
        deleteSave();
        location.reload();
    }
});

// --- Actions ---

function performAction(tx, tz, tool) {
    // Arrived at a crate we walked to — pop it open
    if (tool.id === 'crate') { openCrateAndCollect(crateAt(tx, tz, 1.2)); return; }
    // Arrived at the fountain — toss a coin
    if (tool.id === 'fountain') { tossCoinAtFountain(); return; }
    // Arrived at the pond — cast a line
    if (tool.id === 'fish') { startCast(); return; }

    // Axe is special: trees live in the wild, off the farm-tile grid
    if (tool.id === 'axe') {
        const chopped = doChop(tx, tz);
        // If there was no tree, don't swallow a building click (shop/market/barn)
        if (!chopped) {
            const t = getTile(tx, tz);
            if (t) handleBuildingInteraction(t);
        }
        return;
    }

    const tile = getTile(tx, tz);
    if (!tile) return;

    switch (tool.id) {
        case 'move':
            handleBuildingInteraction(tile);
            break;

        case 'hoe': {
            if (hasWeedAt(tx, tz)) { mowWeeds(tx, tz); break; } // mow weeds (area) before tilling
            let n = 0;
            for (const c of tilesInRadius(tx, tz, getToolRadius('hoe'))) {
                const t = getTile(c.x, c.z);
                if (t && t.type === TILE.GRASS && isInFarm(c.x, c.z)) {
                    setTileType(c.x, c.z, TILE.SOIL); puff(c.x, c.z); n++;
                }
            }
            if (n > 0) {
                playTill();
                questEvent('till');
                notify(n > 1 ? `Tilled ${n} tiles!` : 'Tilled soil!');
                triggerAutoSave();
            } else if (tile.type === TILE.GRASS && !isInFarm(tx, tz)) {
                playDeny();
                notify('Outside your farm! Expand first.');
            }
            handleBuildingInteraction(tile);
            break;
        }

        case 'water': {
            let n = 0;
            for (const c of tilesInRadius(tx, tz, getToolRadius('water'))) {
                const t = getTile(c.x, c.z);
                if (t && (t.type === TILE.PLANTED || t.type === TILE.SOIL)) {
                    waterTile(t); n++;
                    if (n <= 9) sparkle(c.x, 0.4, c.z, [0x66bbff, 0xaad8ff, 0xffffff]); // water splash
                }
            }
            if (n > 0) {
                playWater();
                questEvent('water');
                recordStat('watered', n);
                notify(n > 1 ? `Watered ${n} tiles!` : 'Watered!');
            }
            handleBuildingInteraction(tile);
            break;
        }

        case 'hand':
            if (hasWeedAt(tx, tz)) { clearWeed(tx, tz); break; }
            if (tile.type === TILE.PLANTED && tile.cropStage >= 3) doHarvest(tx, tz);
            else tryPet(tx, tz); // pet a nearby animal
            handleBuildingInteraction(tile);
            break;

        case 'sprinkler':
            placeSprinkler(tx, tz, tile);
            handleBuildingInteraction(tile);
            break;

        default:
            if (tool.id.endsWith('_seed')) {
                if (tile.type === TILE.SOIL && inventory.has(tool.id)) {
                    const cropId = ITEMS[tool.id].cropId;
                    if (plantCrop(tx, tz, cropId)) {
                        inventory.remove(tool.id);
                        playPlant();
                        puff(tx, tz);
                        pop(getPlayerGroup(), 0.2);
                        questEvent('plant');
                        recordStat('planted');
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
        showShop(coins, inventory, buyItem, buyExpansion, buyBarnUpgrade, barnCost, buyAnimal);
    } else if (tile.type === TILE.MARKET) {
        showMarket(inventory, sellItem, getPrice, getTrend, sellAllCrops);
    } else if (tile.type === TILE.BARN) {
        openBarn();
    } else if (tile.type === TILE.HOUSE) {
        openHome();
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
    showShop(coins, inventory, buyItem, buyExpansion, buyBarnUpgrade, nextCost, buyAnimal);
    triggerAutoSave();
}

// Equipment upgrades: widen a tool's work area (watering can / hoe → tiller)
function buyToolUpgrade(tool) {
    const up = nextUpgrade(tool);
    if (!up) return;
    if (coins < up.cost) { playDeny(); notify("Can't afford that upgrade!"); return; }
    coins -= up.cost;
    upgradeTool(tool);
    playExpand();
    notify(`Upgraded to ${up.name}! Bigger work area.`);
    refreshUI();
    showShop(coins, inventory, buyItem, buyExpansion, buyBarnUpgrade, getNextBarnUpgradeCost(), buyAnimal);
    triggerAutoSave();
}
// Where can a structure go? Open wild ground, grass, or a path — never on
// buildings/water/soil-with-crops (Sims-style validity, #36).
function canPlaceStructure(x, z) {
    if (isSolidTile(x, z)) return false;
    const t = getTile(x, z);
    if (!t) return true; // open wild ground
    return t.type === TILE.GRASS || t.type === TILE.PATH;
}

// Beehive: buy → enter build mode, click to place; bees make honey nearby (#44)
function buyBeehive() {
    if (getHiveCount() >= 6) { playDeny(); notify('No room for more hives!'); return; }
    if (coins < HIVE_COST) { playDeny(); notify("Can't afford a beehive!"); return; }
    hideAllOverlays();
    beginPlacement({
        id: 'hive', name: 'Beehive', cost: HIVE_COST, footprint: 0.7,
        afford: () => coins >= HIVE_COST && getHiveCount() < 6,
        canPlace: canPlaceStructure,
        place: (x, z) => {
            if (!placeHive(x, z)) { playDeny(); return; }
            coins -= HIVE_COST; playExpand();
            notify('Beehive placed! 🐝'); refreshUI(); triggerAutoSave();
        },
    });
    notify('🐝 Click to place your beehive — ESC to cancel.');
}
// Chicken coop: buy → build mode, click to place; it lays eggs on its own
function buyCoop() {
    if (getCoopCount() >= 6) { playDeny(); notify('No room for more coops!'); return; }
    if (coins < COOP_COST) { playDeny(); notify("Can't afford a coop!"); return; }
    hideAllOverlays();
    beginPlacement({
        id: 'coop', name: 'Chicken Coop', cost: COOP_COST, footprint: 0.9,
        afford: () => coins >= COOP_COST && getCoopCount() < 6,
        canPlace: canPlaceStructure,
        place: (x, z) => {
            if (!placeCoop(x, z)) { playDeny(); return; }
            coins -= COOP_COST; playExpand();
            notify('Coop built! 🐔'); refreshUI(); triggerAutoSave();
        },
    });
    notify('🐔 Click to place your coop — ESC to cancel.');
}
// Decor prop: buy → build mode, click to place (R rotates). Pure cosmetics (#36).
function startDecorPlacement(d) {
    if (coins < d.cost) { playDeny(); notify(`Can't afford ${d.name}!`); return; }
    beginPlacement({
        id: d.id, name: d.name, cost: d.cost, footprint: d.footprint,
        afford: () => coins >= d.cost,
        canPlace: canPlaceStructure,
        place: (x, z, rot) => {
            placeDecor(d.id, x, z, rot);
            coins -= d.cost; playExpand();
            notify(`${d.emoji} ${d.name} placed! ✨ Beauty ${beautyScore()}`); refreshUI(); triggerAutoSave();
        },
    });
    notify(`${d.emoji} Click to place — R rotates, ESC cancels.`);
}
// Open the Sims-style Build catalog: structures + cosmetic decor in one panel.
function openBuild() {
    hideAllOverlays();
    const counts = countByType();
    const catalog = [
        { section: '🏗️ Structures' },
        { id: 'hive', emoji: '🐝', name: 'Beehive', cost: HIVE_COST, note: 'makes honey', max: 6, count: getHiveCount(), start: buyBeehive },
        { id: 'coop', emoji: '🐔', name: 'Chicken Coop', cost: COOP_COST, note: 'lays eggs', max: 6, count: getCoopCount(), start: buyCoop },
        { section: `🌷 Decor  ·  ✨ Farm Beauty ${beautyScore()} (draws more visitors)` },
        ...DECOR_CATALOG.map(d => ({ ...d, note: `${d.note} · ✨${d.beauty}`, count: counts[d.id] || 0, start: () => startDecorPlacement(d) })),
    ];
    showBuildMenu(coins, catalog, (entry) => { hideBuildMenu(); entry.start(); });
}
// Wishing fountain: buy → place once; click it to toss a coin for a blessing (#47)
function buyFountain() {
    if (hasFountain()) { notify('You already have a fountain!'); return; }
    if (coins < FOUNTAIN_COST) { playDeny(); notify("Can't afford a fountain!"); return; }
    buildFountain();
    coins -= FOUNTAIN_COST;
    playExpand();
    notify('Wishing fountain built! Walk up and toss a coin. ✨');
    refreshUI();
    showShop(coins, inventory, buyItem, buyExpansion, buyBarnUpgrade, getNextBarnUpgradeCost(), buyAnimal);
    triggerAutoSave();
}

const WISH_SEEDS = ['carrot_seed', 'tomato_seed', 'strawberry_seed', 'grape_seed', 'tulip_seed', 'sunflower_seed'];
const WISH_LINES = ['Make a wish, kiddo. ✨', "The old well's lucky, you know.", 'Your grandmother loved this fountain. ❤'];
function tossCoinAtFountain() {
    if (coins < TOSS_COST) { playDeny(); notify(`Need 🪙${TOSS_COST} to toss a coin.`); return; }
    coins -= TOSS_COST;
    const fp = getFountainPos();
    sparkle(fp.x, 0.7, fp.z, [0x9be8ff, 0xffffff, 0xffe066]);
    const kind = rollBlessing(Math.random());
    if (kind === 'coins') {
        const g = 25 + Math.floor(Math.random() * 55);
        coins += g; coinBurst(fp.x, fp.z); notify(`✨ The well bubbles up 🪙${g}!`);
    } else if (kind === 'seeds') {
        const s = WISH_SEEDS[Math.floor(Math.random() * WISH_SEEDS.length)];
        const q = 2 + Math.floor(Math.random() * 3); inventory.add(s, q);
        notify(`✨ A gift of ${q} ${ITEMS[s].name}!`);
    } else if (kind === 'grow') {
        advanceCropsOffline(60); rebuildCropMeshes();
        notify('✨ A growth blessing — your crops surge!');
    } else if (kind === 'fruit') {
        const q = 3 + Math.floor(Math.random() * 4); inventory.add('apple', q);
        notify(`✨ A basket of ${q} apples appears!`);
    } else {
        grandpaSayText(WISH_LINES[Math.floor(Math.random() * WISH_LINES.length)]);
        notify('You toss a coin and make a wish...');
    }
    hearts(fp.x, 1.0, fp.z);
    refreshUI();
    triggerAutoSave();
}

// Adopt a pet that follows Jenn + fetches drops (#48)
function buyPet(species) {
    const kind = species === 'cat' ? 'cat' : 'dog';
    if (hasPet()) { notify('You already have a pet!'); return; }
    if (coins < PET_COST) { playDeny(); notify("Can't afford a pet!"); return; }
    coins -= PET_COST;
    const p = getPlayerPos();
    adoptPet(kind, p.x - 1, p.z + 1);
    playBuy();
    const wp = getPlayerWorldPos(); hearts(wp.x, 0.8, wp.z);
    notify(kind === 'cat'
        ? 'You adopted a kitten! 🐈 It follows you and fetches drops.'
        : 'You adopted a puppy! 🐕 It follows you and fetches drops.');
    refreshUI();
    showShop(coins, inventory, buyItem, buyExpansion, buyBarnUpgrade, getNextBarnUpgradeCost(), buyAnimal);
    triggerAutoSave();
}
// Food bowl: draws more visitor cats, faster (#54)
function buyFoodBowl() {
    if (hasFoodBowl()) { notify('You already put a food bowl out!'); return; }
    if (coins < FOOD_BOWL_COST) { playDeny(); notify("Can't afford a food bowl!"); return; }
    placeFoodBowl();
    coins -= FOOD_BOWL_COST;
    playExpand();
    notify('Food bowl out! 🥣 More cats will come visit.');
    refreshUI();
    showShop(coins, inventory, buyItem, buyExpansion, buyBarnUpgrade, getNextBarnUpgradeCost(), buyAnimal);
    triggerAutoSave();
}
// Greenhouse: crops grow full-speed year-round (#51)
function buyGreenhouse() {
    if (hasGreenhouse()) { notify('You already have a greenhouse!'); return; }
    if (coins < GREENHOUSE_COST) { playDeny(); notify("Can't afford a greenhouse!"); return; }
    buildGreenhouse();
    coins -= GREENHOUSE_COST;
    setSeasonGrowth(effectiveGrowth(season.growth)); // apply right away
    playExpand();
    notify('Greenhouse built! 🌿 Crops now grow full-speed all year.');
    refreshUI();
    showShop(coins, inventory, buyItem, buyExpansion, buyBarnUpgrade, getNextBarnUpgradeCost(), buyAnimal);
    triggerAutoSave();
}
// Flytrap: carnivorous plant that snaps crows — never skunks (#58)
function buyFlytrap() {
    if (coins < FLYTRAP_COST) { playDeny(); notify("Can't afford a flytrap!"); return; }
    if (!buyFlytrapPlacement()) { playDeny(); notify('No room for more flytraps!'); return; }
    coins -= FLYTRAP_COST;
    playExpand();
    notify('Flytrap planted! 🪤 It snaps up crows (never skunks).');
    refreshUI();
    showShop(coins, inventory, buyItem, buyExpansion, buyBarnUpgrade, getNextBarnUpgradeCost(), buyAnimal);
    triggerAutoSave();
}
setShopHandlers({ onUpgrade: buyToolUpgrade, onBuyHive: buyBeehive, onBuyFountain: buyFountain, onBuyPet: buyPet, onBuyFoodBowl: buyFoodBowl, onBuyGreenhouse: buyGreenhouse, onBuyFlytrap: buyFlytrap, onBuyCoop: buyCoop });

// Bump a lifetime stat; if it crosses a milestone, celebrate it (#18).
function recordStat(key, n = 1) {
    const m = bumpStat(key, n);
    if (m) {
        const wp = getPlayerWorldPos();
        sparkle(wp.x, 1.1, wp.z, [0xffd700, 0xffe066, 0xffffff]);
        addShake(0.06);
        notify(`🏅 Milestone — ${m.label}: ${m.milestone.toLocaleString()}!`);
    }
}

function doHarvest(tx, tz) {
    const result = harvestCrop(tx, tz);
    if (result) {
        const q = harvestQuality(result.watered, Math.random(), luckMult()); // ⭐ watered = premium; luck boosts ⭐⭐ and rare 🌟 golden
        const qty = result.qty + q.bonus;
        inventory.add(result.itemId, qty);
        recordStat('harvested'); if (q.golden) recordStat('golden');
        playHarvest();
        pop(getPlayerGroup(), q.golden ? 0.4 : 0.28);
        const tail = result.regrew ? ' (regrowing!)' : '';
        if (q.golden) {
            sparkle(tx, 0.9, tz, [0xffd700, 0xffe066, 0xffffff]); // 🌟 a golden one!
            addShake(0.08);
            notify(`🌟 GOLDEN ${ITEMS[result.itemId].name}! ×${qty}${tail}`);
        } else {
            sparkle(tx, 0.6, tz, q.stars ? [0xffe066, 0xfff0c0, 0xffffff] : undefined);
            addShake(0.04);
            const stars = q.stars ? ' ' + '⭐'.repeat(q.stars) : '';
            notify(`Harvested ${qty} ${ITEMS[result.itemId].name}!${tail}${stars}`);
        }
        questEvent('harvest');
        // harvestCrop owns the tile state now (soil for one-shot, replanted for regrow)
        refreshUI();
        triggerAutoSave();
    }
}

function doChop(tx, tz) {
    const result = chopTree(tx, tz);
    if (!result) return false;    // no tree within reach
    playChop();
    if (result.felled) {
        recordStat('chopped');
        const parts = [];
        for (const id in result.drops) {
            inventory.add(id, result.drops[id]);
            parts.push(`${result.drops[id]} ${ITEMS[id] ? ITEMS[id].name : id}`);
        }
        playTimber();
        woodBurst(result.worldX, result.worldZ);
        addShake(0.14);
        pop(getPlayerGroup(), 0.3);
        questEvent('chop');
        notify(`Timber! Got ${parts.join(', ')}.`);
        refreshUI();
        triggerAutoSave();
    } else {
        chip(result.worldX, result.worldZ); // wood chips fly on each hit
        addShake(0.04);
    }
    return true;
}

// --- Fishing (#49): cast at the pond → wait for a bite → click to reel in ---
let fishing = null; // { state: 'cast'|'bite', timer }

function startCast() {
    if (fishing) return;
    fishing = { state: 'cast', timer: 1.5 + Math.random() * 1.8 };
    playWater();
    notify('🎣 Casting...');
}

function updateFishing(dt) {
    if (!fishing) return;
    fishing.timer -= dt;
    if (fishing.timer > 0) return;
    if (fishing.state === 'cast') {
        fishing.state = 'bite';
        fishing.timer = 1.3; // window to react
        notify('❗ A bite! Click to reel it in!');
        addShake(0.05);
    } else {
        fishing = null; // missed the window
        notify('🎣 ...it got away.');
    }
}

function hookFish() {
    if (!fishing || fishing.state !== 'bite') return;
    const fish = pickFish(season.name, Math.random());
    const weight = rollFishSize(fish, Math.random());
    const isRecord = tryFishRecord(fish, weight);
    fishing = null;
    inventory.add(fish, 1);
    recordStat('fish');
    playHarvest();
    const p = getPlayerWorldPos();
    sparkle(p.x, 0.6, p.z, isRecord ? [0xffe066, 0xfff0c0, 0xffffff] : [0x9be8ff, 0xffffff]);
    pop(getPlayerGroup(), isRecord ? 0.34 : 0.24);
    if (isRecord) addShake(0.08);
    const rec = isRecord ? ' — 🏆 NEW PERSONAL BEST!' : '';
    notify(
        fish === 'catfish' ? `🎣 A ${weight} lb Catfish — it has a cat face?! Meow. 🐱${rec}` :
        fish === 'bob' ? `🎣 You caught Bob (${weight} lb). Bob is a fish. Hi, Bob. 👋${rec}` :
        `🎣 Caught a ${weight} lb ${ITEMS[fish].name}!${rec}`
    );
    refreshUI();
    triggerAutoSave();
}

function tryPet(tx, tz) {
    // Holding wheat near livestock? Feed it — tops up hunger so it produces faster.
    if (inventory.count('wheat') > 0) {
        const fed = feedNearest(tx, tz);
        if (fed) {
            inventory.remove('wheat', 1);
            hearts(fed.x, 0.7, fed.z);
            playStore();
            notify(`Fed the ${fed.species}! 🌾 Happy animals produce faster.`);
            refreshUI();
            triggerAutoSave();
            return;
        }
    }
    const a = petNearest(tx, tz);
    if (!a) return;
    recordStat('petted');
    hearts(a.x, 0.6, a.z);
    playStore();
    notify(`You pet the ${a.species}! 💛`);
}

// Click a delivered crate and it bursts open, scattering its contents into your
// bag (Trent's "click a box and it explodes open"). Gifts are a coin haul.
function openCrateAndCollect(crate) {
    if (!crate) return;
    const res = openCrateAt(crate.x, crate.z, 1.6);
    if (!res) return;
    woodBurst(crate.x, crate.z);
    sparkle(crate.x, 0.8, crate.z, [0xffd24a, 0xfff0c0, 0xffffff]);
    addShake(0.14);
    pop(getPlayerGroup(), 0.22);
    playExpand();
    const parts = [];
    if (res.contents.coins) { coins += res.contents.coins; parts.push(`🪙${res.contents.coins}`); }
    for (const id in res.contents.items) {
        inventory.add(id, res.contents.items[id]);
        parts.push(`${res.contents.items[id]} ${ITEMS[id] ? ITEMS[id].name : id}`);
    }
    notify(`📦 ${CRATE_KINDS[res.kind].name} opened! Got ${parts.join(', ')}.`);
    refreshUI();
    triggerAutoSave();
}

function clearWeed(tx, tz) {
    if (!clearWeedAt(tx, tz)) return;
    playStore();
    puff(tx, tz);
    pop(getPlayerGroup(), 0.18);
    questEvent('weed');
    notify('Pulled the weeds!');
    triggerAutoSave();
}

// The hoe mows weeds across its work area (a Tiller clears a whole 5x5 patch)
function mowWeeds(tx, tz) {
    const mowed = clearWeedsInRadius(tx, tz, getToolRadius('hoe'));
    if (!mowed) return;
    playStore();
    puff(tx, tz);
    pop(getPlayerGroup(), 0.18);
    questEvent('weed');
    notify(mowed > 1 ? `Mowed ${mowed} weeds!` : 'Pulled the weeds!');
    triggerAutoSave();
}

// --- Idle autoplay (maintenance only) ---

// AFK maintenance: collect loose drops, water dry crops, and wander.
// Harvesting of plants is deliberately LEFT TO THE PLAYER.
function findMaintenanceTask() {
    const p = getPlayerPos();

    // 1. Walk to the nearest drop (egg/milk/apple) — proximity auto-collects it
    const a = getNearestDrop(p.x, p.z);
    const f = getNearestFruitDrop(p.x, p.z);
    let drop = a;
    if (f && (!a || ((f.x - p.x) ** 2 + (f.z - p.z) ** 2) < ((a.x - p.x) ** 2 + (a.z - p.z) ** 2))) drop = f;
    if (drop) return { x: Math.round(drop.x), z: Math.round(drop.z), tool: { id: 'move' } };

    // 2. Water a dry crop (maintenance)
    let water = null;
    forEachFarmTile((x, z, t) => {
        if (water || autoSkip.has(x + ',' + z)) return;
        if (t.type === TILE.PLANTED && t.cropStage < 3 && !t.watered) water = { x, z, tool: { id: 'water' } };
    });
    if (water) return water;

    // 3. Pull a weed (tidying — keep the farm clear while idle)
    let weed = null;
    forEachFarmTile((x, z, t) => {
        if (weed || autoSkip.has(x + ',' + z)) return;
        if (hasWeedAt(x, z)) weed = { x, z, tool: { id: 'hand' } };
    });
    if (weed) return weed;

    // 4. Wander to a nearby walkable tile so Jenn ambles around
    for (let i = 0; i < 10; i++) {
        const wx = p.x + Math.floor(Math.random() * 7) - 3;
        const wz = p.z + Math.floor(Math.random() * 7) - 3;
        if ((wx !== p.x || wz !== p.z) && !isSolidTile(wx, wz)) return { x: wx, z: wz, tool: { id: 'move' } };
    }
    return null;
}

let autoBadgeEl = null;
function setAutoBadge(on) {
    if (!autoBadgeEl) {
        autoBadgeEl = document.createElement('div');
        autoBadgeEl.id = 'auto-badge'; // styled via style.css (unified design system)
        autoBadgeEl.textContent = '🤖 Auto-farming…';
        document.body.appendChild(autoBadgeEl);
    }
    autoBadgeEl.style.opacity = on ? '1' : '0';
}

// Active meal buffs shown as small pills (icon + remaining time), top-right under
// the AFK badge. Throttled to ~4Hz so the countdown ticks without per-frame churn. (#50)
let buffBarEl = null;
let buffHudTimer = 0;
function renderBuffHud(dt) {
    buffHudTimer -= dt;
    if (buffHudTimer > 0) return;
    buffHudTimer = 0.25;
    if (!buffBarEl) { buffBarEl = document.createElement('div'); buffBarEl.id = 'buff-bar'; document.body.appendChild(buffBarEl); }
    const buffs = activeBuffs();
    if (!buffs.length) { buffBarEl.style.display = 'none'; buffBarEl.innerHTML = ''; return; }
    buffBarEl.style.display = 'flex';
    buffBarEl.innerHTML = buffs.map(b => `<div class="buff-pill">${b.icon}<span>${fmtBuffTime(b.remaining)}</span></div>`).join('');
}

function placeSprinkler(tx, tz, tile) {
    if (!inventory.has('sprinkler')) {
        playDeny();
        notify('No sprinklers! Buy one at the shop.');
        return;
    }
    if (!isInFarm(tx, tz) || (tile.type !== TILE.SOIL && tile.type !== TILE.GRASS)) {
        playDeny();
        notify("Can't place a sprinkler there.");
        return;
    }
    inventory.remove('sprinkler');
    addSprinkler(tx, tz);
    playExpand();
    puff(tx, tz);
    notify('Sprinkler placed! It waters nearby tiles.');
    refreshUI();
    triggerAutoSave();
}

// --- Health & eating ---
// Health gently drains while you work; eat crops/herbs/potions to top it up.
// healValue lives in foods.js (shared with the Bag tooltips + unit-tested).

function eatItem(id) {
    if (inventory.count(id) <= 0) return;
    const heal = healValue(id);
    if (heal <= 0) { notify("Can't eat that!"); return; }
    inventory.remove(id, 1);
    health = Math.min(MAX_HEALTH, health + heal);
    const p = getPlayerWorldPos();
    hearts(p.x, 1.0, p.z);
    playStore();
    notify(`Ate ${ITEMS[id].name} — +${heal} health 💚`);
    const buff = applyMeal(id); // some meals also grant a short buff (#50)
    if (buff) { sparkle(p.x, 1.2, p.z, [0x66e07a, 0xd6ff8c, 0xffffff]); notify(buff.label); }
    refreshUI();
    triggerAutoSave();
}

// Count sale income toward the company's lifetime value; celebrate rank-ups.
// This drives the farm→Shampoo Corporation progression (corp.js).
function recordEarnings(amount) {
    if (amount <= 0) return;
    const before = getRankIndex();
    addEarnings(amount);
    if (getRankIndex() > before) {
        const r = getRank();
        const p = getPlayerWorldPos();
        coinBurst(p.x, p.z); hearts(p.x, 1.2, p.z); addShake(0.18);
        playExpand();
        notify(`🏢 Your farm is now a ${r.emoji} ${r.name}! (+${Math.round(r.bonus * 100)}% sell bonus)`);
        if (r.name === 'Shampoo Corporation') {
            setTimeout(() => grandpaSayText(`A shampoo empire?! I always knew you'd make it big, kiddo. 🧴`), 1600);
        }
    }
}

// A drive-by buyer stops at the roadside stall and buys one good you're holding
function buyerPurchase(wx, wz) {
    for (const id in ITEMS) {
        if (ITEMS[id].type !== 'crop' || inventory.count(id) <= 0) continue;
        inventory.remove(id, 1);
        const price = Math.round(getPrice(id) * (1 + getSellBonus()));
        coins += price;
        recordEarnings(price);
        recordSale(id, 1); // selling still nudges the market price down
        playSell();
        coinBurst(wx, wz);
        notify(`A passerby bought ${ITEMS[id].name} for 🪙${price}!`);
        refreshUI();
        triggerAutoSave();
        return;
    }
    // nothing on hand to sell — the buyer just drives on
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
    showShop(coins, inventory, buyItem, buyExpansion, buyBarnUpgrade, getNextBarnUpgradeCost(), buyAnimal);
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
    showShop(coins, inventory, buyItem, buyExpansion, buyBarnUpgrade, getNextBarnUpgradeCost(), buyAnimal);
    triggerAutoSave();
}

function buyAnimal(species) {
    const def = ANIMALS[species];
    if (!def || coins < def.cost) {
        playDeny();
        notify("Can't afford that!");
        return;
    }
    coins -= def.cost;
    buyAnimalEntity(species);
    playBuy();
    notify(`Bought a ${def.name}!`);
    refreshUI();
    showShop(coins, inventory, buyItem, buyExpansion, buyBarnUpgrade, getNextBarnUpgradeCost(), buyAnimal);
    triggerAutoSave();
}

function sellItem(itemId) {
    const item = ITEMS[itemId];
    if (!item || !inventory.has(itemId)) return;
    const qty = inventory.count(itemId);
    inventory.remove(itemId, qty);
    const earned = Math.round(qty * getPrice(itemId) * (1 + getSellBonus()));
    coins += earned;
    recordEarnings(earned);
    recordStat('sold', qty);
    recordSale(itemId, qty);   // flooding the market lowers future price
    playSell();
    { const pp = getPlayerWorldPos(); coinBurst(pp.x, pp.z); addShake(0.05); }
    notify(`Sold ${qty} ${item.name} for 🪙${earned}!`);
    refreshUI();
    showMarket(inventory, sellItem, getPrice, getTrend, sellAllCrops);
    triggerAutoSave();
}

function sellAllCrops() {
    let total = 0, count = 0;
    for (const id in ITEMS) {
        if (ITEMS[id].type !== 'crop') continue;
        const qty = inventory.count(id);
        if (qty <= 0) continue;
        inventory.remove(id, qty);
        const earned = Math.round(qty * getPrice(id) * (1 + getSellBonus()));
        coins += earned; total += earned; count += qty;
        recordSale(id, qty); // flooding still tanks future prices
    }
    if (count > 0) {
        recordEarnings(total);
        recordStat('sold', count);
        playSell();
        const pp = getPlayerWorldPos(); coinBurst(pp.x, pp.z); addShake(0.07);
        notify(`Sold ${count} items for 🪙${total}!`);
        refreshUI();
        showMarket(inventory, sellItem, getPrice, getTrend, sellAllCrops);
        triggerAutoSave();
    } else {
        notify('Nothing to sell!');
    }
}

// --- Barn ---

function openBarn() {
    showBarn(barnStorage, barnCapacity, inventory, barnDeposit, barnWithdraw, barnDepositAll);
}

// --- Home (cottage) ---

function openHome() {
    const letter = isClaimed(day) ? null : makeLetter(day);
    if (letter && letter.kind === 'request') letter.canDeliver = canFulfill(letter, inventory);
    showHome(playerName, sleepAtHome, letter, () => claimMail(letter), allStats());
}

// Collect Grandpa's daily letter: a gift, or fulfil a delivery request.
function claimMail(letter) {
    if (!letter) return;
    if (letter.kind === 'request' && !canFulfill(letter, inventory)) {
        playDeny();
        notify(`You need ${letter.qty} ${ITEMS[letter.crop] ? ITEMS[letter.crop].name : letter.crop} for that.`);
        return;
    }
    const reward = claimLetter(letter, inventory); // consumes the goods for a request
    if (reward <= 0) return;
    coins += reward;
    markClaimed(day);
    playBuy();
    const p = getPlayerWorldPos();
    coinBurst(p.x, p.z); hearts(p.x, 1.0, p.z);
    notify(letter.kind === 'gift' ? `Grandpa's gift: +🪙${reward}! 💛` : `Delivered! Grandpa paid 🪙${reward}. 💛`);
    refreshUI();
    openHome();
    triggerAutoSave();
}

// Sleep skips to next morning: heal up, and crops grow + animals produce while
// you rest (reusing the offline helpers). The loop's new-day check ticks the
// market/season as the day rolls over.
function sleepAtHome() {
    const target = nextMorning(gameTime, DAY_LENGTH);
    const skipped = target - gameTime;
    gameTime = target;
    health = MAX_HEALTH;
    const cp = advanceCropsOffline(skipped);
    rebuildCropMeshes();
    const prod = creditOfflineProduce(skipped);
    let pc = 0;
    for (const k in prod) { inventory.add(k, prod[k]); pc += prod[k]; }
    playNewDay();
    const p = getPlayerWorldPos();
    sparkle(p.x, 0.9, p.z, [0xffe0a0, 0xfff0d0, 0xffffff]);
    const bits = [];
    if (cp.ripened) bits.push(`${cp.ripened} crops ripened`);
    if (pc) bits.push(`+${pc} produce`);
    notify(`😴 Slept until morning — fully rested!${bits.length ? ' (' + bits.join(', ') + ')' : ''}`);
    hideHome();
    refreshUI();
    triggerAutoSave();
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

// --- UI Refresh ---

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
    updateHUD(coins, day, getTimeString(progress), season);
    updateHotbar(selectedSlot, inventory, selectSlot);
    updateBag(inventory, eatItem);
    updateHealth(health, MAX_HEALTH);
}

// --- Save ---

let saveTimer = null;
function triggerAutoSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        const pos = getPlayerPos();
        saveGame({
            version: 4,
            coins,
            day,
            gameTime,
            playerName,
            gender: playerGender,
            health,
            farmLevel: getFarmLevel(),
            barnLevel,
            playerX: pos.x,
            playerZ: pos.z,
            inventory: inventory.serialize(),
            barnStorage: barnStorage.serialize(),
            market: serializeMarket(),
            animals: serializeAnimals(),
            tiles: serializeWorld(),
            trees: serializeTrees(),
            sprinklers: serializeSprinklers(),
            weeds: serializeWeeds(),
            quests: serializeQuests(),
            factories: serializeFactories(),
            corp: serializeCorp(),
            crates: serializeCrates(),
            equipment: serializeEquipment(),
            mail: serializeMail(),
            hives: serializeHives(),
            coops: serializeCoops(),
            decor: serializeDecor(),
            fountain: serializeFountain(),
            pet: serializePet(),
            visitors: serializeVisitors(),
            greenhouse: serializeGreenhouse(),
            flytraps: serializeFlytraps(),
            fishRecords: serializeFishRecords(),
            stats: serializeStats(),
            lastSaved: Date.now(),
        });
    }, 1000);
}

// --- Game Loop ---

let lastTime = performance.now();

function gameLoop(now) {
    requestAnimationFrame(gameLoop);

    const frameMs = now - lastTime;
    const dt = Math.min(frameMs / 1000, 0.1);
    lastTime = now;
    gameTime += dt;

    profBegin(); // per-phase frame profiler (#35) — see breakdown in the debug HUD (`)
    tickBuffs(dt); // count down any active meal buffs (#50)
    renderBuffHud(dt); // show them as pills top-right
    resolvePendingRoute(); // upgrade last click's straight walk into an A* route (#25)
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
        } else if (pendingAction.auto) {
            // auto-farm couldn't reach this tile — skip it for the rest of this AFK session
            autoSkip.add(pendingAction.x + ',' + pendingAction.z);
            if (autoSkip.size > 40) autoSkip.clear();
        }
        pendingAction = null;
    }

    // Idle autoplay: once onboarding is done, an idle player's farm tends itself
    autoCheckTimer -= dt;
    const idle = (performance.now() - lastInputAt) > AFK_MS;
    const onboardingDone = serializeQuests().done;
    const wantAuto = idle && onboardingDone && !namePromptOpen && !isOverlayOpen();
    if (wantAuto && !isMoving() && !pendingAction && autoCheckTimer <= 0) {
        autoCheckTimer = 1.0; // scan at most once a second
        const task = findMaintenanceTask();
        if (task) { task.auto = true; pendingAction = task; moveTo(task.x, task.z); }
    }
    if (wantAuto !== autoActive) { autoActive = wantAuto; setAutoBadge(autoActive); }

    // Health gently drains during active play; pauses while AFK so idle stays safe
    if (!autoActive && health > 0) health = Math.max(0, health - HEALTH_DRAIN * dt);
    healthUiTimer -= dt;
    if (healthUiTimer <= 0) { healthUiTimer = 0.25; updateHealth(health, MAX_HEALTH); }
    profMark('player');

    updateCrops(dt);
    profMark('crops');
    if (onboardingDone) growWeeds(dt, getFarmLevel()); // neglected farm slowly sprouts weeds again
    updateTrees(dt, getPlayerWorldPos(), onCollectFruit);
    updateSprinklers(dt);
    updateBuyers(dt, buyerPurchase);
    updateJuice(dt);

    // Factories quietly convert raw goods (grapes, milk) into products over time
    const made = updateFactories(dt, inventory);
    if (Object.keys(made).length) refreshUI();

    updateFishing(dt); // bees, fountain, crates + pet now tick via the registry (updateSystems)
    profMark('world');

    const ppos = getPlayerWorldPos();
    updateChunks(ppos.x, ppos.z); // stream infinite terrain around Jenn
    updateOverlays(); // rebuild instanced tile overlays if a tile changed type
    updateDecor();    // rebuild instanced build-mode props if one was placed/removed
    profMark('chunks');
    updateAnimals(dt, ppos, onCollectProduce, getPetPos()); // pet ticks via the registry
    profMark('animals');
    updateGrandpa(dt, {
        coins, day, name: playerName,
        wood: inventory.count('wood'),
        crops: Object.entries(ITEMS).reduce((s, [id, v]) => v.type === 'crop' ? s + inventory.count(id) : s, 0),
    });
    updateCamera(new THREE.Vector3(ppos.x, 0, ppos.z), dt, isMoving());
    profMark('misc');

    // Day/night cycle
    const dayProgress = getDayProgress();
    updateDayNight(dayProgress);
    updateAmbient(isNightTime(dayProgress));
    // Registered systems (weather, fireflies, bees, fountain, crates, pet, …)
    // tick generically via the registry, using this shared world API (ctx).
    updateSystems(dt, {
        dt, gameTime, season, playerPos: ppos, isNight: isNightTime(dayProgress),
        addItem: (id, q) => inventory.add(id, q),
        gainCoins: (n) => { coins += n; },
        getNearestDrop, refreshUI, notify, sparkle, playStore,
    });
    profMark('systems');

    const newDay = Math.floor(gameTime / DAY_LENGTH) + 1;
    if (newDay > day) {
        day = newDay;
        dailyTick();          // market demand drifts, prices recover
        const ns = getSeason(day);
        if (ns.index !== season.index) {
            season = ns;
            setSeasonGrowth(effectiveGrowth(ns.growth)); // greenhouse keeps it full-speed (#51)
            const fest = startFestival(ns.name); // season opens with a festival (#52)
            if (fest) {
                coins += fest.gift;
                const fp = getPlayerWorldPos(); coinBurst(fp.x, fp.z); hearts(fp.x, 1.0, fp.z);
                notify(`${fest.emoji} ${fest.name}! Grandpa gifts 🪙${fest.gift}`);
            } else {
                notify(`${ns.emoji} ${ns.name} has arrived!`);
            }
        } else {
            notify(`Day ${day} begins!`);
        }
        playNewDay();
        refreshUI();
        triggerAutoSave();
    }

    // Debug overlay: show the move target + path
    setPlayerTarget(getTarget());
    setDebugPath(getPath());

    render();
    profMark('render');
    // CPU work = whole-frame JS time (start `now` → here). Compared against the
    // GPU timer + rAF frame time, this reveals CPU- vs GPU- vs vsync-bound (#35).
    tickDebug(frameMs, performance.now() - now);
}

requestAnimationFrame(gameLoop);
