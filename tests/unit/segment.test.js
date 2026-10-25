// Narration segmentation, SSML and phrase fragments. Run with `npm run test:unit`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const seg = require('../../scripts/narration/segment');
const { cards } = require('../helpers');

const texts = (s) => seg.phrasesOf(s).map((p) => p.text);
const wordCount = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

test('the spec example splits as given', () => {
  assert.deepEqual(texts('AI is changing the relationship between users and software.'),
    ['AI is changing', 'the relationship between', 'users and software.']);
});

test('extraction strips markup, keeps link text, drops URLs, keeps reading order', () => {
  const html = 'Read <a href="https://example.com/x?y=1">the <em>full</em> guide</a> and <strong>then</strong> act.';
  assert.equal(seg.extractText(html), 'Read the full guide and then act.');
  assert.ok(!seg.extractText(html).includes('example.com'));
});

test('extraction decodes entities the include writes', () => {
  assert.equal(seg.extractText(seg.renderBody(`  Tom & Jerry's "<b>" \n`)), `Tom & Jerry's "<b>"`);
  assert.equal(seg.extractText('a&nbsp;b &#8212; c &#x2019;'), 'a b — c ’');
});

test('the include render matches Liquid escape and strip', () => {
  assert.equal(seg.renderTitle(`A & B < C > "D" 'E'`), 'A &amp; B &lt; C &gt; &quot;D&quot; &#39;E&#39;');
  assert.equal(seg.renderBody('\n  body text\n\n'), 'body text');
  assert.equal(seg.liquidStrip(' x '), ' x '); // Ruby strip leaves NBSP
});

test('sentences split at terminal punctuation, not at abbreviations or decimals', () => {
  const s = seg.sentences(seg.words('Use tools, e.g. linters. It cost $3.50 in 2026! Done? Yes.'));
  assert.deepEqual(s.map((x) => x.map((w) => w.w).join(' ')), ['Use tools, e.g. linters.', 'It cost $3.50 in 2026!', 'Done?', 'Yes.']);
});

test('every phrase is two to five words', () => {
  const samples = [
    ...cards.insights.flatMap((c) => [c.title, c.body]),
    'A migration has a source, a target, and an end date. AI adoption has none of these. It changes how engineering work is done, and that change compounds instead of completing.',
    'Fund it as an operating change: a budget line that persists, owners who stay, and metrics reviewed every quarter for years.',
    'Go. Then stop, wait, and think about the consequences of everything you did before lunch today.',
  ];
  for (const s of samples) {
    for (const p of texts(s)) {
      const n = wordCount(p);
      assert.ok(n >= 2 && n <= 5, `"${p}" has ${n} words (from "${s.slice(0, 40)}…")`);
    }
  }
});

test('commas, semicolons and colons break first', () => {
  assert.deepEqual(texts('Plan the work; work the plan: then ship, and rest.'),
    ['Plan the work;', 'work the plan:', 'then ship,', 'and rest.']);
});

test('long runs break before conjunctions and prepositions', () => {
  const p = texts('Teams adopt tools quickly and governance arrives much later than anyone expects');
  assert.ok(p.some((x) => /^and /.test(x)) || p.some((x) => /^than /.test(x)), p.join(' | '));
  for (const x of p) assert.ok(wordCount(x) <= 5, x);
});

const together = (s, needle) => texts(s).some((p) => p.includes(needle));

test('never splits a hyphenated term', () => {
  for (const s of ['We wrote a state-of-the-art system for the long-running batch jobs today.',
    'Each card is written close to the ninety-word ceiling so the deck can be checked.']) {
    for (const w of s.match(/\S+-\S+/g)) assert.ok(together(s, w), `${w} in ${texts(s).join(' | ')}`);
  }
});

test('never splits a number from its unit', () => {
  for (const [s, n] of [['The deck adds no more than 10 KB of compressed code to every page.', '10 KB'],
    ['Each card takes about 30 seconds to read out loud for most of the readers.', '30 seconds'],
    ['Budgets grew by 40 percent across all of the teams we surveyed last year.', '40 percent'],
    ['The model saved $5 million in its first year of production use at scale.', '$5 million']]) {
    assert.ok(together(s, n), `${n}: ${texts(s).join(' | ')}`);
  }
});

test('never splits an abbreviation or breaks a sentence at one', () => {
  const s = 'Pick one metric, e.g. lead time for changes in the U.S. offices, and review it every quarter.';
  assert.ok(texts(s).some((p) => /\be\.g\./.test(p)));
  assert.ok(together(s, 'U.S.'));
  assert.equal(seg.sentences(seg.words(s)).length, 1);
});

test('never splits a capitalised multi-word name', () => {
  for (const [s, n] of [['This page exists to test the Insight Cards feature on robisit.com.', 'Insight Cards'],
    ['We moved the whole pipeline onto Google Cloud Text-to-Speech last spring.', 'Google Cloud Text-to-Speech'],
    ['The pilot at Meridian Health Partners stalled in the second movement.', 'Meridian Health Partners'],
    ['After review the New York office kept the old process for a while.', 'New York']]) {
    assert.ok(together(s, n), `${n}: ${texts(s).join(' | ')}`);
  }
  // A sentence-initial word is not taken for part of a name.
  assert.ok(!texts('The Insight Cards feature shipped on time this week.').includes('The Insight Cards'));
});

