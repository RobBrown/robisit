#!/usr/bin/env node
/* Generates read-aloud narration for one carded post's insight cards.
 *
 *   npm run narrate -- <post-slug> [--only <cardId>] [--force] [--dry-run]
 *
 * For each insight card it writes, under the post's slug:
 *   assets/narration/<slug>/<cardId>.mp3    audio (MP3, mono, 24 kHz)
 *   assets/narration/<slug>/<cardId>.json   metadata: hash, voice, phrase timings
 *   _includes/narration/<slug>/<cardId>.html  title and body with phrase spans
 *
 * A card is skipped when its metadata hash matches and its audio exists, so
 * re-running on unchanged cards makes no API calls. A missing or outdated
 * fragment on a skipped card is rebuilt locally; it needs no audio. Every phrase
 * start comes from Google's timepoints and is validated against the measured
 * audio duration; on any violation nothing is written for that card.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const config = require('./narration/config');
const seg = require('./narration/segment');
const timing = require('./narration/timing');

const ROOT = path.resolve(__dirname, '..');
const COLLECTION_DIRS = ['_articles', '_posts'];

function findPost(slug, root) {
  for (const dir of COLLECTION_DIRS) {
    const d = path.join(root, dir);
    if (!fs.existsSync(d)) continue;
    // Jekyll posts carry a date prefix; collection documents do not.
    const f = fs.readdirSync(d).find((n) => n.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.(md|markdown)$/, '') === slug);
    if (f) return path.join(d, f);
  }
  return null;
}

function loadCards(file) {
  const src = fs.readFileSync(file, 'utf8');
  const m = /^---\s*\n([\s\S]*?)\n---\s*$/m.exec(src);
  const fm = m ? yaml.load(m[1]) : null;
  return fm && fm.cards && Array.isArray(fm.cards.insights) ? fm.cards : null;
}

const paths = (root, slug, id) => ({
  mp3: path.join(root, 'assets/narration', slug, `${id}.mp3`),
  json: path.join(root, 'assets/narration', slug, `${id}.json`),
  html: path.join(root, '_includes/narration', slug, `${id}.html`),
  url: `/assets/narration/${slug}/${id}.mp3`,
});

/* Everything for one card that needs no network: phrases, SSML, fragment, key. */
function prepare(card, opts) {
  const titleHtml = seg.renderTitle(card.title), bodyHtml = seg.renderBody(card.body);
  const { phrases } = seg.segmentCard(titleHtml, bodyHtml);
  const fragment = seg.buildFragment(titleHtml, bodyHtml, phrases);
  const [ft, fb] = fragment.split(seg.FRAGMENT_SEPARATOR);
  if (seg.visibleText(ft) !== seg.visibleText(titleHtml) || seg.visibleText(fb) !== seg.visibleText(bodyHtml)) {
    throw new timing.NarrationError('phrase fragment text differs from the plain render');
  }
  const hash = timing.cardHash({ title: card.title, body: card.body, voice: opts.voice, outputFormat: opts.outputFormat,
    segmentation: seg.SEGMENTATION_VERSION });
  return { phrases, ssml: seg.buildSsml(phrases), fragment, hash };
}

// Jekyll renders includes as Liquid, so the fragment is wrapped in raw tags.
const fragmentFile = (fragment) => `{% raw %}${fragment}{% endraw %}`;

function isCurrent(p, hash) {
  if (!fs.existsSync(p.json) || !fs.existsSync(p.mp3)) return false;
  try { return JSON.parse(fs.readFileSync(p.json, 'utf8')).hash === hash; } catch (e) { return false; }
}

// Writes each file beside its target, then renames, so a card is never half-written.
function writeAll(files) {
  const tmp = files.map(([f, data]) => {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const t = `${f}.tmp-${process.pid}`;
    fs.writeFileSync(t, data);
    return [t, f];
  });
  for (const [t, f] of tmp) fs.renameSync(t, f);
}

function setupHelp(check) {
  return `# Narration setup

\`npm run narrate\` stopped at the credentials checkpoint (step: \`${check.step}\`):

    ${check.message}

Run these once, then run \`npm run narrate -- <post-slug>\` again. No key file
or API key is needed: the script uses Application Default Credentials.

    gcloud auth application-default login
    gcloud auth application-default set-quota-project <PROJECT_ID>
    gcloud services enable texttospeech.googleapis.com --project <PROJECT_ID>

Your account needs permission to call the API on that project, and to use it
as the quota project. On a project you own, that is already true. Otherwise:

    gcloud projects add-iam-policy-binding <PROJECT_ID> \\
      --member="user:<YOUR_EMAIL>" --role="roles/serviceusage.serviceUsageConsumer"
`;
}

