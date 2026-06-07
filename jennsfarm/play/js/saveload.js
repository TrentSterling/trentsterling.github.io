// js/saveload.js — persistence layer extracted from main.js (#9 modularization, step 2).
//
// Owns exactly two boot/runtime concerns, MOVED VERBATIM from main.js (zero behaviour change):
//   • triggerAutoSave() — the debounced localStorage write of the whole game state.
//   • applySave(saved)  — the boot-time load + offline-progress + world-init block.
//
// applySave runs for BOTH fresh games (saved === null) and loaded games: the `if (saved)`
// guards wrap only the parts that read saved.*; starter-animal/weed/season/Grandpa init runs
// unconditionally (see MODULARIZATION.md C2/C3). recalcBarnCapacity() is NOT here — main.js
// owns it and calls it on the line right after applySave(saved) (MODULARIZATION.md M2).
//
// Import direction: saveload imports leaves (state/ui/world/etc.), NEVER main.js. main.js
// imports FROM here. Every cross-module reference is inside a function body (deferred to
// runtime), so the natural import graph has no eager cycle.

import { G, inventory, barnStorage, DAY_LENGTH } from './state.js';
import { saveGame } from './save.js';
import { scene, setDebugCamera, addShake } from './renderer.js';
import { serializeWorld, loadWorld, getFarmLevel, setFarmLevel } from './world.js';
import { getPlayerPos, setPlayerPos, getPlayerWorldPos, setPlayerGender } from './player.js';
import { rebuildCropMeshes, setSeasonGrowth } from './farm.js';
import { serializeStats, loadStats } from './stats.js';
import { getSeason } from './seasons.js';
import { serializeTrees, loadTrees, creditOfflineFruit } from './trees.js';
import { notify } from './ui.js';
import { serializeMail, loadMail } from './mailbox.js';
import { serializeVisitors, loadVisitors } from './visitors.js';
import { creditOfflineHoney, serializeHives, loadHives } from './bees.js';
import { creditOfflineEggs, serializeCoops, loadCoops } from './coop.js';
import { serializeFountain, loadFountain } from './fountain.js';
import { serializePet, loadPet } from './pets.js';
import { serializeFishRecords, loadFishRecords } from './fishing.js';
import { effectiveGrowth, serializeGreenhouse, loadGreenhouse } from './greenhouse.js';
import { serializeFlytraps, loadFlytraps } from './flytrap.js';
import { startFestival } from './festivals.js';
import { creditOfflineFactories, serializeFactories, loadFactories } from './factories.js';
import { syncFactoryBuildings } from './factorybuildings.js';
import { addEarnings, getSellBonus, serializeCorp, loadCorp } from './corp.js';
import { creditOfflineCrates, serializeCrates, loadCrates } from './crates.js';
import { serializeEquipment, loadEquipment } from './equipment.js';
import { serializeMarket, loadMarket, offlineBuyerSales } from './market.js';
import { initAnimals, serializeAnimals, loadAnimals, creditOfflineProduce } from './animals.js';
import { coinBurst, hearts } from './juice.js';
import { initGrandpa } from './grandpa.js';
import { serializeSprinklers, loadSprinklers } from './sprinklers.js';
import { serializeDecor, loadDecor } from './decor.js';
import { serializeBins, loadBins } from './bins.js';
import { serializeBarns, loadBarns } from './barns.js';
import { spawnInitialWeeds, serializeWeeds, loadWeeds, getWeedCount } from './weeds.js';
import { advanceCropsOffline } from './offline.js';
import { initQuests, serializeQuests, loadQuests, getQuestIndex, completeSilently } from './quests.js';
// NOTE: refreshUI() in main.js is literally `() => { G._uiDirty = true; }`. saveload.js cannot
// import it (it lives in main.js, and main.js imports FROM us — importing back would be a cycle),
// and it has not been extracted to a leaf module yet (uiwiring.js is a later step). So the two
// places below that need it set the shared dirty flag directly — byte-for-byte the same effect.

// --- Save ---

