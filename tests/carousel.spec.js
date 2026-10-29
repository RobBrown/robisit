// LinkedIn carousel: the PDF's page count and size, and that no text overflows its slide.
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const zlib = require('zlib');
const { carded, findPost } = require('../scripts/narrate');
const model = require('../scripts/carousel/model');
const { renderHtml } = require('../scripts/carousel/template');
const { renderPdf, checkOverflow, assertFonts, fit } = require('../scripts/carousel/render');

const ROOT = path.resolve(__dirname, '..');
const slugs = carded(ROOT);
const slidesFor = (slug) => model.buildSlides(model.loadArticle(findPost(slug, ROOT), ROOT));

// Minimal PDF reader: page objects and their MediaBoxes. Chromium may put page
// objects in compressed object streams, so inflate every stream when needed.
function pdfPages(buf) {
  const scan = (text) => {
    const pages = [...text.matchAll(/\/Type\s*\/Page(?![s\w])/g)].length;
    const boxes = [...text.matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)].map((m) => m[1].trim().split(/\s+/).map(Number));
    return { pages, boxes };
  };
  const raw = buf.toString('latin1');
  let r = scan(raw);
  if (r.pages) return r;
  const inflated = [];
  for (const m of raw.matchAll(/stream\r?\n/g)) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    try { inflated.push(zlib.inflateSync(buf.subarray(start, end)).toString('latin1')); } catch (e) { /* not flate */ }
  }
  r = scan(inflated.join('\n'));
  return r;
}

test.describe('carousel PDF', () => {
  for (const slug of slugs) {
    test(`${slug}: one 1080x1350 page per slide`, async () => {
      const slides = slidesFor(slug);
      const { pdf, pages } = await renderPdf(slides);
      expect(pages).toBe(slides.length);
      const parsed = pdfPages(pdf);
      expect(parsed.pages).toBe(slides.length);
      expect(parsed.boxes.length).toBeGreaterThan(0);
      for (const [x0, y0, x1, y1] of parsed.boxes) {
        expect(Math.abs((x1 - x0) - 810)).toBeLessThan(0.5);
        // Chromium rounds paper height to ~0.96 pt steps (1013.04, not 1012.5): 0.05% off 4:5.
        expect(Math.abs((y1 - y0) - 1012.5)).toBeLessThan(1);
      }
    });
  }
});

test.describe('carousel slides', () => {
  let browser;
  test.beforeAll(async () => { browser = await chromium.launch(); });
  test.afterAll(async () => { await browser.close(); });

  async function open(slides) {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
    await page.emulateMedia({ media: 'print' });
    await page.setContent(renderHtml(slides));
    await assertFonts(page);
    return page;
  }

  for (const slug of slugs) {
    test(`${slug}: fonts load and nothing overflows`, async () => {
      const slides = slidesFor(slug);
      const page = await open(slides);
      expect(await page.locator('.slide').count()).toBe(slides.length);
      await fit(page);
      expect(await checkOverflow(page)).toEqual([]);
      const html = await page.content();
      expect(html).not.toMatch(/twitter|\bx\.com/i);
      await page.close();
    });
  }

  test('a 90-word body and a 70-character title still fit after the fit loop', async () => {
    const base = slidesFor(slugs[0]);
    const words = Array.from({ length: 90 }, (_, i) => `word${i}`).join(' ');
    const stress = { kind: 'insight', id: 'stress', n: 1, total: 8, title: 'T'.repeat(6) + ' ' + 'long title words '.repeat(4).slice(0, 63), body: words, art: null };
    expect(stress.title.length).toBeGreaterThanOrEqual(69);
    const slides = [base[0], stress, base[base.length - 1]];
    const { pdf, fit } = await renderPdf(slides); // throws if any slide cannot fit
    expect(pdfPages(pdf).pages).toBe(3);
    expect(fit[1].body).toBeLessThanOrEqual(38);
  });
});
