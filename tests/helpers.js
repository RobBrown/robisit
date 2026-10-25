const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const CARDED_URL = '/thoughts/hello-world-cards/';
const CARDED_FILE = '_articles/hello-world-cards.md';

function frontMatter(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return yaml.load(src.split(/^---\s*$/m)[1]);
}

// The carded post's cards block, so tests follow the content rather than restating it.
const cards = frontMatter(CARDED_FILE).cards;
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

// The deck's palette (docs/insight-cards-design.md): the article's hex colours
// plus the home page's amber and green themes (index.html), as "r, g, b"
// channel triples, so a colour at any alpha can be checked against it.
function deckChannels() {
  const set = new Set([...siteColours()].map((c) => /\((.*)\)/.exec(c)[1]));
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const theme of home.matchAll(/body(?:\.green)?\{([^}]*)\}/g)) {
    for (const m of theme[1].matchAll(/#([0-9a-f]{6})\b/gi)) {
      const h = m[1].toLowerCase();
      set.add(`${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4), 16)}`);
    }
    for (const m of theme[1].matchAll(/:\s*(\d+),\s*(\d+),\s*(\d+);/g)) set.add(`${m[1]}, ${m[2]}, ${m[3]}`);
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

// Index of the card whose left edge is closest to the rail's snap edge (the
// text column), or the last card when the rail is scrolled to its end.
function currentIndex(page) {
  return page.evaluate(() => {
    const rail = document.querySelector('.ic-rail');
    if (rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 2) return rail.children.length - 1;
    const edge = rail.getBoundingClientRect().left + parseFloat(getComputedStyle(rail).paddingLeft);
    let best = 0, bd = Infinity;
    [...rail.children].forEach((c, i) => {
      const d = Math.abs(c.getBoundingClientRect().left - edge);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  });
}

// True once the element is at the top of the viewport, or the page can scroll no further.
function atTopOrEnd(page, selector) {
  return page.waitForFunction((sel) => {
    const el = sel ? document.querySelector(sel) : document.activeElement;
    const maxed = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
    return Math.abs(el.getBoundingClientRect().top) < 40 || (maxed && el.getBoundingClientRect().top > 0);
  }, selector);
}

// Capture analytics through the documented adapter boundary.
async function captureEvents(page) {
  await page.addInitScript(() => {
    window.__events = [];
    window.insightCardsAnalytics = (name, props) => window.__events.push({ name, props });
  });
}

module.exports = { ROOT, CARDED_URL, CARDED_FILE, cards, insightById, defaultOrder, paths, N, siteColours, deckChannels, settle, currentIndex, captureEvents, atTopOrEnd };
