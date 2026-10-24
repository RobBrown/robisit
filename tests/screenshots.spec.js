// Review package (not assertions): carded post at 375 and 1280, light and
// dark, on the situation card, an insight card, the terminal card, and after
// reveal. Written to test-results/screenshots/.
const { test } = require('@playwright/test');
const path = require('path');
const { CARDED_URL, N, settle } = require('./helpers');

const OUT = path.join(__dirname, '..', 'test-results', 'screenshots');

for (const width of [375, 1280]) {
  for (const scheme of ['light', 'dark']) {
    test(`screenshots ${width} ${scheme}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'chromium');
      await page.setViewportSize({ width, height: width === 375 ? 667 : 800 });
      await page.emulateMedia({ colorScheme: scheme });
      const shot = async (name) => {
        await page.evaluate(() => document.fonts.ready);
        await settle(page);
        await page.screenshot({ path: path.join(OUT, `${width}-${scheme}-${name}.png`) });
      };
      await page.goto(CARDED_URL);
      await shot('1-situation');
      await page.getByRole('radio').nth(2).click();
      await shot('2-insight');
      await page.goto(`${CARDED_URL}?path=pilot&card=${N}`);
      await shot('3-terminal');
      await page.locator('.ic-go').click();
      await page.waitForFunction(() => Math.abs(document.activeElement.getBoundingClientRect().top) < 40);
      await shot('4-revealed');
    });
  }
}
