// LinkedIn carousel: slide model, article URL, deck hash and the generator's skip logic.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const model = require('../../scripts/carousel/model');
const { carousel, paths } = require('../../scripts/carousel');
const { carded } = require('../../scripts/narrate');
const { CARDED_FILE, cards } = require('../helpers');

const ROOT = path.resolve(__dirname, '../..');
const article = (rel = CARDED_FILE) => model.loadArticle(path.join(ROOT, rel), ROOT);
const insightCount = cards.insights.length;
const defaultOrder = cards.default_order || cards.insights.map((i) => i.id);

// A temp site root holding one carded article (with its art, if any) and _config.yml.
function tmpRoot(rel = CARDED_FILE) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'carousel-test-'));
  fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, rel), path.join(root, rel));
  fs.copyFileSync(path.join(ROOT, '_config.yml'), path.join(root, '_config.yml'));
  return root;
}
const stub = () => {
  const fn = async (slides) => { fn.calls++; return { pdf: Buffer.from('%PDF-stub'), pages: slides.length, fit: [] }; };
  fn.calls = 0;
  return fn;
};

test('slides are cover, insights in default_order, closing', () => {
  const s = model.buildSlides(article());
  assert.equal(s.length, insightCount + 2);
  assert.equal(s[0].kind, 'cover');
  assert.equal(s[s.length - 1].kind, 'closing');
  assert.deepEqual(s.slice(1, -1).map((x) => x.id), defaultOrder);
});

test('insight order follows default_order, falling back to file order', () => {
  const root = tmpRoot();
  const f = path.join(root, CARDED_FILE);
  const src = fs.readFileSync(f, 'utf8');
  const rev = [...defaultOrder].reverse();
  fs.writeFileSync(f, src.replace(/default_order: \[.*\]/, `default_order: [${rev.join(', ')}]`));
  assert.deepEqual(model.buildSlides(model.loadArticle(f, root)).slice(1, -1).map((x) => x.id), rev);
  fs.writeFileSync(f, src.replace(/\n\s*default_order: \[.*\]/, ''));
  assert.deepEqual(model.buildSlides(model.loadArticle(f, root)).slice(1, -1).map((x) => x.id), cards.insights.map((i) => i.id));
});

test('the situation card never appears', () => {
  const text = JSON.stringify(model.buildSlides(article()));
  assert.ok(!model.buildSlides(article()).some((s) => s.kind === 'situation'));
  assert.ok(!text.includes(cards.situation.prompt));
  for (const o of cards.situation.options) assert.ok(!text.includes(o.label));
});

test('counter matches the site: n/(insights+1), closing is last, cover has none', () => {
  const s = model.buildSlides(article());
  const T = insightCount + 1;
  assert.equal(s[0].n, undefined);
  s.slice(1, -1).forEach((x, k) => { assert.equal(x.n, k + 1); assert.equal(x.total, T); });
  assert.equal(s[s.length - 1].n, T);
  assert.equal(s[s.length - 1].total, T);
});

test('cover and closing content', () => {
  const a = article();
  const s = model.buildSlides(a);
  assert.equal(s[0].title, a.fm.title);
  assert.equal(s[0].hook, a.fm.description);
  assert.equal(s[0].readout, `TL;DR in ${insightCount + 1} cards`);
  assert.equal(s[0].byline, 'Rob Brown');
  const c = s[s.length - 1];
  assert.equal(c.knows, cards.terminal.knows);
  assert.equal(c.resolves, cards.terminal.resolves);
  assert.equal(c.url, 'https://robisit.com/thoughts/hello-world-cards/');
  assert.equal(c.follow, 'Follow Rob Brown on LinkedIn');
});

test('cover hook falls back to the card count when there is no description', () => {
  const root = tmpRoot();
  const f = path.join(root, CARDED_FILE);
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/^description:.*\n/m, ''));
  const s = model.buildSlides(model.loadArticle(f, root));
  assert.equal(s[0].hook, `TL;DR in ${insightCount + 1} cards`);
});

test('articleUrl honours permalink, site url and baseurl', () => {
  const a = article();
  assert.equal(model.articleUrl({ ...a, fm: { ...a.fm, permalink: '/x/y/' } }), 'https://robisit.com/x/y/');
  assert.equal(model.articleUrl({ ...a, site: { ...a.site, baseurl: '/blog' } }), 'https://robisit.com/blog/thoughts/hello-world-cards/');
  const post = { ...a, file: '/r/_posts/2026-01-02-hi.md', slug: 'hi' };
  assert.equal(model.articleUrl(post), 'https://robisit.com/2026/01/02/hi/');
});

test('text is stripped of YAML block-scalar newlines', () => {
  const root = tmpRoot();
  const f = path.join(root, CARDED_FILE);
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/^(\s+)title: "Hello, world: this is a test card"/m, '$1title: |\n$1  Padded title\n'));
  const s = model.buildSlides(model.loadArticle(f, root));
  assert.equal(s[1].title, 'Padded title');
});

