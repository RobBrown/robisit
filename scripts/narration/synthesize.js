/* The only module that talks to Google Cloud Text-to-Speech.
 *
 *   synthesize(ssml, { voice, outputFormat }) -> { audioBuffer, timepoints }
 *
 * Uses the v1beta1 REST endpoint, the one that returns <mark> timepoints
 * (enableTimePointing: ["SSML_MARK"]). Authenticates with Application Default
 * Credentials only: no API keys, no key files. ADC's quota project is sent
 * as x-goog-user-project by google-auth-library.
 */
'use strict';

const { GoogleAuth } = require('google-auth-library');

const API = 'https://texttospeech.googleapis.com/v1beta1';
let auth;
const client = () => (auth || (auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }))).getClient();

/* The credentials checkpoint: ADC resolves, the API answers, and the voice
   exists. Resolves to { ok: true } or { ok: false, step, message }. */
async function checkCredentials(voice) {
  let c;
  try {
    c = await client();
    await c.getAccessToken();
  } catch (e) {
    return { ok: false, step: 'adc', message: e.message };
  }
  try {
    const res = await c.request({ url: `${API}/voices`, params: { languageCode: voice.languageCode } });
    if (!res.data.voices.some((v) => v.name === voice.name)) {
      return { ok: false, step: 'voice', message: `voice ${voice.name} is not offered` };
    }
  } catch (e) {
    const status = e.response && e.response.status;
    return { ok: false, step: status === 403 ? 'api' : 'request', message: e.message };
  }
  return { ok: true };
}

async function synthesize(ssml, { voice, outputFormat }) {
  const c = await client();
  const res = await c.request({
    url: `${API}/text:synthesize`,
    method: 'POST',
    data: {
      input: { ssml },
      voice: { languageCode: voice.languageCode, name: voice.name },
      audioConfig: { audioEncoding: outputFormat.audioEncoding, sampleRateHertz: outputFormat.sampleRateHertz },
      enableTimePointing: ['SSML_MARK'],
    },
  });
  if (!res.data.audioContent) throw new Error('response has no audioContent');
  return { audioBuffer: Buffer.from(res.data.audioContent, 'base64'), timepoints: res.data.timepoints || [] };
}

module.exports = { synthesize, checkCredentials };
