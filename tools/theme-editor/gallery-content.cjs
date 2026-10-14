/* Frozen pre-theme copy plus explicitly reviewed year additions. No runtime mutation. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const baseline = require('./gallery-content-baseline.json');
const craftmine2 = require('../game-media/craftmine2-card.cjs');
const released = require('./gallery-released-20261014.json');
const recovered = require('./gallery-recovered-20261014.json');
const approvedYearCorrections = baseline.approvedYearCorrections;
const historicalCardsByHref = new Map(baseline.cards.map(card => [card.href, card]));
for (const [href, correction] of Object.entries(approvedYearCorrections)) {
    const original = historicalCardsByHref.get(href);
    assert.ok(original && baseline.knownMissingYearHrefs.includes(href), 'year corrections only target documented historical omissions');
    assert.equal(baseline.cards.filter(card => card.href === href).length, 1, 'each approved correction URL identifies exactly one card');
    assert.equal(original.yearSpans.length, 0, 'year corrections never replace an existing project year');
    assert.match(String(correction.year), /^\d{4}$/, 'every correction has a reviewed four-digit year');
    assert.ok(correction.basis, 'every correction records independent project-history verification');
}
const expectedCards = baseline.cards.map(original => {
    const card = JSON.parse(JSON.stringify(original)), correction = approvedYearCorrections[card.href];
    if (correction) {
        const year = `(${correction.year})`;
        card.titleHtml += ` <span>${year}</span>`;
        card.titleText += ` ${year}`;
        card.yearSpans = [year];
    }
    return card;
});
expectedCards.splice(1, 0, ...released.cards.map(card => readCards(card.markup)[0]));
expectedCards.splice(1 + released.cards.length, 0, ...recovered.cards.map(card => readCards(card.markup)[0]));
expectedCards.splice(1, 0, craftmine2.expectedCard); // Demigod stays first; every historical card retains its relative position.
const currentMissingYearHrefs = expectedCards.filter(card => !card.yearSpans.length).map(card => card.href);
function normalizeReleasedForPreservation(html) {
    // These exact cards already exist on master. Remove them only for the
    // 117-card historical browser comparison; raw candidate checks retain all four.
    for (const entry of [...released.cards, ...recovered.cards]) {
        const cards = [...html.matchAll(/<a\b[^>]*class="item\b[^>]*>[\s\S]*?<\/a>/g)].map(match => match[0]);
        const matches = cards.filter(card => card.includes('href="'+entry.href+'"'));
        assert.ok(matches.length <= 1, 'each already-published card remains unique');
        if (!matches.length) continue;
        assert.equal(matches[0], entry.markup, 'already-published card markup stays exact');
        html = html.replace('            '+entry.markup+'\r\n', '').replace('            '+entry.markup+'\n', '').replace(entry.markup, '');
    }
    return html;
}
function normalizeYearsForPreservation(html) {
    // Only these exact URL-keyed title additions are accepted. Every other
    // byte, including wrong years and edits to neighboring copy, survives
    // normalization and therefore still fails a strict baseline comparison.
    return html.replace(/<a\b([^>]*\bclass="item\b[^>]*)>([\s\S]*?)<\/a>/g, (markup, attrs) => {
        const href = attrs.match(/\bhref="([^"]*)"/)?.[1], correction = approvedYearCorrections[href];
        if (!correction) return markup;
        const original = historicalCardsByHref.get(href).titleHtml;
        return markup.replace(`<h3 class="card-title">${original} <span>(${correction.year})</span></h3>`,
            `<h3 class="card-title">${original}</h3>`);
    });
}
function readCards(html) {
    const cards = [...html.matchAll(/<a\b([^>]*\bclass="item\b[^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, body]) => {
        const match = pattern => { const found = body.match(pattern); assert.ok(found, 'each card keeps its complete heading, blurb and tags'); return found[1]; };
        const titleHtml = match(/<h3 class="card-title">([\s\S]*?)<\/h3>/);
        const blurbHtml = match(/<p class="blurb">([\s\S]*?)<\/p>/);
        const tagsHtml = match(/<div class="tags">([\s\S]*?)<\/div>/);
        // Current card copy has no entities. Fail explicitly if that changes
        // rather than pretending a source string is decoded browser text.
        const text = markup => { assert.ok(!/&(?:#\w+|\w+);/.test(markup), 'review entity decoding when adding encoded card copy'); return markup.replace(/<[^>]*>/g, ''); };
        return { href: attrs.match(/href="([^"]*)"/)[1], classes: attrs.match(/class="([^"]*)"/)[1].split(/\s+/),
            titleHtml, titleText: text(titleHtml), yearSpans: [...titleHtml.matchAll(/<span[^>]*>(.*?)<\/span>/g)].map(match => match[1]),
            blurbHtml, blurbText: text(blurbHtml), tagsHtml, tags: [...tagsHtml.matchAll(/<span class="tag">(.*?)<\/span>/g)].map(match => text(match[1])) };
    });
    assert.equal(cards.length, (html.match(/<h3 class="card-title">/g) || []).length, 'the source parser covers every card heading');
    return cards;
}
function assertCards(cards) {
    assert.equal(cards.length, expectedCards.length, 'all historical and approved release cards are preserved');
    cards.forEach((card, i) => assert.deepEqual(card, expectedCards[i], `card ${i + 1}: full title, approved year, description, tags, categories and link are preserved`));
    assert.deepEqual(cards.filter(card => !card.yearSpans.length).map(card => card.href), currentMissingYearHrefs,
        'any year omission or repair must be reviewed explicitly');
}
function assertSource(html) { assertCards(readCards(html)); }
function assertHistoricalCards(cards) {
    assert.equal(cards.length, baseline.cards.length, 'all 117 historical cards remain present and preserved');
    cards.forEach((card, i) => assert.deepEqual(card, baseline.cards[i], `historical card ${i + 1}: full title, original year, description, tags, categories and link are preserved`));
    assert.deepEqual(cards.filter(card => !card.yearSpans.length).map(card => card.href), baseline.knownMissingYearHrefs,
        'the historical comparison retains exactly the original four year omissions');
}
async function assertRendered(page, { historical = false } = {}) {
    assert.equal(typeof historical, 'boolean', 'historical rendering checks must be explicitly selected');
    const result = await page.evaluate(() => {
        const failures = [], textColors = [];
        const cards = [...document.querySelectorAll('.grid .item')].map(card => {
            const title = card.querySelector('.card-title'), blurb = card.querySelector('.blurb'), tags = card.querySelector('.tags');
            const box = card.getBoundingClientRect();
            for (const element of card.querySelectorAll('.card-title, .card-title span, .blurb, .tags .tag')) {
                const text = element.textContent;
                for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
                    const style = getComputedStyle(node);
                    if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) {
                        failures.push({ title: title.textContent, text, reason: 'hidden text or ancestor' }); break;
                    }
                }
                const style = getComputedStyle(element), range = document.createRange();
                textColors.push({ card: title.textContent, text, color: style.color });
                range.selectNodeContents(element);
                const rects = [...range.getClientRects()];
                if (/^rgba\([^)]*,\s*0\)$/.test(style.color) || !rects.some(rect => rect.width > 0 && rect.height > 0))
                    failures.push({ title: title.textContent, text, reason: 'transparent or unrendered text' });
                if (rects.some(rect => rect.left < box.left - 1 || rect.right > box.right + 1 || rect.top < box.top - 1 || rect.bottom > box.bottom + 1))
                    failures.push({ title: title.textContent, text, reason: 'text extends beyond the clipping card' });
            }
            return { href: card.getAttribute('href'), classes: [...card.classList].filter(name => name !== 'preview-playing'),
                titleHtml: title.innerHTML, titleText: title.textContent, yearSpans: [...title.querySelectorAll('span')].map(span => span.innerHTML),
                blurbHtml: blurb.innerHTML, blurbText: blurb.textContent, tagsHtml: tags.innerHTML, tags: [...tags.querySelectorAll('.tag')].map(tag => tag.textContent) };
        });
        return { cards, failures, textColors };
    });
    if (historical) assertHistoricalCards(result.cards);
    else assertCards(result.cards);
    assert.deepEqual(result.failures, [], 'every title, year span, full blurb and category tag is rendered without hiding or card clipping');
    return { cards: result.cards.length, yearSpans: result.cards.reduce((count, card) => count + card.yearSpans.length, 0),
        contentMode: historical ? 'historical' : 'approved-current',
        knownMissingYearHrefs: historical ? baseline.knownMissingYearHrefs : currentMissingYearHrefs,
        historicalMissingYearHrefs: baseline.knownMissingYearHrefs,
        approvedYearCorrections: historical ? {} : approvedYearCorrections,
        exactContent: true, hiddenOrClipped: [], textColors: result.textColors };
}
if (require.main === module) {
    assertSource(fs.readFileSync(process.argv[2] || path.resolve(__dirname, '../../games/index.html'), 'utf8'));
    console.log('PASS: all historical cards, CraftMine 2, and reviewed release cards preserve their exact content and order.');
}
module.exports = { baseline, released, recovered, expectedCards, normalizeReleasedForPreservation, currentMissingYearHrefs, normalizeYearsForPreservation, readCards, assertCards, assertHistoricalCards, assertSource, assertRendered };