test('art resolves to a repo file; a missing file throws naming it', () => {
  const sec = 'security-cost-of-hard-to-change-software';
  const s = model.buildSlides(article(`_articles/${sec}.md`));
  const withArt = s.filter((x) => x.art);
  assert.ok(withArt.length >= 1);
  for (const x of withArt) { assert.ok(path.isAbsolute(x.art)); assert.ok(fs.existsSync(x.art)); }
  const root = tmpRoot(`_articles/${sec}.md`); // art not copied
  assert.throws(() => model.buildSlides(model.loadArticle(path.join(root, `_articles/${sec}.md`), root)), /risk\.webp/);
});

test('art may not escape assets/', () => {
  const root = tmpRoot();
  const f = path.join(root, CARDED_FILE);
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/^(\s+)- id: hello\n/m, '$1- id: hello\n$1  art: /_config.yml\n'));
  assert.throws(() => model.buildSlides(model.loadArticle(f, root)), /outside assets/);
});

test('deckHash is stable and sensitive to every input', () => {
  const opts = { templateSource: 'tpl', version: 'v1' };
  const base = model.buildSlides(article());
  const h = model.deckHash(base, opts);
  assert.equal(model.deckHash(model.buildSlides(article()), opts), h);
  const clone = () => JSON.parse(JSON.stringify(base));
  const body = clone(); body[1].body += ' x';
  const order = clone(); [order[1], order[2]] = [order[2], order[1]];
  const term = clone(); term[term.length - 1].knows += ' x';
  const url = clone(); url[url.length - 1].url += 'z';
  for (const s of [body, order, term, url]) assert.notEqual(model.deckHash(s, opts), h);
  assert.notEqual(model.deckHash(base, { ...opts, version: 'v2' }), h);
  assert.notEqual(model.deckHash(base, { ...opts, templateSource: 'tpl2' }), h);
});

test('deckHash changes with the art bytes', () => {
  const sec = 'security-cost-of-hard-to-change-software';
  const root = tmpRoot(`_articles/${sec}.md`);
  fs.cpSync(path.join(ROOT, 'assets/cards', sec), path.join(root, 'assets/cards', sec), { recursive: true });
  const build = () => model.buildSlides(model.loadArticle(path.join(root, `_articles/${sec}.md`), root));
  const h = model.deckHash(build(), { templateSource: 't' });
  fs.appendFileSync(path.join(root, 'assets/cards', sec, 'risk.webp'), 'x');
  assert.notEqual(model.deckHash(build(), { templateSource: 't' }), h);
});

test('carousel: processed, then skipped, force regenerates, dry-run and failure write nothing', async () => {
  const root = tmpRoot();
  const slug = 'hello-world-cards';
  const p = paths(root, slug);
  const render = stub();
  const dry = await carousel(slug, { root, render, dryRun: true });
  assert.equal(dry.status, 'would generate');
  assert.ok(!fs.existsSync(p.pdf));
  const a = await carousel(slug, { root, render });
  assert.equal(a.status, 'processed');
  assert.ok(fs.existsSync(p.pdf) && fs.existsSync(p.json));
  assert.equal(render.calls, 1);
  assert.equal((await carousel(slug, { root, render })).status, 'skipped');
  assert.equal(render.calls, 1);
  assert.equal((await carousel(slug, { root, render, force: true })).status, 'processed');
  assert.equal(render.calls, 2);
  fs.rmSync(p.pdf);
  assert.equal((await carousel(slug, { root, render })).status, 'processed'); // pdf missing
  // A changed deck would regenerate; dry-run reports it without writing.
  const f = path.join(root, CARDED_FILE);
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('Hello! Which', 'Hello! Which').replace('the whole test deck', 'the whole changed deck'));
  const before = fs.readFileSync(p.json, 'utf8');
  assert.equal((await carousel(slug, { root, render, dryRun: true })).status, 'would generate');
  assert.equal(fs.readFileSync(p.json, 'utf8'), before);
  const root2 = tmpRoot();
  const bad = await carousel(slug, { root: root2, render: async () => { throw new Error('boom'); } });
  assert.equal(bad.status, 'failed');
  assert.match(bad.note, /boom/);
  assert.ok(!fs.existsSync(paths(root2, slug).pdf) && !fs.existsSync(paths(root2, slug).json));
});

test('every carded article builds a model', () => {
  const slugs = carded(ROOT);
  assert.ok(slugs.length >= 1);
  const { findPost } = require('../../scripts/narrate');
  for (const slug of slugs) {
    const s = model.buildSlides(model.loadArticle(findPost(slug, ROOT), ROOT));
    assert.ok(s.length >= 7 && s.length <= 10, slug);
  }
});
