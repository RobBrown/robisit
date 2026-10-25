/* Narration timing, validation, audio measurement and cache keys. Pure
 * functions, no network. Every phrase start comes from the provider's
 * timepoints; nothing here estimates time from text.
 */
'use strict';

const crypto = require('crypto');

class NarrationError extends Error {}
const fail = (msg) => { throw new NarrationError(msg); };

/* Cache key: everything that changes the audio or the phrase markup. */
function cardHash({ title, body, voice, outputFormat, segmentation }) {
  const key = JSON.stringify({ title, body, voice, outputFormat, segmentation });
  return crypto.createHash('sha256').update(key).digest('hex');
}

/* Phrase starts from the provider's timepoints, in phrase order. proto3 JSON
   omits zero values, so a timepoint with no timeSeconds is at 0. */
function parseTimepoints(timepoints, phrases) {
  if (!Array.isArray(timepoints)) fail('response has no timepoints array');
  if (timepoints.length !== phrases.length) {
    fail(`timepoint count ${timepoints.length} does not equal phrase count ${phrases.length}`);
  }
  return timepoints.map((tp, i) => {
    if (tp.markName !== phrases[i].id) fail(`timepoint ${i} is "${tp.markName}", expected "${phrases[i].id}"`);
    const t = tp.timeSeconds === undefined ? 0 : tp.timeSeconds;
    if (typeof t !== 'number' || !Number.isFinite(t)) fail(`timepoint ${tp.markName} has no numeric time`);
    return t;
  });
}

const round = (t) => Math.round(t * 1000) / 1000;

/* Each phrase ends where the next starts; the last ends at the measured
   duration. Validates the result and throws on any violation. */
function buildTimeline(phrases, starts, duration) {
  if (!(duration > 0)) fail(`measured duration ${duration} is not positive`);
  const timed = phrases.map((p, i) => ({
    id: p.id, text: p.text,
    start: round(starts[i]),
    end: round(i + 1 < starts.length ? starts[i + 1] : duration),
  }));
  validateTimeline(timed, duration);
  return timed;
}

function validateTimeline(timed, duration) {
  if (!timed.length) fail('no phrases');
  timed.forEach((p, i) => {
    if (p.start < 0) fail(`${p.id} starts at ${p.start}, before 0`);
    if (i > 0 && !(p.start > timed[i - 1].start)) fail(`${p.id} starts at ${p.start}, not after ${timed[i - 1].id} at ${timed[i - 1].start}`);
  });
  const last = timed[timed.length - 1];
  if (last.start >= duration) fail(`last phrase starts at ${last.start}, at or after the audio ends (${duration})`);
  timed.forEach((p, i) => {
    if (i + 1 < timed.length && p.end !== timed[i + 1].start) fail(`${p.id} ends at ${p.end}, but ${timed[i + 1].id} starts at ${timed[i + 1].start}`);
  });
  if (!(last.end > last.start)) fail(`${last.id} ends at ${last.end}, not after its start ${last.start}`);
  if (Math.abs(last.end - duration) > 0.5) fail(`last phrase ends at ${last.end}, more than 0.5 s from the measured duration ${duration}`);
}

/* ---------- MP3 measurement ---------- */

// MPEG audio frame header tables (layer III).
const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],   // MPEG-1
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],       // MPEG-2 and 2.5
};
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/* Decodes an MP3's frame headers and counts samples: the duration of the
   audio a player will decode, measured from the file, not from metadata.
   A leading Xing/Info frame carries no audio and is not counted. */
function mp3Info(buf) {
  let i = 0;
  if (buf.length >= 10 && buf.toString('latin1', 0, 3) === 'ID3') {
    i = 10 + ((buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f));
  }
  let frames = 0, samples = 0, sampleRate = 0, channels = 0, first = true;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) {
      if (frames === 0) { i++; continue; } // skip junk before the first frame
      break;                                 // trailing tag or junk ends the stream
    }
    const ver = (buf[i + 1] >> 3) & 3;       // 3 MPEG-1, 2 MPEG-2, 0 MPEG-2.5
    const layer = (buf[i + 1] >> 1) & 3;     // 1 = layer III
    const br = (buf[i + 2] >> 4) & 15, sr = (buf[i + 2] >> 2) & 3, pad = (buf[i + 2] >> 1) & 1;
    const mode = (buf[i + 3] >> 6) & 3;      // 3 = single channel
    if (ver === 1 || layer !== 1 || br === 0 || br === 15 || sr === 3) fail(`unsupported MP3 frame header at byte ${i}`);
    const rate = RATES[ver][sr];
    const kbps = BITRATES[ver === 3 ? 1 : 2][br];
    const perFrame = ver === 3 ? 1152 : 576;
    const len = Math.floor((ver === 3 ? 144 : 72) * kbps * 1000 / rate) + pad;
    if (first) {
      first = false;
      const side = ver === 3 ? (mode === 3 ? 17 : 32) : (mode === 3 ? 9 : 17);
      const tag = buf.toString('latin1', i + 4 + side, i + 8 + side);
      if (tag === 'Xing' || tag === 'Info') { i += len; continue; }
    }
    if (sampleRate && rate !== sampleRate) fail('sample rate changes mid-stream');
    sampleRate = rate;
    channels = mode === 3 ? 1 : 2;
    frames++;
    samples += perFrame;
    i += len;
  }
  if (!frames) fail('no MP3 audio frames found');
  return { frames, sampleRate, channels, duration: round(samples / sampleRate) };
}

/* Checks the audio matches the requested output format. */
function validateAudio(info, outputFormat) {
  if (info.sampleRate !== outputFormat.sampleRateHertz) fail(`audio is ${info.sampleRate} Hz, expected ${outputFormat.sampleRateHertz}`);
  if (info.channels !== outputFormat.channels) fail(`audio has ${info.channels} channels, expected ${outputFormat.channels}`);
}

module.exports = { NarrationError, cardHash, parseTimepoints, buildTimeline, validateTimeline, mp3Info, validateAudio };
