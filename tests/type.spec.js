// Type system (docs/typography.md): self-hosted faces only, Atkinson
// Hyperlegible Next for reading, its Mono for labels, nothing under 10px.
const { test, expect } = require('@playwright/test');
const { CARDED_URL } = require('./helpers');

const PAGES = ['/', '/content/', CARDED_URL, '/thoughts/vendor-no-longer-gets-last-word/'];

for (const url of PAGES) {
  test(`${url} loads only self-hosted fonts and reads in Atkinson Hyperlegible Next`, async ({ page }) => {
    const fonts = [];
    page.on('request', (r) => { if (r.resourceType() === 'font' || /fonts\.(googleapis|gstatic)/.test(r.url())) fonts.push(r.url()); });
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    expect(fonts.filter((u) => !u.startsWith('http://localhost'))).toEqual([]);
    const body = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(body).toMatch(/^"?Atkinson Hyperlegible Next/);
    const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
    expect(loaded.map((f) => f.replace(/"/g, ''))).toContain('Atkinson Hyperlegible Next');
  });
}

test('no visible text on the home page is set below 10px', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(6000); // the bio types itself out
  const small = await page.evaluate(() => [...document.querySelectorAll('body *')]
    .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    .filter((el) => el.getClientRects().length && parseFloat(getComputedStyle(el).fontSize) < 10)
    .map((el) => `${el.className || el.tagName}: ${getComputedStyle(el).fontSize}`));
  expect(small).toEqual([]);
});
