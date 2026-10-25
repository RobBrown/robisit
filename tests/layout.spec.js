// PRD 11 Design; PRD 3.6, 5.2, 6.2, 6.3. Runs on Desktop Chrome and iPhone SE (WebKit).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, CARDED_URL, paths, deckChannels, settle } = require('./helpers');

async function selectPath(page, id) {
  await page.goto(id ? `${CARDED_URL}?path=${id}` : CARDED_URL);
}

test('at 375px no card has internal overflow, in every path', async ({ page }, info) => {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 375, height: 667 });
  for (const p of paths) {
    await selectPath(page, p.id);
    const cards = await page.locator('.ic-card').evaluateAll((els) => els.map((el) => ({
      label: el.getAttribute('aria-label'),
      scroll: el.scrollHeight, client: el.clientHeight, height: el.getBoundingClientRect().height,
      children: [...el.querySelectorAll('*')].every((c) => c.scrollHeight <= c.clientHeight || getComputedStyle(c).overflow === 'visible'),
      contentBottom: Math.max(...[...el.children].map((c) => c.getBoundingClientRect().bottom)) - el.getBoundingClientRect().top,
    })));
    for (const c of cards) {
      expect(c.scroll, `${p.id || 'default'} ${c.label}`).toBeLessThanOrEqual(c.client);
      expect(c.children).toBe(true);
      // A whole card fits on one screen (PRD 3.6).
      expect(c.height).toBeLessThanOrEqual(page.viewportSize().height);
      expect(c.contentBottom, `${p.id || 'default'} ${c.label} content inside card`).toBeLessThanOrEqual(c.height);
    }
  }
});

