'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const js = fs.readFileSync(path.join(root, 'assets/js/tront-about-discovery.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/tront-about-discovery.css'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function storage(seed) {
    const values = new Map(Object.entries(seed || {}));
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        values
    };
}

function loadApi() {
    const document = {
        readyState: 'complete',
        documentElement: { getAttribute() { return null; } },
        addEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    const window = {
        document,
        location: { href: 'https://tront.xyz/lerp/', pathname: '/lerp/' },
        navigator: {},
        sessionStorage: storage(),
        URL,
        Math,
        matchMedia() { return { matches: false }; }
    };
    vm.runInNewContext(js, { window });
    return window.TrontAboutDiscovery;
}

test('catalog selects CraftMine, SMEAR and one approved random game', () => {
    const api = loadApi();
    const ids = plain(api.catalog.map(game => game.id));
    assert.deepEqual(ids, ['craftmine', 'smear', 'inkride', 'tinytreads', 'tinyrise']);
    assert.deepEqual(plain(api.selectGameIds('/lerp/', { storage: storage(), random: () => 0.99 })), ['craftmine', 'smear', 'tinyrise']);
    assert.deepEqual(plain(api.catalog.filter(game => ['inkride', 'tinytreads', 'tinyrise'].includes(game.id)).map(game => game.href)), ['/inkride/', '/tinytreads/', '/tinyrise/']);
    assert.equal(new Set(ids).size, ids.length);
});

test('every discovery card description is a complete, count-light sentence', () => {
    const api = loadApi();
    for (const game of api.catalog) {
        assert.match(game.description, /^[A-Z].*[.!?]$/, game.id);
        assert.doesNotMatch(game.description, /\b\d+\s+(?:blocks|mobs|weapons)\b/i, game.id);
    }
});

test('current canonical paths and common aliases resolve to the same game id', () => {
    const api = loadApi();
    for (const [path, id] of [
        ['/craftmine/', 'craftmine'], ['/craft-mine/index.html', 'craftmine'],
        ['https://tront.xyz/smear/', 'smear'], ['/ink-ride/', 'inkride'],
        ['/tiny-treads/', 'tinytreads'], ['/tinytreads/index.html', 'tinytreads'],
        ['/tiny-rise/', 'tinyrise']
    ]) assert.equal(api.canonicalGameId(path), id, path);
    assert.equal(api.canonicalGameId('/lerp/'), null);
});

test('the random pick is stable for a session and never duplicates the current game', () => {
    const api = loadApi();
    const session = storage();
    const first = api.selectGameIds('/smear/', { storage: session, random: () => 0.01 });
    const second = api.selectGameIds('/smear/', { storage: session, random: () => 0.99 });
    assert.deepEqual(plain(first), ['craftmine', 'inkride']);
    assert.deepEqual(plain(second), plain(first));
    assert.equal(session.values.get('tront-about-discovery-session-v1'), 'inkride');
    assert.deepEqual(JSON.parse(session.values.get('tront-about-discovery-session-v2')), ['inkride']);
    assert.equal(new Set(first).size, first.length);
});
});

test('a saved pair from the previous version retains its first session pick', () => {
    const api = loadApi();
    const session = storage({
        'tront-about-discovery-session-v1': 'inkride',
        'tront-about-discovery-session-v2': JSON.stringify(['inkride', 'tinytreads'])
    });
    assert.deepEqual(plain(api.selectGameIds('/smear/', { storage: session, random: () => 0.99 })), ['craftmine', 'inkride']);
    assert.deepEqual(JSON.parse(session.values.get('tront-about-discovery-session-v2')), ['inkride']);
});

test('a current random game gets an eligible fallback without replacing the session pick', () => {
    const api = loadApi();
    const session = storage({ 'tront-about-discovery-session-v1': 'inkride' });
    assert.deepEqual(plain(api.selectGameIds('/ink-ride/', { storage: session, random: () => 0.99 })), ['craftmine', 'smear', 'tinytreads']);
    assert.equal(session.values.get('tront-about-discovery-session-v1'), 'inkride');
    assert.deepEqual(plain(api.selectGameIds('/lerp/', { storage: session, random: () => 0.99 })), ['craftmine', 'smear', 'inkride']);
});

test('posters are lazy and up to three muted previews start only when visible', () => {
    assert.match(js, /image\.loading = 'lazy'/);
    assert.match(js, /function activate\(card\)/);
    assert.match(js, /video\.setAttribute\('src', game\.preview\)/);
    assert.match(js, /video\.setAttribute\('autoplay', ''\)/);
    assert.match(js, /var MAX_PREVIEWS = 3/);
    assert.match(js, /function releasePreview\(card\)/);
    assert.match(js, /function updateLightweightMode\(\)/);
    assert.match(js, /data-tront-discovery-game-surface/);
    assert.match(js, /visibilitychange/);
    assert.doesNotMatch(js, /data-tront-discovery-status|Previewing CraftMine|Loading .* preview/i);
    assert.doesNotMatch(js, /className = 'tront-discovery__preview'/);
    assert.doesNotMatch(js, /archivalNote|archivalDetails|Earlier build|V16 footage/i);
    assert.doesNotMatch(js, /<video[^>]+\bsrc\s*=/i);
    assert.doesNotMatch(css, /tront-discovery__preview|archive-note|archive-details/i);
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /--td-purple:[\s\S]*--td-teal:[\s\S]*--td-red:[\s\S]*--td-green:/);
    assert.match(css, /data-tront-discovery-game="smear"\]\s*\{\s*--td-card-accent: var\(--td-red\)/);
    assert.match(css, /data-tront-discovery-game="craftmine"\]\s*\{\s*--td-card-accent: var\(--td-green\)/);
    assert.match(css, /\.tront-discovery__image-link:focus-visible/);
    assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
    assert.match(css, /\.tront-discovery--lightweight[\s\S]*\.tront-discovery__description \{ display: none; \}/);
    assert.match(css, /\.tront-discovery__grid[\s\S]*@media \(max-width: 520px\)/);
    assert.match(js, /prefers-reduced-motion: reduce/);
    assert.match(js, /connection\.saveData/);
});

test('SMEAR uses its poster until current preview footage is available', () => {
    const smear = loadApi().catalog.find(game => game.id === 'smear');
    assert.equal(smear.description, 'Grab dummies, break things and drag the mess around.');
    assert.equal(smear.preview, null);
    assert.match(smear.poster, /^\/games\/media\/smear-2026\.webp\?v=/);
});

test('CraftMine copy avoids stale counts and claims about its origin', () => {
    const craftmine = loadApi().catalog.find(game => game.id === 'craftmine');
    assert.equal(craftmine.description, 'Build, dig, and blow holes in a voxel world, solo or with friends.');
    assert.doesNotMatch(craftmine.description, /AI-generated|\b\d+\s+(?:blocks|mobs|weapons)\b/i);
});