test('phrase offsets point back into the source text', () => {
  const s = 'Swipe sideways to move between cards.\n  On a laptop, use the arrow keys.';
  for (const p of seg.phrasesOf(s)) assert.equal(s.slice(p.start, p.end).replace(/\s+/g, ' '), p.text);
});

test('SSML escapes &, <, >, and quotes', () => {
  const { phrases } = seg.segmentCard(seg.renderTitle('Fish & chips < tea'), seg.renderBody(`He said "yes" and 'no' > maybe.`));
  const ssml = seg.buildSsml(phrases);
  assert.ok(ssml.includes('Fish &amp; chips'));
  assert.ok(ssml.includes('&lt; tea'));
  assert.ok(ssml.includes('&quot;yes&quot;'));
  assert.ok(ssml.includes('&apos;no&apos;'));
  assert.ok(ssml.includes('&gt; maybe.'));
  assert.ok(!/[<>](?![a-z/!])/.test(ssml.replace(/<\/?[a-z][^>]*>/g, '')), 'no raw < or > in text');
});

test('SSML: title, a 500 ms break, body; a mark before every phrase', () => {
  const c = cards.insights[0];
  const { phrases } = seg.segmentCard(seg.renderTitle(c.title), seg.renderBody(c.body));
  const ssml = seg.buildSsml(phrases);
  assert.match(ssml, /^<speak><mark name="p0"\/>/);
  assert.equal((ssml.match(/<break time="500ms"\/>/g) || []).length, 1);
  const titleCount = phrases.filter((p) => p.part === 'title').length;
  const [title, body] = ssml.split('<break time="500ms"/>');
  assert.equal((title.match(/<mark /g) || []).length, titleCount);
  assert.equal((body.match(/<mark /g) || []).length, phrases.length - titleCount);
  assert.match(body, /^<mark name="p\d+"\/>/);
});

test('mark names are unique and ordered', () => {
  for (const c of cards.insights) {
    const { phrases } = seg.segmentCard(seg.renderTitle(c.title), seg.renderBody(c.body));
    const names = [...seg.buildSsml(phrases).matchAll(/<mark name="([^"]+)"\/>/g)].map((m) => m[1]);
    assert.deepEqual(names, phrases.map((_, i) => `p${i}`));
    assert.equal(new Set(names).size, names.length);
  }
});

test('fragment text equals the plain render text for every card in the test article', () => {
  for (const c of cards.insights) {
    const t = seg.renderTitle(c.title), b = seg.renderBody(c.body);
    const { phrases } = seg.segmentCard(t, b);
    const [ft, fb] = seg.buildFragment(t, b, phrases).split(seg.FRAGMENT_SEPARATOR);
    assert.equal(ft.replace(/<\/?span[^>]*>/g, ''), t, `${c.id} title bytes`);
    assert.equal(fb.replace(/<\/?span[^>]*>/g, ''), b, `${c.id} body bytes`);
    assert.equal(seg.visibleText(fb), seg.visibleText(b));
    // Every phrase is wrapped, in order, and nothing else is.
    const ids = [...(ft + fb).matchAll(/data-phrase="(p\d+)"/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(ids)], phrases.map((p) => p.id));
  }
});

test('links and emphasis survive wrapping; a phrase crossing a boundary splits into same-id spans', () => {
  const html = 'Read <a href="/guide">the full guide</a> and <em>then act on it</em> today.';
  const { phrases } = seg.segmentCard('Title words here', html);
  const frag = seg.wrapPhrases(html, phrases.filter((p) => p.part === 'body'));
  assert.equal(frag.replace(/<\/?span[^>]*>/g, ''), html);
  assert.match(frag, /<a href="\/guide">/);
  assert.match(frag, /<em>/);
  // Spans never straddle a tag: each span's content has no markup.
  for (const m of frag.matchAll(/<span data-phrase="[^"]+">([^]*?)<\/span>/g)) assert.ok(!/[<>]/.test(m[1]), m[0]);
  const byId = {};
  for (const m of frag.matchAll(/<span data-phrase="([^"]+)">/g)) byId[m[1]] = (byId[m[1]] || 0) + 1;
  assert.ok(Object.values(byId).some((n) => n > 1), `expected a split phrase in ${frag}`);
});

test('segmentation is deterministic and versioned', () => {
  assert.match(seg.SEGMENTATION_VERSION, /^v\d+$/);
  const c = cards.insights[1];
  const a = seg.segmentCard(seg.renderTitle(c.title), seg.renderBody(c.body));
  const b = seg.segmentCard(seg.renderTitle(c.title), seg.renderBody(c.body));
  assert.deepEqual(a, b);
  assert.ok(!/require\(['"](https?|net|dns)/.test(require('fs').readFileSync(path.join(__dirname, '../../scripts/narration/segment.js'), 'utf8')));
});
