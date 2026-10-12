// Capture the current gallery posters and version the social image by content.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/trontstack/tmp/card-refresh/tools/node_modules/playwright');
const {createServer, root} = require('./server.cjs');

(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({channel: 'chrome', headless: true});
    const context = await browser.newContext({viewport: {width: 1200, height: 630}, deviceScaleFactor: 1, reducedMotion: 'reduce'});
    await context.route('**/*', route => {
      const host = new URL(route.request().url()).hostname;
      if (['127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(host)) return route.continue();
      return route.fulfill({status: 200, contentType: 'application/json', body: '{}'});
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/games/`, {waitUntil: 'load'});
    // Compact only the capture, keeping the actual gallery's content and ordering.
    await page.addStyleTag({content: `
      html { font-size: 14px; }
      body { padding-top: 62px; }
      .main-container { max-width: none; width: 100%; padding: 0 24px; }
      .main-header { padding: 6px 16px; margin-bottom: 6px; }
      .main-header img.logo { width: 48px; height: 48px; margin-bottom: 8px; }
      .main-header h1 { font-size: 34px; margin-bottom: 6px; }
      .main-header p { font-size: 14px; line-height: 1.5; max-width: 105ch; }
      .filter-nav { padding-bottom: 18px; }
      .preview-controls, #discord-section { display: none !important; }
      .grid { grid-template-columns: repeat(4, 1fr); gap: 12px; }
      .grid .item:nth-child(n+5) { display: none !important; }
      .card-content { padding: 12px; }
      .card-title { font-size: 15px; }
      .blurb { font-size: 12px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; flex-grow: 0; }
      *, *::before, *::after { animation: none !important; transition: none !important; }
    `});
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].filter(image => image.getBoundingClientRect().width > 0).map(async image => {
        image.loading = 'eager';
        await image.decode();
      }));
    });
    const cards = page.locator('.grid .item:visible');
    assert.equal(await cards.count(), 4);
    const titles = await cards.locator('.card-title').allTextContents();
    assert.ok(titles[0].startsWith('Project Demigod'), 'Demigod must remain first');
    fs.mkdirSync(path.join(root, '.local'), {recursive: true});
    await page.screenshot({path: path.join(root, '.local/games-og-review.png'), animations: 'disabled'});
    for (const card of await cards.all()) {
      const box = await card.boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= 630, `The entire first row must fit in the image: ${JSON.stringify(box)}`);
    }
    const png = await page.screenshot({animations: 'disabled'});
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    const hash = crypto.createHash('sha256').update(png).digest('hex').slice(0, 12);
    const filename = `og-image-${hash}.png`;
    const url = `https://tront.xyz/games/${filename}`;
    const index = path.join(root, 'games/index.html');
    let html = fs.readFileSync(index, 'utf8');
    for (const [attribute, name] of [['property', 'og:image'], ['name', 'twitter:image']]) {
      const pattern = new RegExp(`<meta ${attribute}="${name}" content="[^"]*">`, 'g');
      assert.equal([...html.matchAll(pattern)].length, 1, `Expected one ${name} tag`);
      html = html.replace(pattern, `<meta ${attribute}="${name}" content="${url}">`);
    }
    // Keep the original URL useful for existing external references too.
    fs.writeFileSync(path.join(root, 'games/og-image.png'), png);
    fs.writeFileSync(path.join(root, 'games', filename), png);
    fs.writeFileSync(index, html);
    console.log(JSON.stringify({image: url, width: 1200, height: 630, bytes: png.length, titles}, null, 2));
    console.log('COMPLETE games social image refreshed');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
