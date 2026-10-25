/* Narration settings: the one place to change the voice or output format.
 * Both are part of every card's cache key, so changing either regenerates
 * every card on the next `npm run narrate`.
 */
'use strict';

module.exports = {
  voice: { name: 'en-US-Neural2-D', languageCode: 'en-US' },
  // MP3 plays everywhere, including iOS Safari. Google returns mono for these voices.
  outputFormat: { audioEncoding: 'MP3', sampleRateHertz: 24000, channels: 1 },
};
