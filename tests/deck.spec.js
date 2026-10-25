// PRD 11 Deck; PRD 3.3-3.5, 5.2-5.7.
const { test, expect } = require('@playwright/test');
const { CARDED_URL, cards, insightById, defaultOrder, N, settle, currentIndex, atTopOrEnd } = require('./helpers');

const titlesInRail = (page) => page.locator('.ic-insight .ic-title').allTextContents();
const rail = (page) => page.locator('.ic-rail');
const scrollLeft = (page) => rail(page).evaluate((el) => el.scrollLeft);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test('situation card shows the question and the options, with no counter', async ({ page }) => {
  await page.goto(CARDED_URL);
  const s = page.locator('.ic-card').first();
  await expect(s).toHaveClass(/ic-situation/);
  await expect(s.locator('.ic-n')).toHaveCount(0); // owner direction: no "Start" label
  await expect(s.locator('.ic-title')).toHaveText(cards.situation.prompt);
  const radios = s.getByRole('radio');
  await expect(radios).toHaveText(cards.situation.options.map((o) => o.label));
  for (const r of await radios.all()) await expect(r).toHaveAttribute('aria-checked', 'false');
  await expect(s.getByRole('radiogroup')).toHaveCount(1);
});

for (const opt of cards.situation.options) {
  test(`selecting "${opt.id}" reorders insights, sets the anchor and advances to card 1`, async ({ page }) => {
    await page.goto(CARDED_URL);
    await page.getByRole('radio', { name: opt.label }).click();
    await settle(page);
    expect(await currentIndex(page)).toBe(1);
    expect(await titlesInRail(page)).toEqual(opt.order.map((id) => insightById[id].title));
    await expect(page.getByRole('radio', { name: opt.label })).toHaveAttribute('aria-checked', 'true');
    // Anchor: the terminal control jumps to this option's anchor.
    await page.locator('.ic-go').click();
    await expect(page.locator(opt.anchor)).toBeFocused();
    expect(new URL(page.url()).searchParams.get('path')).toBe(opt.id);
  });
}

test('swiping past the situation card uses the default order', async ({ page }) => {
  await page.goto(CARDED_URL);
  await rail(page).evaluate((el) => el.scrollBy({ left: el.clientWidth * 0.7, behavior: 'instant' }));
  await settle(page);
  expect(await currentIndex(page)).toBe(1);
  expect(await titlesInRail(page)).toEqual(defaultOrder.map((id) => insightById[id].title));
  expect(new URL(page.url()).searchParams.get('path')).toBeNull();
});

// Narration adds exactly one control to a narrated insight card: its
// read-aloud button. Nothing else.
test('insight cards show counter, title and body and nothing else', async ({ page }) => {
  await page.goto(CARDED_URL);
  const ins = page.locator('.ic-insight');
  await expect(ins).toHaveCount(cards.insights.length);
  for (let i = 0; i < cards.insights.length; i++) {
    const narrated = await ins.nth(i).evaluate((el) => el.hasAttribute('data-narration'));
    const kids = await ins.nth(i).evaluate((el) => [...el.children].map((c) => c.className));
    expect(kids).toEqual(narrated ? ['ic-n', 'ic-play', 'ic-title', 'ic-body'] : ['ic-n', 'ic-title', 'ic-body']);
    await expect(ins.nth(i).locator('a, button, input')).toHaveCount(narrated ? 1 : 0);
    if (narrated) await expect(ins.nth(i).locator('button')).toHaveClass('ic-play');
  }
});

test('terminal card shows counter, knows, resolves and one control', async ({ page }) => {
  await page.goto(CARDED_URL);
  const t = page.locator('.ic-card').last();
  await expect(t).toHaveClass(/ic-terminal/);
  const kids = await t.evaluate((el) => [...el.children].map((c) => c.className));
  expect(kids).toEqual(['ic-n', 'ic-knows', 'ic-resolves', 'ic-go']);
  await expect(t.locator('.ic-n')).toHaveText(`${N}/${N}`);
  await expect(t.locator('.ic-knows')).toHaveText(cards.terminal.knows);
  await expect(t.locator('.ic-resolves')).toHaveText(cards.terminal.resolves);
  await expect(t.getByRole('button')).toHaveText(['Read The Full Article']);
});

