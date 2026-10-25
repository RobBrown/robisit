/* Narration segmentation for Insight Cards. Pure functions, no network.
 *
 *   rendered HTML  ->  text  ->  sentences  ->  phrases (2 to 5 words)
 *                                           ->  SSML with one <mark> per phrase
 *                                           ->  HTML fragment with one span per phrase
 *
 * The input is a card's title or body exactly as _includes/insight-cards.html
 * renders it. Phrases are character ranges over the decoded text, so the
 * fragment wraps the original markup and its visible text never changes.
 * Bump SEGMENTATION_VERSION whenever output for the same input can change:
 * it is part of every card's cache key.
 */
'use strict';

const SEGMENTATION_VERSION = 'v1';

/* ---------- Rendering, as the include does it ---------- */

// Liquid's `escape` filter (CGI.escapeHTML): the include's plain render.
function liquidEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Liquid's `strip` (Ruby String#strip): ASCII whitespace and NUL only.
function liquidStrip(s) {
  return String(s).replace(/^[ \t\n\v\f\r\0]+|[ \t\n\v\f\r\0]+$/g, '');
}
// What the include renders inside .ic-title and .ic-body.
function renderTitle(title) { return liquidEscape(title); }
function renderBody(body) { return liquidEscape(liquidStrip(body)); }

/* ---------- HTML to text ---------- */

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–',
  hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };

function decodeEntity(raw) {
  const m = /^&(#x[0-9a-f]+|#\d+|[a-z]+);$/i.exec(raw);
  if (!m) return raw;
  const e = m[1];
  if (e[0] === '#') {
    const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return String.fromCodePoint(cp);
  }
  return NAMED[e.toLowerCase()] !== undefined ? NAMED[e.toLowerCase()] : raw;
}

/* Splits inline HTML into tag tokens and text tokens. Each text token keeps
   its characters as { ch, raw } pairs: the decoded character and the source
   it came from (an entity, or the character itself). Tags are not text, so
   link URLs (in href) are dropped and link text is kept. A <br> reads as a
   space but contributes nothing to the output. */
function tokenize(html) {
  const tokens = [];
  const re = /<!--[\s\S]*?-->|<[^>]*>|[^<]+/g;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[0];
    if (raw[0] !== '<') {
      const chars = [];
      const cre = /&(?:#x[0-9a-f]+|#\d+|[a-z]+);|[\s\S]/gi;
      let c;
      while ((c = cre.exec(raw))) {
        const ch = decodeEntity(c[0]);
        // A decoded astral character is two UTF-16 units; keep the raw on the first.
        for (let i = 0; i < ch.length; i++) chars.push({ ch: ch[i], raw: i === 0 ? c[0] : '' });
      }
      tokens.push({ type: 'text', raw, chars });
    } else if (/^<br\b/i.test(raw)) {
      tokens.push({ type: 'tag', raw, chars: [{ ch: ' ', raw: '', virtual: true }] });
    } else {
      tokens.push({ type: 'tag', raw });
    }
  }
  return tokens;
}

// The narration text of rendered HTML: markup stripped, reading order kept.
function extractText(html) {
  return tokenize(html).flatMap((t) => t.chars || []).map((c) => c.ch).join('');
}

/* ---------- Text to phrases ---------- */

const ABBREVIATIONS = new Set(['e.g.', 'i.e.', 'etc.', 'vs.', 'cf.', 'approx.', 'mr.', 'mrs.', 'ms.', 'dr.', 'prof.',
  'st.', 'jr.', 'sr.', 'inc.', 'ltd.', 'co.', 'corp.', 'no.', 'fig.', 'a.m.', 'p.m.', 'u.s.', 'u.k.', 'e.u.']);
const UNITS = new Set(['%', 'percent', 'ms', 's', 'sec', 'secs', 'second', 'seconds', 'min', 'mins', 'minute', 'minutes',
  'h', 'hr', 'hrs', 'hour', 'hours', 'day', 'days', 'week', 'weeks', 'month', 'months', 'year', 'years',
  'b', 'kb', 'mb', 'gb', 'tb', 'bytes', 'hz', 'khz', 'mhz', 'ghz', 'px', 'pt', 'em', 'rem',
  'mm', 'cm', 'm', 'km', 'g', 'kg', 'mi', 'ft', 'in', 'x', 'k', 'million', 'billion', 'trillion', 'thousand',
  'words', 'word', 'people', 'users', 'engineers', 'teams', 'times', 'a.m.', 'p.m.', 'usd', 'eur', 'gbp']);
const CONJUNCTIONS = new Set(['and', 'but', 'or', 'nor', 'yet', 'so']);
const PREPOSITIONS = new Set(['about', 'above', 'across', 'after', 'against', 'along', 'among', 'around', 'as', 'at',
  'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond', 'by', 'despite', 'down', 'during', 'except',
  'for', 'from', 'in', 'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto', 'out', 'outside', 'over', 'past',
  'per', 'since', 'than', 'through', 'throughout', 'till', 'to', 'toward', 'towards', 'under', 'underneath', 'until',
  'unlike', 'up', 'upon', 'via', 'with', 'within', 'without']);
const DETERMINERS = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'its', 'their', 'his', 'her', 'our',
  'your', 'my', 'each', 'every', 'which', 'who', 'whose', 'where', 'when', 'because', 'if', 'while']);