export function triggerAutoSave() {
    if (G.saveTimer) clearTimeout(G.saveTimer);
    G.saveTimer = setTimeout(() => {
        const pos = getPlayerPos();
        saveGame({
            version: 4,
            coins: G.coins,
            day: G.day,
            gameTime: G.gameTime,
            playerName: G.playerName,
            gender: G.playerGender,
            health: G.health,
            farmLevel: getFarmLevel(),
            barnLevel: G.barnLevel,
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
            bins: serializeBins(),
            barns: serializeBarns(),
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

// --- Boot-time load + offline progress + world init ---
//
// Runs for BOTH fresh and loaded games. The `if (saved)` blocks read saved.*; everything
// outside them (animals, season/festival/Grandpa, weeds, quest wiring, fresh-game gameTime)
// must run regardless — do NOT early-return when saved is null (MODULARIZATION.md C3).
// recalcBarnCapacity() is intentionally NOT called here — main.js calls it right after.
export function applySave(saved) {
    if (saved) {
        G.coins = saved.coins ?? 100;
        G.day = saved.day ?? 1;
        G.gameTime = saved.gameTime ?? 0;
        G.health = saved.health ?? 100;
        inventory.load(saved.inventory ?? {});
        if (saved.barnStorage) barnStorage.load(saved.barnStorage);
        if (saved.barnLevel) G.barnLevel = saved.barnLevel; // capacity recalc'd after barns load
        setPlayerPos(saved.playerX ?? 24, saved.playerZ ?? 24);
        if (saved.farmLevel) setFarmLevel(saved.farmLevel);
        if (saved.market) loadMarket(saved.market);
        loadWorld(saved.tiles, saved.farmLevel);
        rebuildCropMeshes();
        if (saved.trees) loadTrees(saved.trees);
        if (saved.sprinklers) loadSprinklers(saved.sprinklers);
        if (saved.factories) loadFactories(saved.factories);
        syncFactoryBuildings(); // show buildings for any factories the save owns (#64)
        if (saved.corp) loadCorp(saved.corp);
        if (saved.crates) loadCrates(saved.crates);
        if (saved.equipment) loadEquipment(saved.equipment);
        if (saved.mail) loadMail(saved.mail);
        if (saved.hives) loadHives(saved.hives);
        if (saved.coops) loadCoops(saved.coops);
        loadDecor(saved.decor); // build-mode props (safe with no data → clears)
        loadBins(saved.bins);   // wooden crates + contents (safe with no data → clears)
        loadBarns(saved.barns); // placed barns + their storage (#71) — main.js recalcs capacity after applySave
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
    if (_params.has('noon')) G.gameTime = DAY_LENGTH * 0.27;
    if (_params.has('money')) G.coins += parseInt(_params.get('money')) || 0;

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
            G.gameTime += away;
            const cp = advanceCropsOffline(away);
            rebuildCropMeshes();
            const prod = creditOfflineProduce(away);
            let pcount = 0;
            for (const k in prod) { inventory.add(k, prod[k]); pcount += prod[k]; }
            const fruit = creditOfflineFruit(away);
            if (fruit) { inventory.add('apple', fruit); }
            const facProd = creditOfflineFactories(away, inventory, barnStorage); // factories ran on bag + barn goods
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
                G.coins += bonused;
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

    if (saved && saved.playerName) G.playerName = saved.playerName;
    if (saved && saved.gender) { G.playerGender = saved.gender; setPlayerGender(saved.gender); }
    G.season = getSeason(G.day);
    setSeasonGrowth(effectiveGrowth(G.season.growth)); // greenhouse lifts the floor (#51)
    startFestival(G.season.name); // put up the current season's bunting (#52)
    initGrandpa();

    // Starting weeds: fresh games get an overgrown farm to clear; saves restore theirs
    if (!saved) {
        spawnInitialWeeds();
        if (!_params.has('noon')) G.gameTime = DAY_LENGTH * 0.2; // open in bright morning, not 6am dark
    }
    else if (saved.weeds) loadWeeds(saved.weeds);

    // Grandpa's intro chore chain
    function grantReward(r) {
        if (!r) return;
        if (r.coins) G.coins += r.coins;
        if (r.seeds) for (const k in r.seeds) inventory.add(k, r.seeds[k]);
        if (r.items) for (const k in r.items) inventory.add(k, r.items[k]);
        if (r.coins) notify(`Grandpa paid you 🪙${r.coins}!`);
        G._uiDirty = true; // == refreshUI() (see note by imports)
        triggerAutoSave();
    }
    initQuests({
        name: G.playerName,
        reward: grantReward,
        complete: () => {
            G.coins += 100;
            const p = getPlayerWorldPos();
            hearts(p.x, 1.0, p.z);
            coinBurst(p.x, p.z);
            addShake(0.12);
            notify('🌻 Grandpa: the farm is all yours now! (+🪙100)');
            G._uiDirty = true; // == refreshUI() (see note by imports)
            triggerAutoSave();
        },
    });
    if (saved && saved.quests) loadQuests(saved.quests);
    // Un-stick old saves: if loading onto the very first chore with no weeds to
    // clear (e.g. a save from before the weeds feature), skip the onboarding.
    if (saved && getQuestIndex() === 0 && getWeedCount() === 0 && !serializeQuests().done) {
        completeSilently();
    }
}
