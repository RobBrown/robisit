// Narration timing, validation, MP3 measurement, cache keys and the generator.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const timing = require('../../scripts/narration/timing');
const config = require('../../scripts/narration/config');
const { narrate } = require('../../scripts/narrate');
const { CARDED_FILE, cards } = require('../helpers');

const ROOT = path.resolve(__dirname, '../..');
const phrases = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, text: `phrase ${i}` }));
const tps = (times) => times.map((t, i) => (t === null ? { markName: `p${i}` } : { markName: `p${i}`, timeSeconds: t }));

/* A valid MPEG-2 layer III mono 24 kHz stream of `frames` frames (576 samples
   each), optionally led by an ID3 tag and an Info frame, as Google returns. */
function mp3(frames, { id3 = false, info = false, rate = 1, mode = 3 } = {}) {
  const header = Buffer.from([0xff, 0xf3, (8 << 4) | (rate << 2), mode << 6]); // 64 kbps
  const len = Math.floor(72 * 64000 / [22050, 24000, 16000][rate]);
  const frame = (tag) => { const f = Buffer.alloc(len); header.copy(f); if (tag) f.write(tag, 4 + 9, 'latin1'); return f; };
  const parts = [];
  if (id3) parts.push(Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 10]), Buffer.alloc(10));
  if (info) parts.push(frame('Info'));
  for (let i = 0; i < frames; i++) parts.push(frame());
  return Buffer.concat(parts);
}

test('mp3Info measures duration from frames, skipping ID3 and the Info frame', () => {
  const info = timing.mp3Info(mp3(1000, { id3: true, info: true }));
  assert.deepEqual(info, { frames: 1000, sampleRate: 24000, channels: 1, duration: 24 });
});

test('mp3Info agrees with ffprobe on real Google audio when available', (t) => {
  const f = path.join(ROOT, 'assets/narration/hello-world-cards', `${cards.insights[0].id}.mp3`);
  const probe = require('child_process').spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' });
  if (!fs.existsSync(f) || probe.status !== 0) return t.skip('no generated audio or no ffprobe');
  assert.ok(Math.abs(timing.mp3Info(fs.readFileSync(f)).duration - parseFloat(probe.stdout)) < 0.05);
});

test('mp3Info rejects a file with no audio frames', () => {
  assert.throws(() => timing.mp3Info(Buffer.from('not audio at all')), /no MP3 audio frames/);
});

test('validateAudio checks sample rate and channel count', () => {
  assert.doesNotThrow(() => timing.validateAudio(timing.mp3Info(mp3(10)), config.outputFormat));
  assert.throws(() => timing.validateAudio(timing.mp3Info(mp3(10, { rate: 0 })), config.outputFormat), /22050 Hz/);
  assert.throws(() => timing.validateAudio(timing.mp3Info(mp3(10, { mode: 0 })), config.outputFormat), /2 channels/);
});

test('parseTimepoints reads times in phrase order; a missing time is proto3 zero', () => {
  assert.deepEqual(timing.parseTimepoints(tps([null, 0.92, 2.05]), phrases(3)), [0, 0.92, 2.05]);
});

test('end of each phrase is the next start; the last ends at the measured duration', () => {
  const t = timing.buildTimeline(phrases(3), [0.015, 0.9217, 2.0525], 3.672);
  assert.deepEqual(t.map((p) => [p.start, p.end]), [[0.015, 0.922], [0.922, 2.053], [2.053, 3.672]]);
});

test('validation: timepoint count must equal phrase count', () => {
  assert.throws(() => timing.parseTimepoints(tps([0, 1]), phrases(3)), /count 2 does not equal phrase count 3/);
  assert.throws(() => timing.parseTimepoints(undefined, phrases(1)), /no timepoints/);
});

test('validation: mark names must match phrase ids in order', () => {
  assert.throws(() => timing.parseTimepoints([{ markName: 'p1', timeSeconds: 0 }, { markName: 'p0', timeSeconds: 1 }], phrases(2)), /expected "p0"/);
});

test('validation: times must be numeric, nonnegative and strictly increasing', () => {
  assert.throws(() => timing.parseTimepoints([{ markName: 'p0', timeSeconds: 'x' }], phrases(1)), /no numeric time/);
  assert.throws(() => timing.buildTimeline(phrases(2), [-0.1, 1], 3), /before 0/);
  assert.throws(() => timing.buildTimeline(phrases(3), [0, 1, 1], 3), /not after p1/);
  assert.throws(() => timing.buildTimeline(phrases(3), [0, 2, 1], 3), /not after p1/);
  // Equal after rounding to milliseconds is not strictly increasing either.
  assert.throws(() => timing.buildTimeline(phrases(2), [1.0001, 1.0002], 3), /not after/);
});

test('validation: the last phrase must start before the audio ends', () => {
  assert.throws(() => timing.buildTimeline(phrases(2), [0, 3.5], 3), /at or after the audio ends/);
  assert.throws(() => timing.buildTimeline(phrases(1), [0], 0), /not positive/);
});

