#!/usr/bin/env node
/* Validates every post's `cards` front matter against Insight Cards PRD 4.2.
 *
 *   node scripts/validate-cards.js [--root DIR] [--site BUILT_SITE_DIR]
 *
 * Problems are printed as GitHub Actions warning annotations. The exit code is
 * always 0: an invalid deck must never block publishing (PRD 4.3, 4.4). The
 * layout falls back to the plain article on its own (_includes/insight-cards-valid.html).
 *
 * Anchors are checked against the heading ids in the built HTML when --site
 * is given (CI builds the site first). Without it, ids are derived from the
 * Markdown with kramdown's GFM algorithm, which is what GitHub Pages runs.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const COLLECTION_DIRS = ['_articles', '_posts'];

// kramdown-parser-gfm's generate_gfm_header_id: lowercase, drop characters
// that are not word characters, hyphens or spaces, spaces to hyphens, then
// de-duplicate with -1, -2 suffixes.
function headingIdsFromMarkdown(src) {
  const body = src.replace(/^---[\s\S]*?\n---\s*\n/, '');
  const seen = {};
  const ids = [];
  let fenced = false;
  for (const line of body.split('\n')) {
    if (/^(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const text = m[2]
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links and images keep their text
      .replace(/[*`]/g, '');
    let id = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '').replace(/[ \t]/g, '-');
    if (id in seen) { seen[id] += 1; id = `${id}-${seen[id]}`; } else seen[id] = 0;
    ids.push(id);
  }
  return ids;
}

function headingIdsFromHtml(html) {
  return [...html.matchAll(/<h[1-6][^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
}

function builtFile(siteDir, collection, name) {
  const candidates = collection === '_articles'
    ? [path.join(siteDir, 'thoughts', name, 'index.html')]
    : [];
  return candidates.find((f) => fs.existsSync(f));
}

function lineOf(src, needle) {
  const i = src.indexOf(needle);
  return i < 0 ? 1 : src.slice(0, i).split('\n').length;
}

function validateCards(cards, headingIds) {
  const problems = [];
  const warn = (msg) => problems.push(msg);
  const isMap = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const str = (v) => typeof v === 'string' && v.trim() !== '';
  if (!isMap(cards)) return ['cards must be a mapping'];

  const insights = cards.insights;
  let ids = [];
  if (!Array.isArray(insights)) warn('insights is required and must be a list');
  else {
    if (insights.length < 5 || insights.length > 8) warn(`insights must have 5 to 8 entries (found ${insights.length})`);
    insights.forEach((ins, i) => {
      for (const f of ['id', 'title', 'body']) if (!isMap(ins) || !str(ins[f])) warn(`insights[${i}] is missing ${f}`);
    });
    ids = insights.map((i) => isMap(i) && i.id).filter(Boolean).map(String);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dup.length) warn(`insight ids must be unique: ${[...new Set(dup)].join(', ')}`);
  }

  if (!isMap(cards.terminal)) warn('terminal is required');
  else for (const f of ['knows', 'resolves']) if (!str(cards.terminal[f])) warn(`terminal is missing ${f}`);

  const checkOrder = (order, where) => {
    if (!Array.isArray(order)) return warn(`${where} must be a list of insight ids`);
    const o = order.map(String);
    const missing = ids.filter((id) => !o.includes(id));
    const unknown = o.filter((id) => !ids.includes(id));
    const twice = [...new Set(o.filter((id, i) => o.indexOf(id) !== i))];
    if (missing.length) warn(`${where} is missing: ${missing.join(', ')}`);
    if (unknown.length) warn(`${where} lists unknown ids: ${unknown.join(', ')}`);
    for (const id of twice) warn(`${where} lists ${id} more than once`);
  };

  const checkAnchor = (anchor, where) => {
    if (!str(anchor)) return warn(`${where} is required`);
    if (!anchor.startsWith('#')) return warn(`${where} must start with # (found ${anchor})`);
    if (headingIds.includes(anchor.slice(1))) return;
    const near = headingIds.find((h) => h.startsWith(anchor.slice(1)) || anchor.slice(1).startsWith(h));
    warn(`${where} ${anchor} does not match a heading id in the article${near ? ` (did you mean #${near}?)` : ''}`);
  };

  checkAnchor(cards.default_anchor, 'default_anchor');
  if (cards.default_order !== undefined) checkOrder(cards.default_order, 'default_order');

  if (cards.situation !== undefined) {
    const s = cards.situation;
    if (!isMap(s)) warn('situation must be a mapping');
    else {
      if (!str(s.prompt)) warn('situation is missing prompt');
      if (!Array.isArray(s.options) || s.options.length < 2 || s.options.length > 4) {
        warn(`situation.options must have 2 to 4 entries (found ${Array.isArray(s.options) ? s.options.length : 0})`);
      }
      (Array.isArray(s.options) ? s.options : []).forEach((o, i) => {
        const where = `situation.options[${i}]`;
        if (!isMap(o)) return warn(`${where} must be a mapping`);
        for (const f of ['id', 'label']) if (!str(o[f])) warn(`${where} is missing ${f}`);
        checkOrder(o.order, `${where}.order`);
        checkAnchor(o.anchor, `${where}.anchor`);
      });
    }
  }
  return problems;
}

function main(argv) {
  const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const root = path.resolve(arg('--root') || '.');
  const site = arg('--site') && path.resolve(arg('--site'));
  let carded = 0, invalid = 0;

  for (const dir of COLLECTION_DIRS) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter((x) => /\.(md|markdown)$/.test(x)).sort()) {
      const file = path.join(abs, f);
      const rel = path.relative(process.cwd(), file);
      const src = fs.readFileSync(file, 'utf8');
      const fm = /^---\s*\n([\s\S]*?)\n---\s*\n/.exec(src);
      if (!fm) continue;
      let data;
      try { data = yaml.load(fm[1]); } catch (e) {
        console.log(`::warning file=${rel},line=1::Front matter is not valid YAML: ${e.message.split('\n')[0]}`);
        continue;
      }
      if (!data || data.cards === undefined) continue;
      carded++;
      let ids;
      const html = site && builtFile(site, dir, path.basename(f).replace(/\.(md|markdown)$/, ''));
      if (html) ids = headingIdsFromHtml(fs.readFileSync(html, 'utf8'));
      else {
        if (site) console.log(`::notice file=${rel}::No built page found in ${arg('--site')}; checking anchors against ids derived from the Markdown`);
        ids = headingIdsFromMarkdown(src);
      }
      const problems = validateCards(data.cards, ids);
      if (problems.length) invalid++;
      const line = lineOf(src, '\ncards:') + 1;
      for (const p of problems) {
        console.log(`::warning file=${rel},line=${line},title=Insight Cards::${p}. This post will render without its card deck.`);
      }
    }
  }
  console.log(`Insight Cards: ${carded} carded post${carded === 1 ? '' : 's'}, ${carded - invalid} valid, ${invalid} with warnings.`);
}

module.exports = { validateCards, headingIdsFromMarkdown, headingIdsFromHtml };
if (require.main === module) main(process.argv.slice(2));
