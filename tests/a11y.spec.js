// PRD 8 (ACC-01..ACC-11) and PRD 11 Quality.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { CARDED_URL, cards, N, settle, currentIndex } = require('./helpers');

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Contrast failures in the site's existing chrome, present on every post before
// this change (nav brand, TOC subtitle, footer copyright). They are outside the
// deck and flagged in the PR rather than restyled here.
const PRE_EXISTING = /^color-contrast: (\.brand|\.toc-sub|\.copy)$/;

for (const scheme of ['light', 'dark']) {
  for (const state of ['situation', 'insight', 'terminal', 'in-article']) {
    test(`axe: zero WCAG 2.2 AA violations, ${scheme} scheme, ${state}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const q = { situation: '', insight: '?path=pilot&card=2', terminal: `?card=${N}`, 'in-article': `?card=${N}` }[state];
      await page.goto(CARDED_URL + q);
      if (state === 'in-article') await page.locator('.ic-go').click();
      await page.locator('#ic-deck').hover();
      const flat = (r) => r.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`));

      // The reading layer itself: zero violations.
      const layer = await new AxeBuilder({ page }).withTags(WCAG).include('#ic-deck').include('#ic-switch').include('#ic-open').include('#ic-published').analyze();
      expect(flat(layer)).toEqual([]);

      // The whole page: nothing beyond the site's pre-existing issues.
      const all = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(flat(all).filter((v) => !PRE_EXISTING.test(v))).toEqual([]);
    });
  }
}

test('ACC-03: deck is the TL;DR tab panel; cards are groups with roledescription and counter label', async ({ page }) => {
  await page.goto(CARDED_URL);
  await expect(page.getByRole('tabpanel', { name: /^TL;DR/ })).toHaveCount(1);
  const labels = await page.locator('.ic-card').evaluateAll((els) => els.map((e) => [e.getAttribute('role'), e.getAttribute('aria-roledescription'), e.getAttribute('aria-label')]));
  expect(labels).toEqual([['group', 'card', 'Start'], ...Array.from({ length: N }, (_, i) => ['group', 'card', `${i + 1} of ${N}`])]);
});

test('ACC-04: scroll rail is focusable with a visible focus ring', async ({ page }) => {
  await page.goto(CARDED_URL);
  // Brand, menu, the selected view tab, then the rail.
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
  await expect(page.locator('.ic-rail')).toBeFocused();
  const outline = await page.locator('.ic-rail').evaluate((el) => { const s = getComputedStyle(el); return [s.outlineStyle, parseFloat(s.outlineWidth)]; });
  expect(outline[0]).not.toBe('none');
  expect(outline[1]).toBeGreaterThanOrEqual(2);
});

test('ACC-01: keyboard only — Tab reaches rail, options, chevrons and terminal control; Enter activates each', async ({ page }) => {
  await page.goto(CARDED_URL);
  const focusNames = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    focusNames.push(await page.evaluate(() => {
      const a = document.activeElement;
      return a.classList.contains('ic-rail') ? 'rail' : (a.getAttribute('aria-label') || a.textContent.trim());
    }));
  }
  expect(focusNames).toContain('rail');
  for (const o of cards.situation.options) expect(focusNames).toContain(o.label);
  expect(focusNames).toContain('Read The Full Article');
  expect(focusNames.some((n) => /^(Previous|Next) card$/.test(n))).toBe(true);

  // Enter on an option selects the path and advances.
  await page.reload();
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab'); // rail
  await page.keyboard.press('Tab'); // first option
  await expect(page.getByRole('radio').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await currentIndex(page)).toBe(1);
  await expect(page.getByRole('radio').first()).toHaveAttribute('aria-checked', 'true');

  // Enter on Next chevron.
  await page.getByRole('button', { name: 'Next card' }).focus();
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await currentIndex(page)).toBe(2);

  // Enter on the terminal control.
  await page.locator('.ic-go').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#ic-article')).toBeFocused();
});

test('ACC-05: live region announces card changes', async ({ page }) => {
  await page.goto(CARDED_URL);
  const live = page.locator('#ic-live');
  await expect(live).toHaveAttribute('aria-live', 'polite');
  await expect(live).toHaveText(''); // nothing announced on load
  await page.locator('.ic-rail').focus();
  await page.keyboard.press('ArrowRight');
  await expect(live).toHaveText(new RegExp(`^Card 1 of ${N}\\. `));
  await page.keyboard.press('ArrowRight');
  await expect(live).toHaveText(new RegExp(`^Card 2 of ${N}\\. `));
});

test('ACC-06: options are a radio group with correct checked state', async ({ page }) => {
  await page.goto(CARDED_URL);
  const radios = page.getByRole('radiogroup').getByRole('radio');
  await radios.nth(1).click();
  await settle(page);
  expect(await radios.evaluateAll((els) => els.map((e) => e.getAttribute('aria-checked')))).toEqual(['false', 'true', 'false']);
  await radios.nth(2).click();
  expect(await radios.evaluateAll((els) => els.map((e) => e.getAttribute('aria-checked')))).toEqual(['false', 'false', 'true']);
});

test.describe('ACC-10: reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('programmatic scrolls are instant', async ({ page }) => {
    await page.goto(CARDED_URL);
    await page.locator('.ic-rail').focus();
    const target = await page.locator('.ic-card').nth(1).evaluate((c) => c.offsetLeft - parseFloat(getComputedStyle(c.parentElement).scrollPaddingLeft));
    const after = await page.evaluate(() => new Promise((res) => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      res(document.querySelector('.ic-rail').scrollLeft); // same task: no animation frames elapsed
    }));
    expect(Math.abs(after - target)).toBeLessThanOrEqual(1);
    // The switch into the article is instant too.
    await page.goto(`${CARDED_URL}?card=${N}`);
    const shown = await page.evaluate(() => { document.querySelector('.ic-go').click(); return !document.getElementById('ic-article').hidden; });
    expect(shown).toBe(true);
  });
});

test('without reduced motion, programmatic scrolls are smooth', async ({ page }) => {
  await page.goto(CARDED_URL);
  const after = await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    return document.querySelector('.ic-rail').scrollLeft;
  });
  expect(after).toBe(0);
});

test('ACC-09: at 200% zoom (187px CSS viewport) cards have no internal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(CARDED_URL);
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await page.waitForTimeout(100);
  const bad = await page.locator('.ic-card').evaluateAll((els) => els.filter((e) => e.scrollHeight > e.clientHeight + 1).map((e) => e.getAttribute('aria-label')));
  expect(bad).toEqual([]);
});
