// The TL;DR / Full article view switch (owner brief, 2026-10-25).
const { test, expect } = require('@playwright/test');
const { CARDED_URL, settle, currentIndex, captureEvents } = require('./helpers');

const tldr = (page) => page.getByRole('tab', { name: /^TL;DR/ });
const full = (page) => page.getByRole('tab', { name: 'Full article' });
const hash = (page) => new URL(page.url()).hash;

// Exactly one view is on the page, and the other is out of the accessibility tree.
async function showing(page, view) {
  const [on, off] = view === 'tldr' ? ['#ic-deck', '#ic-article'] : ['#ic-article', '#ic-deck'];
  await expect(page.locator(on)).toBeVisible();
  await expect(page.locator(off)).toBeHidden();
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await expect((view === 'tldr' ? tldr : full)(page)).toHaveAttribute('aria-selected', 'true');
  await expect((view === 'tldr' ? full : tldr)(page)).toHaveAttribute('aria-selected', 'false');
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
});

test('the heading is a two-tab switch; TL;DR is the default view', async ({ page }) => {
  await page.goto(CARDED_URL);
  await expect(page.locator('#ic-switch')).toHaveAttribute('role', 'tablist');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab')).toHaveText(['TL;DR', 'Full article']);
  await showing(page, 'tldr');
  await expect(page.getByRole('tabpanel', { name: /^TL;DR/ })).toHaveAttribute('id', 'ic-deck');
  expect(hash(page)).toBe('#tldr');
});

// Owner direction (2026-10-25): switching never repositions the page.
test('Full article shows the article in place and focuses it; the page does not move', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto(CARDED_URL);
  await page.evaluate(() => window.scrollTo(0, 100));
  await full(page).click();
  await showing(page, 'article');
  await expect(page.getByRole('tabpanel', { name: 'Full article' })).toHaveAttribute('id', 'ic-article');
  await expect(page.locator('#ic-article')).toBeFocused();
  await page.waitForTimeout(700); // past the transition
  expect(await page.evaluate(() => window.scrollY)).toBe(100);
  expect(hash(page)).toBe('#article');
});

test('switching back to TL;DR keeps the page still and the deck in its place', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto(`${CARDED_URL}?card=3`);
  await full(page).click();
  await showing(page, 'article');
  await page.evaluate(() => window.scrollTo(0, 100));
  await tldr(page).click();
  await showing(page, 'tldr');
  await expect(page.locator('#ic-deck')).toBeFocused();
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.scrollY)).toBe(100);
  await settle(page);
  expect(await currentIndex(page)).toBe(3); // the deck keeps its place
  expect(hash(page)).toBe('#tldr');
});

test('#article opens the full article directly', async ({ page }) => {
  await page.goto(`${CARDED_URL}#article`);
  await showing(page, 'article');
});

test('back and forward move between views, one entry per switch', async ({ page }) => {
  await page.goto(CARDED_URL);
  const start = await page.evaluate(() => history.length);
  await full(page).click();
  await showing(page, 'article');
  await full(page).click(); // already selected: no new entry
  await page.locator('#ic-tab-tldr').click();
  await showing(page, 'tldr');
  expect(await page.evaluate(() => history.length)).toBe(start + 2);
  await page.goBack();
  await showing(page, 'article');
  expect(hash(page)).toBe('#article');
  await page.goBack();
  await showing(page, 'tldr');
  await page.goForward();
  await showing(page, 'article');
});

test('deck navigation does not add history entries', async ({ page }) => {
  await page.goto(CARDED_URL);
  const start = await page.evaluate(() => history.length);
  await page.locator('.ic-rail').focus();
  await page.keyboard.press('ArrowRight');
  await settle(page);
  expect(await page.evaluate(() => history.length)).toBe(start);
  expect(hash(page)).toBe('#tldr');
});

test('arrow keys, Home and End move between the tabs and switch the view', async ({ page }) => {
  await page.goto(CARDED_URL);
  await tldr(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(full(page)).toBeFocused();
  await showing(page, 'article');
  await page.keyboard.press('Home');
  await expect(tldr(page)).toBeFocused();
  await showing(page, 'tldr');
  expect(await currentIndex(page)).toBe(0); // the arrow moved the tab, not the deck
  await page.keyboard.press('End');
  await showing(page, 'article');
  // Only the selected tab is in the Tab order.
  await expect(full(page)).toHaveAttribute('tabindex', '0');
  await expect(tldr(page)).toHaveAttribute('tabindex', '-1');
});

test('switching to the article via the tabs is recorded as a handoff, once', async ({ page }) => {
  await captureEvents(page);
  await page.goto(`${CARDED_URL}?card=2`);
  await full(page).click();
  await showing(page, 'article');
  await tldr(page).click();
  await showing(page, 'tldr');
  await page.locator('.ic-go').evaluate((b) => b.click());
  const h = (await page.evaluate(() => window.__events)).filter((e) => e.name === 'cards_handoff');
  expect(h.map((e) => e.props)).toEqual([{ route: 'switch', card: 2, path: 'default', anchor: '#ic-article' }]);
});

test('with motion allowed, the old view powers off and the new one powers on', async ({ page }) => {
  await page.goto(CARDED_URL);
  const seen = await page.evaluate(() => new Promise((res) => {
    const out = [];
    document.getElementById('ic-tab-article').click();
    (function tick() {
      for (const id of ['ic-deck', 'ic-article']) {
        const el = document.getElementById(id);
        if (el.getAnimations().length && !out.includes(id)) out.push(id);
      }
      if (out.length === 2 || performance.now() > 5000) return res(out);
      requestAnimationFrame(tick);
    })();
  }));
  expect(seen).toEqual(['ic-deck', 'ic-article']);
  await showing(page, 'article');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('the switch is instant', async ({ page }) => {
    await page.goto(CARDED_URL);
    const state = await page.evaluate(() => {
      document.getElementById('ic-tab-article').click();
      const a = document.getElementById('ic-article');
      return { shown: !a.hidden, deck: document.getElementById('ic-deck').hidden, anims: a.getAnimations().length };
    });
    expect(state).toEqual({ shown: true, deck: true, anims: 0 });
  });
});

test('a quick second switch mid-transition ends on the second view', async ({ page }) => {
  await page.goto(CARDED_URL);
  await page.evaluate(() => {
    document.getElementById('ic-tab-article').click();
    setTimeout(() => document.getElementById('ic-tab-tldr').click(), 100);
  });
  await page.waitForTimeout(900);
  await showing(page, 'tldr');
  await expect(page.locator('#ic-deck')).toHaveCSS('opacity', '1');
  expect(hash(page)).toBe('#tldr');
});

test('posts without cards have no switch', async ({ page }) => {
  await page.goto('/thoughts/vendor-no-longer-gets-last-word/');
  await expect(page.locator('#ic-switch, [role="tablist"]')).toHaveCount(0);
  expect(hash(page)).toBe('');
});