test('validation: the last end must be within 0.5 s of the measured duration', () => {
  const t = timing.buildTimeline(phrases(2), [0, 1], 3);
  t[1].end = 2.4;
  assert.throws(() => timing.validateTimeline(t, 3), /more than 0.5 s/);
  t[1].end = 2.6;
  assert.doesNotThrow(() => timing.validateTimeline(t, 3));
});

test('hash changes with text, voice, format or segmentation version, and not otherwise', () => {
  const base = { title: 'T', body: 'B', voice: config.voice, outputFormat: config.outputFormat, segmentation: 'v1' };
  const h = timing.cardHash(base);
  assert.equal(timing.cardHash({ ...base }), h);
  assert.equal(timing.cardHash({ ...base, voice: { ...config.voice } }), h);
  for (const change of [{ title: 'T2' }, { body: 'B2' }, { voice: { ...config.voice, name: 'en-US-Neural2-A' } },
    { outputFormat: { ...config.outputFormat, sampleRateHertz: 22050 } }, { segmentation: 'v2' }]) {
    assert.notEqual(timing.cardHash({ ...base, ...change }), h, JSON.stringify(change));
  }
});

/* ---------- The generator, against a fake provider ---------- */

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'narrate-'));
  fs.mkdirSync(path.join(dir, '_articles'));
  fs.copyFileSync(path.join(ROOT, CARDED_FILE), path.join(dir, '_articles/hello-world-cards.md'));
  return dir;
}
// Returns a timepoint per <mark>, 0.3 s apart, and audio long enough to cover them.
function fakeProvider({ ok = true, mutate } = {}) {
  const calls = [];
  return {
    calls,
    checkCredentials: async () => (ok ? { ok: true } : { ok: false, step: 'adc', message: 'Could not load the default credentials' }),
    synthesize: async (ssml) => {
      calls.push(ssml);
      let timepoints = [...ssml.matchAll(/<mark name="([^"]+)"\/>/g)].map((m, i) => ({ markName: m[1], timeSeconds: 0.05 + i * 0.3 }));
      if (mutate) timepoints = mutate(timepoints);
      const frames = Math.ceil(((timepoints.length * 0.3) + 0.5) * 24000 / 576);
      return { audioBuffer: mp3(frames, { info: true }), timepoints };
    },
  };
}

test('narrate writes mp3, fragment and metadata per insight card; a re-run makes zero API calls', async () => {
  const dir = sandbox();
  const p = fakeProvider();
  const first = await narrate('hello-world-cards', { root: dir, provider: p, log: () => {} });
  assert.equal(first.apiCalls, cards.insights.length);
  for (const c of cards.insights) {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'assets/narration/hello-world-cards', `${c.id}.json`), 'utf8'));
    assert.equal(meta.cardId, c.id);
    assert.equal(meta.voice, config.voice.name);
    assert.equal(meta.audio, `/assets/narration/hello-world-cards/${c.id}.mp3`);
    assert.equal(meta.phrases[meta.phrases.length - 1].end, meta.duration);
    assert.ok(fs.existsSync(path.join(dir, '_includes/narration/hello-world-cards', `${c.id}.html`)));
  }
  const again = await narrate('hello-world-cards', { root: dir, provider: p, log: () => {} });
  assert.equal(again.apiCalls, 0);
  assert.ok(again.rows.every((r) => r.status === 'skipped'));
  assert.equal(p.calls.length, cards.insights.length);
});

test('narrate regenerates only the card whose text changed', async () => {
  const dir = sandbox();
  const p = fakeProvider();
  await narrate('hello-world-cards', { root: dir, provider: p, log: () => {} });
  const f = path.join(dir, '_articles/hello-world-cards.md');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('this is a test card', 'this is a changed card'));
  const r = await narrate('hello-world-cards', { root: dir, provider: p, log: () => {} });
  assert.equal(r.apiCalls, 1);
  assert.deepEqual(r.rows.filter((x) => x.status === 'processed').map((x) => x.id), ['hello']);
});

test('narrate writes nothing for a card whose timepoints fail validation', async () => {
  const dir = sandbox();
  const p = fakeProvider({ mutate: (tp) => tp.slice(1) });
  const r = await narrate('hello-world-cards', { root: dir, provider: p, log: () => {}, only: 'hello' });
  assert.equal(r.rows[0].status, 'failed');
  assert.match(r.rows[0].note, /timepoint count/);
  assert.ok(!fs.existsSync(path.join(dir, 'assets/narration')));
  assert.ok(!fs.existsSync(path.join(dir, '_includes/narration')));
});

test('narrate stops at the credentials checkpoint, writes SETUP.md, and calls nothing', async () => {
  const dir = sandbox();
  const p = fakeProvider({ ok: false });
  await assert.rejects(narrate('hello-world-cards', { root: dir, provider: p, log: () => {} }), /credentials checkpoint/);
  assert.equal(p.calls.length, 0);
  const setup = fs.readFileSync(path.join(dir, 'SETUP.md'), 'utf8');
  for (const cmd of ['gcloud auth application-default login', 'gcloud auth application-default set-quota-project', 'gcloud services enable texttospeech.googleapis.com']) {
    assert.ok(setup.includes(cmd), cmd);
  }
  assert.ok(!fs.existsSync(path.join(dir, 'assets/narration')));
});
