/* Read-aloud narration for insight cards. No dependencies. Loaded after
   insight-cards.js on posts with generated narration (npm run narrate).
   One <audio> element serves the whole deck. The phrase being spoken is
   underlined, chosen from the audio's currentTime against the card's phrase
   timings, never from a timer. Any card change stops it. Audio only starts
   from a button click. If this never runs, the buttons stay hidden. */
(function () {
  var deck = document.getElementById('ic-deck');
  if (!deck || !window.fetch || !window.CustomEvent) return;
  var buttons = [].slice.call(deck.querySelectorAll('.ic-play'));
  var audio = document.createElement('audio');
  if (!buttons.length || !audio.canPlayType || !audio.canPlayType('audio/mpeg')) return;
  audio.preload = 'none';
  deck.appendChild(audio);
  var live = document.getElementById('ic-live');

  var card = null, btn = null, phrases = null, spoken = null, frame = 0, meta = {};

  function setButton(b, playing) {
    b.setAttribute('aria-pressed', playing ? 'true' : 'false');
    b.setAttribute('aria-label', playing ? 'Pause' : 'Read this card aloud');
  }
  function say(text) { if (live) live.textContent = text; }

  // Underline one phrase. Only the spans that change are touched.
  function mark(id) {
    if (id === spoken) return;
    var c = card || deck;
    if (spoken) [].forEach.call(c.querySelectorAll('[data-phrase="' + spoken + '"]'), function (s) { s.classList.remove('is-spoken'); });
    spoken = id;
    if (id) [].forEach.call(c.querySelectorAll('[data-phrase="' + id + '"]'), function (s) { s.classList.add('is-spoken'); });
  }
  // The phrase whose [start, end) holds currentTime. The few milliseconds of
  // lead-in before the first mark belong to the first phrase.
  function sync() {
    if (!card || !phrases) return;
    var t = audio.currentTime, id = null;
    for (var i = 0; i < phrases.length; i++) if ((i === 0 || t >= phrases[i].start) && t < phrases[i].end) { id = phrases[i].id; break; }
    mark(id);
  }
  function loop() { sync(); frame = requestAnimationFrame(loop); }
  function stopLoop() { cancelAnimationFrame(frame); frame = 0; }

  function stop() {
    if (!card) return;
    stopLoop();
    mark(null);
    setButton(btn, false);
    card = btn = phrases = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load(); // drops the old stream so no stale audio can resume
  }
  // One console warning, then back to rest. Navigation is untouched.
  function fail(why) {
    if (!card) return;
    if (window.console) console.warn('[insight-cards] narration unavailable: ' + why);
    stop();
  }
  function play() {
    var session = card, p = audio.play();
    if (p && p.catch) p.catch(function (e) { if (card === session && e.name !== 'AbortError') fail(e.name + ': ' + e.message); });
  }
  function timings(url) {
    if (!meta[url]) {
      meta[url] = fetch(url).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
        return r.json();
      });
      meta[url].catch(function () { delete meta[url]; });
    }
    return meta[url];
  }

  function start(b) {
    stop();
    var session = card = b.closest('.ic-card');
    btn = b;
    setButton(b, true);
    audio.src = card.getAttribute('data-audio');
    play();
    timings(card.getAttribute('data-narration')).then(function (m) {
      if (card === session) { phrases = m.phrases; sync(); }
    }, function (e) { if (card === session) fail(e.message); });
    say('Reading card aloud.');
    deck.dispatchEvent(new CustomEvent('ic:track', { detail: { name: 'cards_play', card: card } }));
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      if (card !== b.closest('.ic-card')) start(b);
      else if (audio.paused) { setButton(b, true); play(); }
      else audio.pause();
    });
    b.hidden = false;
  });
  // Only the current card's button is in the Tab order, so Tab never drags
  // the deck to another card.
  function tabbable(current) { buttons.forEach(function (b) { b.tabIndex = b.closest('.ic-card') === current ? 0 : -1; }); }
  // A narrated card's timings (a few KB) are fetched when it becomes current,
  // so the underline is ready the moment Play is pressed.
  function arrive(c) {
    tabbable(c);
    if (c && c.hasAttribute('data-narration')) timings(c.getAttribute('data-narration')).catch(function () {});
  }
  arrive(deck.querySelector('.ic-card.is-current'));

  audio.addEventListener('playing', function () { if (card) { setButton(btn, true); stopLoop(); loop(); } });
  audio.addEventListener('pause', function () { if (card && !audio.ended) { setButton(btn, false); stopLoop(); sync(); } });
  audio.addEventListener('timeupdate', sync);
  audio.addEventListener('seeked', sync);
  audio.addEventListener('ended', function () { if (card) { stop(); say('Finished reading.'); } });
  audio.addEventListener('error', function () { if (card && audio.error) fail('audio failed to load (' + audio.getAttribute('src') + ')'); });

  // Moving to any other card (swipe, keys, chevrons, a path) stops narration.
  deck.addEventListener('ic:change', function (e) {
    if (card && e.detail.card !== card) stop();
    arrive(e.detail.card);
  });
})();
