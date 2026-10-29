#!/usr/bin/env node
/* Generates a LinkedIn document (carousel) PDF for each carded post.
 *
 *   npm run carousel -- <post-slug> [--force] [--dry-run]
 *   npm run carousel -- --all      every post with cards (used by CI)
 *
 * Built from the post's `cards` front matter, with no Jekyll build:
 *   assets/carousel/<slug>.pdf    cover, insights in default order, closing
 *   assets/carousel/<slug>.json   metadata: hash of everything that shapes the PDF
 *
 * A deck is skipped when its metadata hash matches and its PDF exists. The hash,
 * not the file bytes, decides: Chromium stamps a creation date into every PDF.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { findPost, carded } = require('./narrate');
const model = require('./carousel/model');

const ROOT = path.resolve(__dirname, '..');

const paths = (root, slug) => ({
  pdf: path.join(root, 'assets/carousel', `${slug}.pdf`),
  json: path.join(root, 'assets/carousel', `${slug}.json`),
});

// Writes each file beside its target, then renames, so a deck is never half-written.
function writeAll(files) {
  const tmp = files.map(([f, data]) => {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const t = `${f}.tmp-${process.pid}`;
    fs.writeFileSync(t, data);
    return [t, f];
  });
  for (const [t, f] of tmp) fs.renameSync(t, f);
}

function isCurrent(p, hash) {
  if (!fs.existsSync(p.json) || !fs.existsSync(p.pdf)) return false;
  try { return JSON.parse(fs.readFileSync(p.json, 'utf8')).hash === hash; } catch (e) { return false; }
}

// The template and its fonts are the whole look of the deck, so both are part of the hash.
function templateSource() {
  const t = require('./carousel/template');
  const fonts = t.FONTS.map((f) => fs.readFileSync(path.join(t.FONT_DIR, f.file)).toString('base64'));
  return fs.readFileSync(require.resolve('./carousel/template'), 'utf8') + fonts.join('');
}

function table(rows) {
  const head = ['deck', 'status', 'pages', 'note'];
  const data = rows.map((r) => [r.slug, r.status, r.pages ? String(r.pages) : '', r.note || '']);
  const w = head.map((h, i) => Math.max(h.length, ...data.map((d) => d[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(w[i])).join('  ').trimEnd();
  return [line(head), line(w.map((n) => '-'.repeat(n))), ...data.map(line)].join('\n');
}

async function carousel(slug, opts = {}) {
  const root = opts.root || ROOT;
  const file = findPost(slug, root);
  if (!file) throw new Error(`no post with slug "${slug}" in _articles or _posts`);
  const out = { slug, status: 'failed', pages: 0, note: '' };
  try {
    const article = model.loadArticle(file, root);
    const slides = model.buildSlides(article);
    const hash = model.deckHash(slides, { templateSource: templateSource() });
    const p = paths(root, slug);
    if (!opts.force && isCurrent(p, hash)) return { ...out, status: 'skipped', pages: slides.length, note: 'unchanged' };
    if (opts.dryRun) return { ...out, status: 'would generate', pages: slides.length };
    const render = opts.render || require('./carousel/render').renderPdf;
    const r = await render(slides);
    const meta = {
      slug, hash, version: model.GENERATOR_VERSION, url: slides[slides.length - 1].url, pages: r.pages,
      slides: slides.map((s) => ({ kind: s.kind, id: s.id || null })), fit: r.fit || null,
    };
    writeAll([[p.pdf, r.pdf], [p.json, `${JSON.stringify(meta, null, 2)}\n`]]);
    return { ...out, status: 'processed', pages: r.pages };
  } catch (e) {
    return { ...out, status: 'failed', note: e.message };
  }
}

const USAGE = 'usage: npm run carousel -- <post-slug> [--force] [--dry-run]\n'
  + '       npm run carousel -- --all      every post with cards';

async function main(argv) {
  const opts = {};
  const rest = [];
  let all = false;
  for (const a of argv) {
    if (a === '--force') opts.force = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--all') all = true;
    else rest.push(a);
  }
  if (all ? rest.length !== 0 : rest.length !== 1) { console.error(USAGE); process.exit(2); }
  // One browser for every deck, launched only when a deck actually needs rendering.
  let browser = null;
  opts.render = async (slides) => {
    if (!browser) browser = await require('@playwright/test').chromium.launch();
    return require('./carousel/render').renderPdf(slides, { browser });
  };
  const rows = [];
  try {
    for (const slug of all ? carded(ROOT) : rest) {
      try {
        rows.push(await carousel(slug, opts));
      } catch (e) {
        rows.push({ slug, status: 'failed', pages: 0, note: e.message });
      }
    }
  } finally {
    if (browser) await browser.close();
  }
  console.log(table(rows));
  if (rows.some((r) => r.status === 'failed')) process.exit(1);
}

module.exports = { carousel, paths };
if (require.main === module) main(process.argv.slice(2));