test('counter reads n/N at the top of each card, situation excluded from N', async ({ page }) => {
  await page.goto(CARDED_URL);
  const counters = await page.locator('.ic-card .ic-n').allTextContents();
  expect(counters).toEqual(Array.from({ length: N }, (_, i) => `${i + 1}/${N}`));
  const firstChild = await page.locator('.ic-insight, .ic-terminal').evaluateAll((els) => els.every((e) => e.firstElementChild.classList.contains('ic-n')));
  // Right-aligned: each counter ends near its card's right edge, level with the title.
  const geo = await page.locator('.ic-insight, .ic-terminal').evaluateAll((els) => els.map((c) => {
    const card = c.getBoundingClientRect(), n = c.querySelector('.ic-n').getBoundingClientRect();
    const title = c.querySelector('.ic-title, .ic-knows').getBoundingClientRect();
    return { gap: card.right - n.right, beside: n.top < title.bottom && n.bottom > title.top };
  }));
  for (const g of geo) { expect(g.gap).toBeLessThan(32); expect(g.beside).toBe(true); }
  expect(firstChild).toBe(true);
  // Counters stay positional after a reorder.
  await page.getByRole('radio').nth(2).click();
  await settle(page);
  expect(await page.locator('.ic-card .ic-n').allTextContents()).toEqual(counters);
  expect(await page.locator('.ic-card').nth(3).getAttribute('aria-label')).toBe(`3 of ${N}`);
});

test('arrow keys move one card; navigation stops at both ends', async ({ page }) => {
  await page.goto(CARDED_URL);
  await page.locator('.ic-rail').focus();
  await page.keyboard.press('ArrowLeft');
  await settle(page);
  expect(await currentIndex(page)).toBe(0);
  for (let i = 1; i <= N; i++) {
    await page.keyboard.press('ArrowRight');
    await settle(page);
    expect(await currentIndex(page)).toBe(i);
  }
  const end = await scrollLeft(page);
  await page.keyboard.press('ArrowRight');
  await settle(page);
  expect(await currentIndex(page)).toBe(N); // no wrap
  expect(await scrollLeft(page)).toBe(end);
  await page.keyboard.press('ArrowLeft');
  await settle(page);
  expect(await currentIndex(page)).toBe(N - 1);
});

test('arrow keys do nothing while the article is showing', async ({ page }) => {
  await page.goto(CARDED_URL);
  await page.locator('#ic-open').click();
  await expect(page.locator('#ic-deck')).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  await page.locator('#ic-tab-tldr').click();
  await expect(page.locator('#ic-deck')).toBeVisible();
  expect(await currentIndex(page)).toBe(0);
});

test('chevrons move one card and stop at the ends', async ({ page }) => {
  await page.goto(CARDED_URL);
  await page.locator('#ic-deck').hover();
  const next = page.locator('.ic-next');
  const prev = page.locator('.ic-prev');
  await expect(prev).toBeDisabled(); // and visibility:hidden, so out of the accessibility tree
  await next.click();
  await settle(page);
  expect(await currentIndex(page)).toBe(1);
  await prev.click();
  await settle(page);
  expect(await currentIndex(page)).toBe(0);
  await page.goto(`${CARDED_URL}?card=${N}`);
  await expect(next).toBeDisabled();
});

test.describe('pointer device', () => {
  test('hover chevrons are present, quiet until deck hover, visible on hover', async ({ page }) => {
    await page.goto(CARDED_URL);
    const next = page.locator('.ic-next');
    await expect(next).toHaveCSS('display', 'flex');
    await expect(next).toHaveCSS('opacity', '0');
    await page.locator('#ic-deck').hover();
    await expect(next).toHaveCSS('opacity', '1');
  });
});

test.describe('touch device', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 667 } });
  test('hover chevrons are hidden on touch devices', async ({ page }) => {
    await page.goto(CARDED_URL);
    await expect(page.locator('.ic-next')).toBeHidden();
    await expect(page.locator('.ic-prev')).toBeHidden();
  });
});

test('vertical scroll over the deck scrolls the page, not the deck', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto(CARDED_URL);
  const box = await rail(page).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 300);
  await page.waitForFunction(() => window.scrollY > 0);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await settle(page);
  expect(await scrollLeft(page)).toBe(0);
});

