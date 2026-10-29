/* Slide model for the LinkedIn carousel: pure data, no browser.
 *
 * An article's `cards` front matter becomes: a cover, the insight cards in
 * cards.default_order, and a closing slide. The situation card is never read
 * (it is a question for the interactive deck and means nothing in a PDF).
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { liquidStrip } = require('../narration/segment');

// Bump by hand when the output changes in a way the hash cannot see.
const GENERATOR_VERSION = 'v1';
const FOLLOW = 'Follow Rob Brown on LinkedIn';

const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');

function loadArticle(file, root) {
  const src = fs.readFileSync(file, 'utf8');
  const m = /^---\s*\n([\s\S]*?)\n---\s*$/m.exec(src);
  const fm = m ? yaml.load(m[1]) : null;
  if (!fm || !fm.cards || !Array.isArray(fm.cards.insights)) {
    throw new Error(`${path.relative(root, file)} has no cards.insights block`);
  }
  const cfgFile = path.join(root, '_config.yml');
  const cfg = fs.existsSync(cfgFile) ? yaml.load(fs.readFileSync(cfgFile, 'utf8')) || {} : {};
  const slug = path.basename(file).replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.(md|markdown)$/, '');
  return {
    slug, file, root, fm, cards: fm.cards,
    site: { url: cfg.url || '', baseurl: cfg.baseurl || '', collections: cfg.collections || {}, permalink: cfg.permalink },
  };
}

function articleUrl(article) {
  const { fm, slug, file, site } = article;
  let p;
  if (fm.permalink) {
    p = String(fm.permalink);
  } else {
    const dir = path.basename(path.dirname(file));
    if (dir === '_posts') {
      const d = /^(\d{4})-(\d{2})-(\d{2})-/.exec(path.basename(file));
      p = d ? `/${d[1]}/${d[2]}/${d[3]}/${slug}/` : `/${slug}/`;
    } else {
      const name = dir.replace(/^_/, '');
      const tpl = site.collections[name] && site.collections[name].permalink;
      p = tpl ? tpl.replace(/:name|:title/g, slug).replace(/:collection/g, name) : `/${name}/${slug}/`;
    }
  }
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  return `${site.url.replace(/\/+$/, '')}${(site.baseurl || '').replace(/\/+$/, '')}${p}`;
}

// Resolve a site art path to a file inside root/assets, or throw.
function resolveArt(art, root) {
  const base = path.resolve(root, 'assets');
  const abs = path.resolve(root, String(art).replace(/^\/+/, ''));
  if (!abs.startsWith(base + path.sep)) throw new Error(`art path is outside assets/: ${art}`);
  if (!fs.existsSync(abs)) throw new Error(`art file not found: ${art}`);
  return abs;
}

function buildSlides(article) {
  const { cards, fm, root } = article;
  const byId = new Map(cards.insights.map((i) => [i.id, i]));
  const order = cards.default_order || cards.insights.map((i) => i.id);
  const T = cards.insights.length + 1;
  const term = cards.terminal || {};
  const slides = [{
    kind: 'cover',
    title: liquidStrip(fm.title),
    hook: liquidStrip(fm.description || `TL;DR in ${T} cards`),
    readout: `TL;DR in ${T} cards`,
    byline: 'Rob Brown',
  }];
  order.forEach((id, k) => {
    const i = byId.get(id);
    if (!i) throw new Error(`default_order names unknown insight "${id}"`);
    slides.push({
      kind: 'insight', id, n: k + 1, total: T,
      title: liquidStrip(i.title), body: liquidStrip(i.body),
      art: i.art ? resolveArt(i.art, root) : null,
    });
  });
  slides.push({
    kind: 'closing', n: T, total: T,
    knows: liquidStrip(term.knows || ''), resolves: liquidStrip(term.resolves || ''),
    url: articleUrl(article), follow: FOLLOW,
  });
  return slides;
}

function deckHash(slides, { templateSource, version = GENERATOR_VERSION } = {}) {
  const plain = slides.map((s) => (s.art ? { ...s, art: sha(fs.readFileSync(s.art)) } : s));
  return sha(JSON.stringify({ version, template: sha(templateSource || ''), slides: plain }));
}

module.exports = { loadArticle, buildSlides, articleUrl, deckHash, GENERATOR_VERSION };
