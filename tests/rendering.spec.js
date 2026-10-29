// PRD 11 Content and Publishing; PRD 3.1, 4.3, ACC-11.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, CARDED_URL, CARDED_FILE, cards } = require('./helpers');

const SITE = path.join(ROOT, '_site');

test('carded post renders the site header, the TL;DR deck and the collapsed article', async ({ page }) => {
  await page.goto(CARDED_URL);
  const masthead = page.locator('article > header');
  await expect(masthead.locator('h1')).toHaveText(/Hello, World/);
  // Owner direction: carded pages leave out the date and view counts.
  await expect(masthead.locator('.date')).toHaveCount(0);
  await expect(masthead.locator('.byline')).toHaveCount(0);
  await expect(page.locator('#ic-published')).toHaveCount(0);
  await expect(page.getByRole('tabpanel', { name: /^TL;DR/ })).toBeVisible();
  await expect(page.locator('.ic-card')).toHaveCount(1 + cards.insights.length + 1);
  // Owner direction (2026-10-28): no button under the deck.
  await expect(page.locator('#ic-open')).toHaveCount(0);
  await expect(page.locator('#ic-article')).toBeHidden();
  await expect(page.locator('#ic-article')).toHaveAttribute('hidden', 'until-found');

  // Owner request (2026-10-29): the LinkedIn discussion link sits under the deck.
  await expect(page.locator('.ic-discuss')).toBeVisible();
  await expect(page.locator('.ic-discuss')).toHaveText('What are your thoughts? Comment →');
  await expect(page.locator('.ic-discuss')).toHaveAttribute('href', '#');

  // Order on the page: masthead, view switch, deck, discussion link, article.
  const order = await page.evaluate(() => ['article > header', '#ic-switch', '#ic-deck', '.ic-discuss', '#ic-article']
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
  // Never collapsed in the HTML: only the script collapses it.
  expect(html).not.toMatch(/id="ic-article"[^>]*hidden/);
  // Every section heading of the source post is present.
  const src = fs.readFileSync(path.join(ROOT, CARDED_FILE), 'utf8');
  const headings = [...src.matchAll(/^#{2,3} (.+)$/gm)].length;
  expect((article.match(/<h[23] id="/g) || []).length).toBe(headings);
  expect(article).toContain('That is the end of the test page.');
  // Deck markup ships hidden, so a script failure leaves only the article.
  expect(html).toMatch(/<section[^>]*id="ic-deck"[^>]*hidden/);
});

for (const [name, file] of [
  ['ai-framework', 'thoughts/ai-framework/index.html'],
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
    await expect(page.locator('#ic-switch')).toBeHidden();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('#ic-article')).toBeVisible();
    await expect(page.locator('#hello-world')).toBeVisible();
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

test('the test page is unlisted: absent from /content and marked noindex', async ({ page, request }) => {
  const listing = await (await request.get('/content/')).text();
  expect(listing).not.toContain('hello-world-cards');
  expect(listing).toContain('/thoughts/ai-framework/');
  await page.goto(CARDED_URL);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await page.goto('/thoughts/ai-framework/');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test('articles without a cards block show no deck', async ({ page }) => {
  for (const f of fs.readdirSync(path.join(ROOT, '_articles'))) {
    if (path.join('_articles', f) === CARDED_FILE) continue;
    const src = fs.readFileSync(path.join(ROOT, '_articles', f), 'utf8');
    if (/^cards:/m.test(/^---\n([\s\S]*?)\n---/.exec(src)[1])) continue; // new carded posts are allowed
    const html = fs.readFileSync(path.join(SITE, 'thoughts', f.replace(/\.md$/, ''), 'index.html'), 'utf8');
    expect(html, f).not.toContain('ic-deck');
    expect(html, f).not.toContain('insight-cards');
  }
});
