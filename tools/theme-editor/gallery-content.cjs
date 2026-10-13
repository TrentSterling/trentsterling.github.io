/* Frozen pre-theme copy contract. No runtime mutation or inferred project dates. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const baseline = require('./gallery-content-baseline.json');
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
    assert.equal(cards.length, baseline.cards.length, 'all 117 cards remain present');
    cards.forEach((card, i) => assert.deepEqual(card, baseline.cards[i], `card ${i + 1}: full title, year, description, tags, categories and link are preserved`));
    assert.deepEqual(cards.filter(card => !card.yearSpans.length).map(card => card.href), baseline.knownMissingYearHrefs,
        'any year omission or repair must be reviewed explicitly');
}
function assertSource(html) { assertCards(readCards(html)); }
async function assertRendered(page) {
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
    assertCards(result.cards);
    assert.deepEqual(result.failures, [], 'every title, year span, full blurb and category tag is rendered without hiding or card clipping');
    return { cards: result.cards.length, yearSpans: result.cards.reduce((count, card) => count + card.yearSpans.length, 0),
        knownMissingYearHrefs: baseline.knownMissingYearHrefs, exactContent: true, hiddenOrClipped: [], textColors: result.textColors };
}
if (require.main === module) {
    assertSource(fs.readFileSync(process.argv[2] || path.resolve(__dirname, '../../games/index.html'), 'utf8'));
    console.log('PASS: exact full text, year spans, tags, categories, links and order of all 117 cards match the pre-theme snapshot.');
}
module.exports = { baseline, readCards, assertCards, assertSource, assertRendered };