test('terminal control switches to the article and lands on the path anchor', async ({ page }) => {
  await page.goto(`${CARDED_URL}?card=${N}`);
  await expect(page.locator('#ic-article')).toBeHidden();
  await page.locator('.ic-go').click();
  await expect(page.locator('#ic-article')).toBeVisible();
  await expect(page.locator('#ic-deck')).toBeHidden(); // one view at a time
  await expect(page.locator('#ic-tab-article')).toHaveAttribute('aria-selected', 'true');
  const target = page.locator(cards.default_anchor);
  await expect(target).toBeFocused();
  await atTopOrEnd(page, cards.default_anchor);
  expect(new URL(page.url()).hash).toBe('#article');
});

test('the button under the deck switches to the article with the switch at the top', async ({ page }) => {
  await page.goto(`${CARDED_URL}?card=2`);
  const open = page.locator('#ic-open');
  await expect(page.locator('#ic-article')).toBeHidden();
  await open.click();
  await expect(page.locator('#ic-article')).toBeVisible();
  await expect(page.locator('#ic-article')).toBeFocused();
  await atTopOrEnd(page, '#ic-switch');
  await expect(open).toBeHidden(); // part of the TL;DR view
});

test('the button under the deck works from the keyboard', async ({ page }) => {
  await page.goto(CARDED_URL);
  await page.locator('#ic-open').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#ic-article')).toBeVisible();
  await expect(page.locator('#ic-article')).toBeFocused();
});

test('a link to a section of the article opens it', async ({ page }) => {
  await page.goto(`${CARDED_URL}${cards.default_anchor}`);
  await expect(page.locator('#ic-article')).toBeVisible();
  await expect(page.locator('#ic-tab-article')).toHaveAttribute('aria-selected', 'true');
  await page.goto(CARDED_URL);
  await expect(page.locator('#ic-article')).toBeHidden();
  await page.evaluate((h) => { location.hash = h; }, cards.default_anchor);
  await expect(page.locator('#ic-article')).toBeVisible();
  await expect(page.locator(cards.default_anchor)).toBeInViewport();
});

test('deep link ?path=pilot&card=3 applies the path and lands on card 3', async ({ page }) => {
  await page.goto(`${CARDED_URL}?path=pilot&card=3`);
  await settle(page);
  expect(await currentIndex(page)).toBe(3);
  const pilot = cards.situation.options.find((o) => o.id === 'pilot');
  expect(await titlesInRail(page)).toEqual(pilot.order.map((id) => insightById[id].title));
  await expect(page.locator('.ic-card').nth(3).locator('.ic-title')).toHaveText(insightById[pilot.order[2]].title);
  await expect(page.getByRole('radio', { name: pilot.label })).toHaveAttribute('aria-checked', 'true');
});

test('deep link lands instantly, without a smooth scroll', async ({ page }) => {
  await page.goto(`${CARDED_URL}?card=5`);
  expect(await currentIndex(page)).toBe(5);
});

test('unknown deep-link values fall back safely', async ({ page }) => {
  await page.goto(`${CARDED_URL}?path=nope&card=99`);
  await settle(page);
  expect(await currentIndex(page)).toBe(N);
  expect(await titlesInRail(page)).toEqual(defaultOrder.map((id) => insightById[id].title));
});

test('address bar reflects the current path and card without reloading', async ({ page }) => {
  await page.goto(`${CARDED_URL}?utm_source=x`);
  await page.evaluate(() => { window.__sameDocument = true; });
  await page.locator('.ic-rail').focus();
  await page.keyboard.press('ArrowRight');
  await settle(page);
  await expect.poll(() => new URL(page.url()).search).toBe('?utm_source=x&card=1');
  await page.keyboard.press('ArrowLeft');
  await settle(page);
  await page.getByRole('radio').first().click();
  await settle(page);
  await expect.poll(() => new URL(page.url()).search).toBe(`?utm_source=x&path=${cards.situation.options[0].id}&card=1`);
  await page.keyboard.press('ArrowRight');
  await settle(page);
  await expect.poll(() => new URL(page.url()).searchParams.get('card')).toBe('2');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await settle(page);
  // On the situation card the card parameter is omitted; the path stays.
  await expect.poll(() => new URL(page.url()).searchParams.get('card')).toBeNull();
  expect(new URL(page.url()).searchParams.get('path')).toBe(cards.situation.options[0].id);
  expect(await page.evaluate(() => window.__sameDocument)).toBe(true); // replaceState only: no reloads
});
