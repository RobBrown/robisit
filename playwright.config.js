// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4100;

module.exports = defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: { baseURL: `http://localhost:${PORT}` },
  // Serves the Jekyll build in _site/ (run `npm run build` first).
  webServer: { command: `PORT=${PORT} node tests/serve.js`, port: PORT, reuseExistingServer: true },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // iPhone SE on WebKit: the closest local stand-in for iOS Safari.
    { name: 'iphone-se', use: { ...devices['iPhone SE'] }, testMatch: /layout\.spec\.js/ },
  ],
});
