// PRD 4.2-4.4: schema, order and anchor validation; warnings never fail the build.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./helpers');

const FIXTURES = 'tests/fixtures/cards-site';
const run = (...args) => spawnSync('node', ['scripts/validate-cards.js', ...args], { cwd: ROOT, encoding: 'utf8' });
const warned = (out) => new Set([...out.matchAll(/^::warning file=([^,]+),/gm)].map((m) => path.basename(m[1], '.md')));
const fixtureNames = () => fs.readdirSync(path.join(ROOT, FIXTURES, '_articles')).map((f) => path.basename(f, '.md'));

for (const mode of ['built HTML', 'emulated ids']) {
  test(`every invalid fixture warns, every valid one passes (${mode})`, async () => {
    const args = ['--root', FIXTURES];
    if (mode === 'built HTML') {
      test.skip(!fs.existsSync(path.join(ROOT, '_site-fixtures')), 'fixture site not built');
      args.push('--site', '_site-fixtures');
    }
    const r = run(...args);
    expect(r.status).toBe(0); // warnings, not failures
    const w = warned(r.stdout);
    for (const name of fixtureNames()) expect(w.has(name), `${name}\n${r.stdout}`).toBe(name.startsWith('invalid'));
  });
}

test('warnings name the specific problem', async () => {
  const out = run('--root', FIXTURES).stdout;
  expect(out).toMatch(/invalid-order-missing-id.*situation\.options\[0\]\.order is missing: e/);
  expect(out).toMatch(/invalid-order-duplicate-id.*situation\.options\[1\]\.order lists b more than once/);
  expect(out).toMatch(/invalid-anchor-not-a-heading.*#no-such-heading does not match a heading id/);
  expect(out).toMatch(/invalid-four-insights.*insights must have 5 to 8 entries \(found 4\)/);
  expect(out).toMatch(/invalid-default-anchor-not-a-heading.*did you mean #first-section/);
});

test('the site\'s own posts validate cleanly against the real build', async () => {
  test.skip(!fs.existsSync(path.join(ROOT, '_site')), 'site not built');
  const r = run('--site', '_site');
  expect(r.status).toBe(0);
  expect(r.stdout).not.toContain('::warning');
  expect(r.stdout).toMatch(/(\d+) carded posts?, \1 valid, 0 with warnings/);
});

test('emulated GFM ids agree with the ids Jekyll generated for every post', async () => {
  test.skip(!fs.existsSync(path.join(ROOT, '_site')), 'site not built');
  const { headingIdsFromMarkdown } = require(path.join(ROOT, 'scripts/validate-cards.js'));
  for (const f of fs.readdirSync(path.join(ROOT, '_articles'))) {
    const md = fs.readFileSync(path.join(ROOT, '_articles', f), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, '_site/thoughts', path.basename(f, '.md'), 'index.html'), 'utf8');
    const built = [...html.matchAll(/<h[1-6] id="([^"]+)"/g)].map((m) => m[1]);
    expect(headingIdsFromMarkdown(md), f).toEqual(built);
  }
});
