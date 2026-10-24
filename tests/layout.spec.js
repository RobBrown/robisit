// PRD 11 Design; PRD 3.6, 5.2, 6.2, 6.3. Runs on Desktop Chrome and iPhone SE (WebKit).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, CARDED_URL, paths, siteColours, settle } = require('./helpers');

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
      expect(c.height).toBeLessThanOrEqual(520); // PRD 6.3 cap
      expect(c.contentBottom, `${p.id || 'default'} ${c.label} content inside card`).toBeLessThanOrEqual(c.height);
    }
  }
});

test('cards are uniform in height within the deck', async ({ page }) => {
  await page.goto(CARDED_URL);
  const hs = await page.locator('.ic-card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(new Set(hs).size).toBe(1);
});

// At 375x667 the deck alone needs more than the first screen (masthead ~255px
// plus a ~500px card), so the reveal link sits just below the fold there. On
// common modern phone and laptop screens it is on the first screen.
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`the reveal link is on the first screen at ${vp.width}x${vp.height}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium');
    await page.setViewportSize(vp);
    await page.goto(CARDED_URL);
    await page.evaluate(() => document.fonts.ready);
    const r = await page.locator('#ic-expand button').boundingBox();
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
        expect(v.visible).toBeLessThan(v.width / 2);
      }
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      expect(sw[0]).toBeLessThanOrEqual(sw[1]);
      // Revealed article too.
      await page.getByRole('button', { name: 'Read the full article' }).click();
      const sw2 = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      expect(sw2[0]).toBeLessThanOrEqual(sw2[1]);
    });

    test('card is roughly 86% of the available width, capped at 560px', async ({ page }) => {
      await page.goto(CARDED_URL);
      const w = await page.locator('.ic-card').first().evaluate((el) => el.getBoundingClientRect().width);
      expect(w).toBeLessThanOrEqual(560);
      if (width < 640) expect(Math.abs(w / width - 0.86)).toBeLessThan(0.02);
    });
  });
}

const PROPS = ['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'box-shadow', 'text-decoration-color'];

for (const scheme of ['light', 'dark']) {
  test(`${scheme} scheme: every colour on the deck is from the site's token set`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`${CARDED_URL}?path=pilot&card=1`);
    await page.locator('#ic-deck').hover();
    const allowed = siteColours();
    const used = await page.evaluate((props) => {
      const out = new Set();
      const els = document.querySelectorAll('.ic-masthead, .ic-masthead *, #ic-deck, #ic-deck *, #ic-expand, #ic-expand *');
      for (const el of els) {
        const cs = getComputedStyle(el);
        for (const p of props) {
          const v = cs.getPropertyValue(p);
          for (const m of v.matchAll(/rgba?\([^)]*\)/g)) out.add(m[0]);
        }
      }
      return [...out];
    }, PROPS);
    const bad = used.filter((c) => !allowed.has(c) && !/rgba\(\d+, \d+, \d+, 0\)/.test(c));
    expect(bad).toEqual([]);
  });
}

test('deck CSS contains no colour literals outside the site token set, and no web fonts of its own', async () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/insight-cards.css'), 'utf8');
  const allowed = siteColours();
  const toRgb = (h) => { if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4), 16)})`; };
  const hexes = [...css.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)].map((m) => m[1]);
  expect(hexes.filter((h) => !allowed.has(toRgb(h.toLowerCase())))).toEqual([]);
  expect(css).not.toMatch(/rgba?\(|hsla?\(|@import|@font-face|fonts\.googleapis/);
  const fams = [...css.matchAll(/font-family:\s*([^;}]+)/g)].map((m) => m[1]);
  for (const f of fams) expect(f).toMatch(/var\(--ic-(serif|sans)\)/);
});