function table(rows) {
  const head = ['card', 'status', 'chars', 'ssml chars', 'phrases', 'duration', 'note'];
  const data = rows.map((r) => [r.id, r.status, String(r.chars), String(r.ssmlChars), String(r.phrases),
    r.duration ? `${r.duration.toFixed(2)} s` : '', r.note || '']);
  const w = head.map((h, i) => Math.max(h.length, ...data.map((d) => d[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(w[i])).join('  ').trimEnd();
  return [line(head), line(w.map((n) => '-'.repeat(n))), ...data.map(line)].join('\n');
}

async function narrate(slug, opts = {}) {
  const root = opts.root || ROOT;
  const voice = opts.voice || config.voice, outputFormat = opts.outputFormat || config.outputFormat;
  const provider = opts.provider || require('./narration/synthesize');
  const log = opts.log || console.log;
  const file = findPost(slug, root);
  if (!file) throw new Error(`no post with slug "${slug}" in ${COLLECTION_DIRS.join(' or ')}`);
  const cards = loadCards(file);
  if (!cards) throw new Error(`${path.relative(root, file)} has no cards.insights block`);

  const rows = [];
  let checked = false, apiCalls = 0;
  for (const card of cards.insights) {
    if (opts.only && card.id !== opts.only) continue;
    const row = { id: card.id, chars: 0, ssmlChars: 0, phrases: 0 };
    rows.push(row);
    try {
      const prep = prepare(card, { voice, outputFormat });
      const p = paths(root, slug, card.id);
      row.chars = prep.phrases.reduce((s, x) => s + x.text.length, 0);
      row.ssmlChars = prep.ssml.length;
      row.phrases = prep.phrases.length;
      if (!opts.force && isCurrent(p, prep.hash)) {
        row.status = 'skipped';
        row.note = 'unchanged';
        // The fragment depends only on the text, so it can be rebuilt without a call.
        const html = fragmentFile(prep.fragment);
        if (!fs.existsSync(p.html) || fs.readFileSync(p.html, 'utf8') !== html) { writeAll([[p.html, html]]); row.note = 'unchanged; fragment rewritten'; }
        continue;
      }
      if (opts.dryRun) { row.status = 'would generate'; continue; }
      if (!checked) {
        const check = await provider.checkCredentials(voice);
        if (!check.ok) {
          fs.writeFileSync(path.join(root, 'SETUP.md'), setupHelp(check));
          throw Object.assign(new Error(`credentials checkpoint failed (${check.step}): ${check.message}. See SETUP.md.`), { checkpoint: true });
        }
        checked = true;
      }
      apiCalls++;
      const { audioBuffer, timepoints } = await provider.synthesize(prep.ssml, { voice, outputFormat });
      const info = timing.mp3Info(audioBuffer);
      timing.validateAudio(info, outputFormat);
      const starts = timing.parseTimepoints(timepoints, prep.phrases);
      const timed = timing.buildTimeline(prep.phrases, starts, info.duration);
      const meta = {
        cardId: card.id, hash: prep.hash, voice: voice.name, segmentation: seg.SEGMENTATION_VERSION,
        audio: p.url, duration: info.duration, phrases: timed,
      };
      writeAll([[p.mp3, audioBuffer], [p.html, fragmentFile(prep.fragment)], [p.json, `${JSON.stringify(meta, null, 2)}\n`]]);
      row.status = 'processed';
      row.duration = info.duration;
    } catch (e) {
      row.status = 'failed';
      row.note = e.message;
      if (e.checkpoint) { log(table(rows)); throw e; }
    }
  }
  log(table(rows));
  log(`${apiCalls} API call${apiCalls === 1 ? '' : 's'}; ${rows.filter((r) => r.status === 'processed').reduce((s, r) => s + r.ssmlChars, 0)} SSML characters sent.`);
  return { rows, apiCalls };
}

async function main(argv) {
  const opts = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') opts.only = argv[++i];
    else if (argv[i] === '--force') opts.force = true;
    else if (argv[i] === '--dry-run') opts.dryRun = true;
    else rest.push(argv[i]);
  }
  if (rest.length !== 1) { console.error('usage: npm run narrate -- <post-slug> [--only <cardId>] [--force] [--dry-run]'); process.exit(2); }
  try {
    const { rows } = await narrate(rest[0], opts);
    if (rows.some((r) => r.status === 'failed')) process.exit(1);
  } catch (e) {
    console.error(`narrate: ${e.message}`);
    process.exit(1);
  }
}

module.exports = { narrate, prepare, findPost, loadCards };
if (require.main === module) main(process.argv.slice(2));
