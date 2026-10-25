// PRD 7, through the trackEvent adapter boundary.
const { test, expect } = require('@playwright/test');
const { CARDED_URL, cards, N, settle, captureEvents } = require('./helpers');

const events = (page) => page.evaluate(() => window.__events);

test.beforeEach(async ({ page }) => { await captureEvents(page); });

test('cards_path fires with path on option select; cards_reached fires on insight landing', async ({ page }) => {
  await page.goto(CARDED_URL);
  const opt = cards.situation.options[2];
  await page.getByRole('radio', { name: opt.label }).click();
  await settle(page);
  const ev = await events(page);
  expect(ev[0]).toEqual({ name: 'cards_path', props: { path: opt.id } });
  expect(ev).toContainEqual({ name: 'cards_reached', props: { card: 1, path: opt.id } });
});

test('cards_reached reports the default path when no situation is chosen', async ({ page }) => {
  await page.goto(CARDED_URL);
  await page.locator('.ic-rail').focus();
  await page.keyboard.press('ArrowRight'); await settle(page);
  await page.keyboard.press('ArrowRight'); await settle(page);
  const reached = (await events(page)).filter((e) => e.name === 'cards_reached');
  expect(reached.map((e) => e.props)).toEqual([{ card: 1, path: 'default' }, { card: 2, path: 'default' }]);
});

test('cards_handoff via terminal carries route, card, path and the article anchor', async ({ page }) => {
  await page.goto(`${CARDED_URL}?path=pilot&card=${N}`);
  await page.locator('.ic-go').click();
  const h = (await events(page)).find((e) => e.name === 'cards_handoff');
  expect(h.props).toEqual({ route: 'terminal', card: N, path: 'pilot', anchor: '#ic-article' });
});

test('cards_handoff fires once per page view', async ({ page }) => {
  await page.goto(`${CARDED_URL}?card=${N}`);
  await page.locator('.ic-go').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.ic-go').click();
  expect((await events(page)).filter((e) => e.name === 'cards_handoff')).toHaveLength(1);
});

test('cards_handoff via the button under the deck has route button and the article anchor', async ({ page }) => {
  await page.goto(`${CARDED_URL}?path=pilot&card=2`);
  await page.locator('#ic-open').click();
  await page.locator('.ic-go').evaluate((b) => b.click());
  const h = (await events(page)).filter((e) => e.name === 'cards_handoff');
  expect(h.map((e) => e.props)).toEqual([{ route: 'button', card: 2, path: 'pilot', anchor: '#ic-article' }]);
});

// Depth counts only while the article is open. route is the control that
// first opened it.
test('cards_depth fires nothing while collapsed, then 25/50/75/100 once each with the opening route', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(CARDED_URL);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(150);
  expect((await events(page)).filter((e) => e.name === 'cards_depth')).toEqual([]);
  await page.locator('#ic-open').click();
  for (const f of [0.3, 0.55, 0.8, 1.2, 0.1, 1.2]) {
    await page.evaluate((f) => {
      const a = document.querySelector('#ic-article');
      const top = a.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + a.offsetHeight * f - window.innerHeight);
    }, f);
    await page.waitForTimeout(150);
  }
  const depth = (await events(page)).filter((e) => e.name === 'cards_depth').map((e) => e.props);
  expect(depth).toEqual([25, 50, 75, 100].map((d) => ({ depth: d, route: 'button' })));
});

test('default adapter logs to the console', async ({ browser }) => {
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  await page.goto(CARDED_URL);
  await page.getByRole('radio').first().click();
  await expect.poll(() => logs.some((l) => l.startsWith('[insight-cards] cards_path'))).toBe(true);
  await page.close();
});
