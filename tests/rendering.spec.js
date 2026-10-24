// PRD 11 Content and Publishing; PRD 3.1, 4.3, ACC-11.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, CARDED_URL, cards, defaultOrder, N } = require('./helpers');

const SITE = path.join(ROOT, '_site');

test('carded post renders masthead, deck and reveal link; article collapsed after script runs', async ({ page }) => {
  await page.goto(CARDED_URL);
  const masthead = page.locator('.ic-masthead');
  await expect(masthead.locator('h1')).toHaveText(/AI Transformation Isn't a Migration/);
  await expect(masthead.locator('.date')).toHaveCount(1); // one line of metadata
  await expect(page.getByRole('region', { name: 'Insight cards' })).toBeVisible();
  await expect(page.locator('.ic-card')).toHaveCount(1 + cards.insights.length + 1);
  await expect(page.getByRole('button', { name: 'Read the full article' })).toBeVisible();
  await expect(page.locator('#ic-article')).toBeHidden();

  // Order on the page: masthead, deck, reveal link, article.
  const order = await page.evaluate(() => ['.ic-masthead', '#ic-deck', '#ic-expand', '#ic-article']
    .map((s) => document.querySelector(s)).every((el, i, a) => i === 0 || (a[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)));
  expect(order).toBe(true);
});

test('deck is the first screen: rail starts within the first viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(CARDED_URL);
  const top = await page.locator('.ic-rail').evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeLessThan(667 / 2);
});

test('article body is complete in the initial HTML, visible before script runs', async ({ request }) => {
  const html = await (await request.get(CARDED_URL)).text();
  const article = html.slice(html.indexOf('id="ic-article"'));
  expect(html).toContain('id="ic-article"');
  // Not collapsed in markup: collapsing is a script action.
  expect(html).not.toMatch(/id="ic-article"[^>]*hidden/);
  // Every section heading of the source post is present.
  const src = fs.readFileSync(path.join(ROOT, '_articles/ai-framework.md'), 'utf8');
  const headings = [...src.matchAll(/^#{2,3} (.+)$/gm)].length;
  expect((article.match(/<h[23] id="/g) || []).length).toBe(headings);
  expect(article).toContain('If you take one thing from this neccisarily long text');
  // Deck markup ships hidden, so a script failure leaves only the article.
  expect(html).toMatch(/<section[^>]*id="ic-deck"[^>]*hidden/);
});

test('article body matches the pre-change build byte for byte', async () => {
  const body = (html) => html.slice(html.indexOf('<div class="body">'), html.indexOf('<footer>'))
    .replace(/(\s*<\/(div|article)>|\s*<script[^>]*><\/script>)+\s*$/, '');
  const before = fs.readFileSync(path.join(__dirname, 'fixtures/baseline/ai-framework.html'), 'utf8');
  const after = fs.readFileSync(path.join(SITE, 'thoughts/ai-framework/index.html'), 'utf8');
  expect(body(after)).toBe(body(before));
});

for (const [name, file] of [
  ['modern-platform-part-1', 'thoughts/modern-platform-part-1/index.html'],
  ['modern-platform-part-2', 'thoughts/modern-platform-part-2/index.html'],
  ['stop-building-islands', 'thoughts/stop-building-islands/index.html'],
  ['vendor-no-longer-gets-last-word', 'thoughts/vendor-no-longer-gets-last-word/index.html'],
  ['home', 'index.html'],
  ['content', 'content/index.html'],
]) {
  test(`non-carded page "${name}" is byte-identical to the pre-change build`, async () => {
    const before = fs.readFileSync(path.join(__dirname, `fixtures/baseline/${name}.html`), 'utf8');
    const after = fs.readFileSync(path.join(SITE, file), 'utf8');
    expect(after).toBe(before);
  });
}

test('non-carded post loads no deck assets', async ({ page }) => {
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto('/thoughts/vendor-no-longer-gets-last-word/');
  expect(urls.filter((u) => u.includes('insight-cards'))).toEqual([]);
  await expect(page.locator('.ic-deck')).toHaveCount(0);
});

test.describe('JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });
  test('deck does not render and the article shows as a normal post', async ({ page }) => {
    await page.goto(CARDED_URL);
    await expect(page.locator('#ic-deck')).toBeHidden();
    await expect(page.locator('#ic-expand')).toBeHidden();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('#ic-article')).toBeVisible();
    await expect(page.locator('#ai-adoption--new-tool')).toBeVisible();
    const deckText = await page.evaluate(() => {
      const r = document.querySelector('#ic-deck').getBoundingClientRect();
      return r.width * r.height;
    });
    expect(deckText).toBe(0);
  });
});

test('invalid cards blocks render the plain article (fixture build)', async () => {
  const dir = path.join(ROOT, '_site-fixtures/thoughts');
  test.skip(!fs.existsSync(dir), 'fixture site not built (npm run build)');
  const posts = fs.readdirSync(dir);
  expect(posts.length).toBeGreaterThan(5);
  for (const p of posts) {
    const html = fs.readFileSync(path.join(dir, p, 'index.html'), 'utf8');
    if (p.startsWith('valid')) {
      expect(html, p).toContain('id="ic-deck"');
    } else {
      expect(html, p).not.toContain('ic-deck');
      expect(html, p).not.toContain('insight-cards');
      expect(html, p).toContain('<div class="body">');
    }
  }
});
