const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const CARDED_URL = '/thoughts/ai-framework/';

function frontMatter(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return yaml.load(src.split(/^---\s*$/m)[1]);
}

// The carded post's cards block, so tests follow the content rather than restating it.
const cards = frontMatter('_articles/ai-framework.md').cards;
const insightById = Object.fromEntries(cards.insights.map((i) => [i.id, i]));
const defaultOrder = cards.default_order || cards.insights.map((i) => i.id);
const paths = [{ id: null, order: defaultOrder, anchor: cards.default_anchor },
  ...cards.situation.options.map((o) => ({ id: o.id, order: o.order, anchor: o.anchor }))];
const N = cards.insights.length + 1; // insights + terminal

// Every hex colour in the site's stylesheet: the site's token set.
function siteColours() {
  const css = fs.readFileSync(path.join(ROOT, '_layouts/article.html'), 'utf8');
  const set = new Set();
  for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    set.add(`rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4), 16)})`);
  }
  return set;
}

// Wait until the rail has stopped moving.
async function settle(page) {
  await page.waitForFunction(() => new Promise((resolve) => {
    const rail = document.querySelector('.ic-rail');
    let last = rail.scrollLeft, still = 0;
    (function tick() {
      if (rail.scrollLeft === last) still++; else { still = 0; last = rail.scrollLeft; }
      if (still > 6) return resolve(true);
      requestAnimationFrame(tick);
    })();
  }));
}

// Index of the card whose centre is closest to the rail's centre.
function currentIndex(page) {
  return page.evaluate(() => {
    const rail = document.querySelector('.ic-rail');
    const mid = rail.getBoundingClientRect().left + rail.clientWidth / 2;
    let best = 0, bd = Infinity;
    [...rail.children].forEach((c, i) => {
      const r = c.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - mid);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  });
}

// Capture analytics through the documented adapter boundary.
async function captureEvents(page) {
  await page.addInitScript(() => {
    window.__events = [];
    window.insightCardsAnalytics = (name, props) => window.__events.push({ name, props });
  });
}

module.exports = { ROOT, CARDED_URL, cards, insightById, defaultOrder, paths, N, siteColours, settle, currentIndex, captureEvents };