test('cards are uniform in height within the deck', async ({ page }) => {
  await page.goto(CARDED_URL);
  const hs = await page.locator('.ic-card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(new Set(hs).size).toBe(1);
});

// The whole current card is on the first screen at common sizes.
for (const vp of [{ width: 375, height: 667 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
  test(`the first card is wholly on the first screen at ${vp.width}x${vp.height}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium');
    await page.setViewportSize(vp);
    await page.goto(CARDED_URL);
    await page.evaluate(() => document.fonts.ready);
    const r = await page.locator('.ic-card').first().boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(vp.height);
  });
}

for (const width of [375, 414, 768, 1280]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: width < 700 ? 740 : 900 } });

    test('next card edge is visible, and there is no horizontal page scroll', async ({ page }) => {
      await page.goto(CARDED_URL);
      for (const i of [0, 3]) {
        await page.goto(`${CARDED_URL}?card=${i}`.replace('?card=0', ''));
        const v = await page.evaluate((idx) => {
          const rail = document.querySelector('.ic-rail');
          const rr = rail.getBoundingClientRect();
          const right = Math.min(rr.right, window.innerWidth);
          const next = rail.children[idx + 1].getBoundingClientRect();
          return { visible: right - next.left, width: next.width };
        }, i);
        expect(v.visible, `card ${i}: px of next card visible`).toBeGreaterThanOrEqual(8);
        expect(v.visible, 'the current card stays the widest thing on screen').toBeLessThan(v.width * 0.6);
      }
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      expect(sw[0]).toBeLessThanOrEqual(sw[1]);
      // After jumping into the article too.
      await page.goto(`${CARDED_URL}?card=6`);
      await page.locator('.ic-go').click();
      const sw2 = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      expect(sw2[0]).toBeLessThanOrEqual(sw2[1]);
    });

    test('cards are capped at 520px tall at this width (PRD 6.3)', async ({ page }) => {
      await page.goto(CARDED_URL);
      await page.evaluate(() => document.fonts.ready);
      const h = await page.locator('.ic-card').first().evaluate((el) => el.getBoundingClientRect().height);
      expect(h).toBeLessThanOrEqual(520);
    });

    // PRD 5.2 says ~86%, capped at 560px; owner direction is smaller cards.
    test('card is roughly 80% of the available width, capped at 400px', async ({ page }) => {
      await page.goto(CARDED_URL);
      const w = await page.locator('.ic-card').first().evaluate((el) => el.getBoundingClientRect().width);
      expect(w).toBeLessThanOrEqual(400);
      if (width < 500) expect(Math.abs(w / width - 0.80)).toBeLessThan(0.02);
    });
  });
}

const PROPS = ['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'box-shadow', 'text-shadow', 'text-decoration-color'];

// A colour is in the deck's palette when its channels are a site colour (any
// alpha), or it is a black shadow, or it is fully transparent.
function inPalette(c, channels) {
  const m = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(c);
  if (!m) return false;
  if (m[4] !== undefined && Number(m[4]) === 0) return true;
  return channels.has(`${m[1]}, ${m[2]}, ${m[3]}`) || (m[1] === '0' && m[2] === '0' && m[3] === '0' && m[4] !== undefined);
}

for (const scheme of ['light', 'dark']) {
  test(`${scheme} scheme: every colour on the deck is from the site's palette`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`${CARDED_URL}?path=pilot&card=1`);
    await page.locator('#ic-deck').hover();
    const channels = deckChannels();
    const used = await page.evaluate((props) => {
      const out = new Set();
      const els = document.querySelectorAll('#ic-deck, #ic-deck *, #ic-head, #ic-head *, #ic-open, #ic-published, #ic-published *');
      for (const el of els) {
        for (const pseudo of [null, '::before', '::after']) {
          const cs = getComputedStyle(el, pseudo);
          for (const p of props) for (const m of cs.getPropertyValue(p).matchAll(/rgba?\([^)]*\)/g)) out.add(m[0]);
        }
      }
      return [...out];
    }, PROPS);
    expect(used.filter((c) => !inPalette(c, channels))).toEqual([]);
  });
}

test('deck CSS contains no colour literals outside the site palette, and no web fonts of its own', async () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/insight-cards.css'), 'utf8');
  const channels = deckChannels();
  const hexes = [...css.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)].map((m) => {
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4), 16)})`;
  });
  expect(hexes.filter((c) => !inPalette(c, channels))).toEqual([]);
  const fns = [...css.matchAll(/(?:rgba?|hsla?)\([^)]*\)/g)].map((m) => m[0].replace(/\s/g, '').replace(/,/g, ', ').replace(/, 0?\./, ', 0.'));
  expect(fns.filter((c) => !inPalette(c, channels)), 'rgba() only over site colours or black').toEqual([]);
  expect(css).not.toMatch(/@import|@font-face|fonts\.googleapis/);
  const fams = [...css.matchAll(/font-family:\s*([^;}]+)/g)].map((m) => m[1]);
  for (const f of fams) expect(f).toMatch(/var\(--ic-(serif|sans|mono)\)/);
});

test('every animation and transition is off under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${CARDED_URL}?path=pilot&card=1`);
  await page.locator('.ic-opt').first().hover();
  const moving = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('#ic-deck, #ic-deck *, #ic-head, #ic-open')) {
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo);
        if (cs.animationName !== 'none' || cs.transitionDuration.split(',').some((d) => parseFloat(d) > 0)) out.push(`${el.className}${pseudo || ''}`);
      }
    }
    return out;
  });
  expect(moving).toEqual([]);
});

test('with motion allowed, only the current card flickers, at most one dip a second', async ({ page }) => {
  await page.goto(`${CARDED_URL}?path=pilot&card=1`);
  const anims = await page.locator('.ic-card').evaluateAll((els) => els.map((e) => [e.classList.contains('is-current'), getComputedStyle(e, '::before').animationName]));
  for (const [current, name] of anims) expect(name).toBe(current ? 'ic-bezel-flicker' : 'none');
  // Each dip in the keyframes is a separate drop below full brightness; the cycle must allow no more than one per second.
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/insight-cards.css'), 'utf8');
  const secs = parseFloat(/ic-bezel-flicker\s+([\d.]+)s/.exec(css)[1]);
  const frames = /@keyframes ic-bezel-flicker\{([\s\S]*?)\n\}/.exec(css)[1];
  const dips = [...frames.matchAll(/([\d.]+)%\{opacity:([\d.]+)\}/g)].map((m) => [parseFloat(m[1]), parseFloat(m[2])]).sort((a, b) => a[0] - b[0]);
  let n = 0, low = false;
  for (const [, o] of dips) { if (o < 1 && !low) n++; low = o < 1; }
  expect(n / secs).toBeLessThanOrEqual(1);
});
