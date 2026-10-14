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

test('catalog contains the two fixed picks and only the three approved random choices', () => {
    const api = loadApi();
    const catalog = JSON.parse(JSON.stringify(api.catalog));
    assert.deepEqual(catalog.filter(game => game.kind === 'Featured game' || game.kind === 'Featured prototype').map(game => game.id), ['craftmine', 'smear']);
    assert.deepEqual(catalog.filter(game => game.kind === 'Quick pick').map(game => game.id), ['inkride', 'tinytreads', 'tinyrise']);
    assert.equal(new Set(catalog.map(game => game.id)).size, catalog.length);
    assert.deepEqual(catalog.filter(game => game.kind === 'Quick pick').map(game => game.href), ['/inkride/', '/tinytreads/', '/tinyrise/']);
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

test('the random additional choice is stable for a session and never duplicates the current game', () => {
    const api = loadApi();
    const session = storage();
    const first = api.selectGameIds('/smear/', { storage: session, random: () => 0.01 });
    const second = api.selectGameIds('/smear/', { storage: session, random: () => 0.99 });
    assert.deepEqual(plain(first), ['craftmine', 'inkride']);
    assert.deepEqual(plain(second), plain(first));
    assert.equal(session.values.get('tront-about-discovery-session-v1'), 'inkride');
    assert.equal(new Set(first).size, first.length);
});

test('a current game matching the saved random pick gets a stable eligible fallback without replacing the session pick', () => {
    const api = loadApi();
    const session = storage({ 'tront-about-discovery-session-v1': 'inkride' });
    assert.deepEqual(plain(api.selectGameIds('/ink-ride/', { storage: session, random: () => 0.99 })), ['craftmine', 'smear', 'tinytreads']);
    assert.equal(session.values.get('tront-about-discovery-session-v1'), 'inkride');
    assert.deepEqual(plain(api.selectGameIds('/lerp/', { storage: session, random: () => 0.99 })), ['craftmine', 'smear', 'inkride']);
});

test('posters are lazy, video source assignment is interaction-only, and reduced-motion styling stays scoped', () => {
    assert.match(js, /image\.loading = 'lazy'/);
    assert.match(js, /function activate\(card\)/);
    assert.match(js, /video\.setAttribute\('src', game\.preview\)/);
    assert.doesNotMatch(js, /<video[^>]+\bsrc\s*=/i);
    assert.match(js, /function disclosureChain\(host\)/);
    assert.match(js, /function disclosuresAreOpen\(chain\)/);
    assert.doesNotMatch(js, /doc\.addEventListener\(['"](?:keydown|pointerdown)['"]/);
    assert.match(js, /prefers-reduced-motion: reduce/);
    assert.match(js, /connection\.saveData/);
    assert.match(css, /\.tront-discovery__grid[\s\S]*@media \(max-width: 520px\)/);
    assert.match(css, /--td-red:[\s\S]*--td-green:/);
});

test('SMEAR preview is explicitly identified as archival footage from V16', () => {
    const api = loadApi();
    const smear = api.catalog.find(game => game.id === 'smear');
    assert.match(smear.archivalNote, /Archival V16 footage, sped up/);
    assert.match(smear.archivalNote, /current source is V47\.1/i);
    assert.match(smear.preview, /smear-2026\.mp4\?v=687dcd477595/);
});
