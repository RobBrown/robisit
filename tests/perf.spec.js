// PRD 10: deck adds no more than 10 KB compressed CSS + JS combined.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { ROOT, CARDED_URL } = require('./helpers');

test('combined gzipped deck CSS and JS is under 10 KB', async () => {
  const files = ['assets/css/insight-cards.css', 'assets/js/insight-cards.js'];
  const sizes = files.map((f) => zlib.gzipSync(fs.readFileSync(path.join(ROOT, f)), { level: 9 }).length);
  const total = sizes.reduce((a, b) => a + b, 0);
  console.log(`gzip sizes: css ${sizes[0]} B, js ${sizes[1]} B, total ${total} B`);
  fs.mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'test-results/asset-sizes.json'), JSON.stringify({ css: sizes[0], js: sizes[1], total }));
  expect(total).toBeLessThan(10 * 1024);
});

test('the include and its Liquid add no external requests', async ({ page }) => {
  const hosts = new Set();
  page.on('request', (r) => hosts.add(new URL(r.url()).host));
  await page.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
  await page.goto(CARDED_URL);
  const own = [...hosts].filter((h) => !/localhost|googleapis|gstatic|posthog/.test(h));
  expect(own).toEqual([]);
});