// Words that should never end a phrase: they lean on the next word.
const LEANERS = new Set(['the', 'a', 'an', 'to', 'of', 'its', 'their', 'his', 'her', 'our', 'your', 'my',
  'and', 'but', 'or', 'nor', 'when', 'that', 'which', 'who', 'if', 'because', 'while']);
// Capitalised only because they start a sentence, so they never start a name.
const STARTERS = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'it', 'its', 'if', 'when', 'while', 'so',
  'but', 'and', 'or', 'i', 'we', 'you', 'they', 'he', 'she', 'there', 'here', 'each', 'every', 'some', 'any', 'no',
  'not', 'do', 'does', 'is', 'are', 'was', 'what', 'why', 'how', 'where', 'who', 'which', 'one', 'all', 'most', 'many']);

const OPENERS = /^[\p{Ps}\p{Pi}"'*_]+/u;
const CLOSERS = /[\p{Pe}\p{Pf}"'*_]+$/u;
const bare = (w) => w.replace(OPENERS, '').replace(CLOSERS, '');
const lower = (w) => bare(w).replace(/[.,;:!?…]+$/, '').toLowerCase();
const counts = (w) => /[\p{L}\p{N}]/u.test(w);              // punctuation-only tokens are not words
const isCapitalised = (w) => /^\p{Lu}/u.test(bare(w));
const isNumber = (w) => /^[$€£]?\d[\d,.]*%?$/.test(bare(w).replace(/[,;:]$/, ''));

function isAbbreviation(w) {
  const b = bare(w).toLowerCase();
  return ABBREVIATIONS.has(b) || /^(?:\p{L}\.){2,}$/u.test(b) || /^\p{Lu}\.$/u.test(bare(w));
}
function endsSentence(w) {
  return /[.!?…]$/.test(w.replace(CLOSERS, '')) && !isAbbreviation(w);
}
function endsClause(w) {
  return /[,;:—–]$/.test(w.replace(CLOSERS, '')) || w === '-';
}

// Words with their character offsets in the text.
function words(text) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text))) out.push({ w: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

function sentences(ws) {
  const out = [];
  let cur = [];
  ws.forEach((w, i) => {
    cur.push(w);
    if (endsSentence(w.w) || i === ws.length - 1) { out.push(cur); cur = []; }
  });
  return out;
}

/* Atoms are the units a phrase boundary can never fall inside: a word (so a
   hyphenated term or an abbreviation stays whole), a number with its unit, a
   capitalised multi-word name, and any punctuation-only token, which leans on
   the word before it. */
function atoms(sentence) {
  const out = [];
  sentence.forEach((w, i) => {
    const prev = out[out.length - 1];
    const pw = prev && prev.words[prev.words.length - 1];
    const joins = prev && (
      !counts(w.w)
      || !counts(pw.w)
      || (isNumber(pw.w) && !endsClause(pw.w) && UNITS.has(lower(w.w)))
      || (isCapitalised(pw.w) && isCapitalised(w.w) && !endsClause(pw.w)
          && (!/[.!?]$/.test(bare(pw.w)) || isAbbreviation(pw.w))
          && !(prev.words.length === 1 && i === 1 && STARTERS.has(lower(pw.w))))
    );
    if (joins) prev.words.push(w);
    else out.push({ words: [w] });
  });
  for (const a of out) {
    a.n = a.words.filter((w) => counts(w.w)).length;
    a.start = a.words[0].start;
    a.end = a.words[a.words.length - 1].end;
    a.first = lower(a.words[0].w);
    a.last = lower(a.words[a.words.length - 1].w);
  }
  return out;
}

const size = (run) => run.reduce((s, a) => s + a.n, 0);

// Runs: atoms between clause punctuation (, ; : and dashes) or sentence ends.
function runsOf(sentAtoms) {
  const runs = [];
  let cur = [];
  sentAtoms.forEach((a, i) => {
    cur.push(a);
    const lastWord = a.words[a.words.length - 1].w;
    if (endsClause(lastWord) || i === sentAtoms.length - 1) { runs.push(cur); cur = []; }
  });
  return runs;
}

/* Splits a run of more than five words. Every split into 2-to-5-word chunks is
   scored and the cheapest wins:
   - chunk count near words/3, and chunk sizes near the mean (even phrases);
   - a break before a conjunction or preposition is free, before a determiner
     costs 0.5, anywhere else 1;
   - a chunk ending on a word that leans on the next ("the", "to", "and")
     costs 1.5, and on any other preposition 0.75.
   With these weights the spec's example splits as given:
   "AI is changing | the relationship between | users and software." */
function split(run) {
  const n = size(run);
  if (n <= 5) return [run];
  const target = Math.round(n / 3);
  let best = null;
  for (let k = Math.max(1, Math.ceil(n / 5)); k <= Math.floor(n / 2); k++) {
    const mean = n / k;
    const memo = new Map();
    // cost of covering run[i..] with m chunks
    const go = (i, m) => {
      if (i === run.length) return m === 0 ? { cost: 0, cuts: [] } : null;
      if (m === 0) return null;
      const key = i * 100 + m;
      if (memo.has(key)) return memo.get(key);
      let res = null;
      let len = 0;
      for (let j = i; j < run.length; j++) {
        len += run[j].n;
        if (len > 5 && j > i) break;
        if (len < 2 && j < run.length - 1) continue;
        const rest = go(j + 1, m - 1);
        if (!rest) continue;
        let c = (len - mean) ** 2 + (len < 2 || len > 5 ? 100 : 0);
        if (j + 1 < run.length) {
          const nx = run[j + 1].first;
          c += CONJUNCTIONS.has(nx) || PREPOSITIONS.has(nx) ? 0 : DETERMINERS.has(nx) ? 0.5 : 1;
          if (LEANERS.has(run[j].last)) c += 1.5;
          else if (PREPOSITIONS.has(run[j].last)) c += 0.75;
        }
        const total = c + rest.cost;
        if (!res || total < res.cost - 1e-9) res = { cost: total, cuts: [j + 1, ...rest.cuts] };
      }
      memo.set(key, res);
      return res;
    };
    const r = go(0, k);
    if (!r) continue;
    const cost = r.cost + 2 * Math.abs(k - target);
    if (!best || cost < best.cost - 1e-9) best = { cost, cuts: r.cuts };
  }
  if (!best) return [run]; // a single atom longer than five words: never split inside it
  const chunks = [];
  let from = 0;
  for (const to of best.cuts) { chunks.push(run.slice(from, to)); from = to; }
  return chunks;
}

/* Phrases of one text (a title or a body): [{ text, start, end }] with
   character offsets into `text`. A one-word run joins its neighbour (the next
   one if there is one), and the result is re-split if that made it too long. */
function phrasesOf(text) {
  const runs = sentences(words(text)).flatMap((s) => runsOf(atoms(s)));
  for (let i = 0; i < runs.length; i++) {
    if (runs.length > 1 && size(runs[i]) < 2) {
      if (i < runs.length - 1) { runs[i + 1] = runs[i].concat(runs[i + 1]); runs.splice(i, 1); i--; }
      else { runs[i - 1] = runs[i - 1].concat(runs[i]); runs.splice(i, 1); }
    }
  }
  return runs.flatMap(split).map((chunk) => {
    const start = chunk[0].start, end = chunk[chunk.length - 1].end;
    return { text: text.slice(start, end).replace(/\s+/g, ' '), start, end };
  });
}

/* A card's phrases, title first. ids run p0, p1, ... across both parts. */
function segmentCard(titleHtml, bodyHtml) {
  const parts = { title: extractText(titleHtml), body: extractText(bodyHtml) };
  const phrases = [];
  for (const part of ['title', 'body']) {
    for (const p of phrasesOf(parts[part])) phrases.push({ id: `p${phrases.length}`, part, ...p });
  }
  return { text: parts, phrases };
}

/* ---------- SSML ---------- */

function xmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

// Title, a 500 ms pause, then the body. A mark before every phrase.
function buildSsml(phrases) {
  const part = (name) => phrases.filter((p) => p.part === name)
    .map((p) => `<mark name="${xmlEscape(p.id)}"/>${xmlEscape(p.text)}`).join(' ');
  return `<speak>${part('title')}<break time="500ms"/>${part('body')}</speak>`;
}

/* ---------- Phrase fragment ---------- */

/* Wraps each phrase of one part in <span data-phrase="pN">. Tags pass through
   untouched, so a phrase that crosses an inline element boundary becomes two
   spans with the same id. Whitespace between phrases stays outside spans. */
function wrapPhrases(html, phrases) {
  const owner = [];
  phrases.forEach((p) => { for (let i = p.start; i < p.end; i++) owner[i] = p.id; });
  let out = '', g = 0;
  for (const t of tokenize(html)) {
    if (t.type === 'tag') { out += t.raw; g += t.chars ? t.chars.length : 0; continue; }
    let open = null;
    for (const c of t.chars) {
      const id = owner[g++] || null;
      if (id !== open) {
        if (open) out += '</span>';
        if (id) out += `<span data-phrase="${id}">`;
        open = id;
      }
      out += c.raw;
    }
    if (open) out += '</span>';
  }
  return out;
}

// Separates the title and body halves of a card's fragment file.
const FRAGMENT_SEPARATOR = '<!--ic-body-->';

function buildFragment(titleHtml, bodyHtml, phrases) {
  return wrapPhrases(titleHtml, phrases.filter((p) => p.part === 'title'))
    + FRAGMENT_SEPARATOR
    + wrapPhrases(bodyHtml, phrases.filter((p) => p.part === 'body'));
}

// The text a browser shows for an HTML string (tags removed, entities decoded).
function visibleText(html) {
  return tokenize(html).filter((t) => t.type === 'text').flatMap((t) => t.chars).map((c) => c.ch).join('');
}

module.exports = {
  SEGMENTATION_VERSION, FRAGMENT_SEPARATOR,
  liquidEscape, liquidStrip, renderTitle, renderBody,
  tokenize, extractText, visibleText, words, sentences, atoms, phrasesOf, segmentCard,
  xmlEscape, buildSsml, wrapPhrases, buildFragment,
};
