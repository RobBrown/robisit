/* Read-aloud narration for insight cards. No dependencies. Loaded after
   insight-cards.js on posts with generated narration (npm run narrate).
   One <audio> element serves the whole deck. The phrase being spoken is
   underlined, chosen from the audio's currentTime against the card's phrase
   timings, never from a timer. Any card change stops it, and moving to a
   narrated card starts it, until the reader pauses: then nothing starts
   again until a Play button is pressed. Browsers may block audio before the
   reader has interacted with the page; a blocked start rests silently, and
   the reader's first tap, click or key press in the deck primes the audio
   element so later starts are allowed (see prime()).
   Nothing starts on page load. If this never runs, the buttons stay hidden. */
(function () {
  var deck = document.getElementById('ic-deck');
  if (!deck || !window.fetch || !window.CustomEvent) return;
  var buttons = [].slice.call(deck.querySelectorAll('.ic-play'));
  var audio = document.createElement('audio');
  if (!buttons.length || !audio.canPlayType || !audio.canPlayType('audio/mpeg')) return;
  audio.preload = 'none';
  deck.appendChild(audio);
  var live = document.getElementById('ic-live');

  /* Temporary diagnostics: with ?narration-debug in the address, a small
     on-screen log of gestures, unlock attempts and play() results, for
     checking autoplay on a phone without a debugger. */
  var log = function () {};
  if (/[?&]narration-debug\b/.test(location.search)) {
    var box = document.createElement('pre'), lines = [], t0 = Date.now();
    box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99;margin:0;padding:6px 8px;max-height:40vh;overflow:auto;'
      + 'font:11px/1.35 ui-monospace,monospace;white-space:pre-wrap;pointer-events:none;background:#0a0600;color:#d4cfc6;border-top:1px solid #ffa000';
    document.body.appendChild(box);
    log = function (m) { lines.push(((Date.now() - t0) / 1000).toFixed(2) + ' ' + m); box.textContent = lines.slice(-24).join('\n'); };
    ['touchstart', 'touchend', 'touchcancel', 'pointercancel'].forEach(function (type) {
      document.addEventListener(type, function (e) { if (e.target.closest && e.target.closest('#ic-deck')) log(type); }, true);
    });
    log('narration ready; canPlayType mp3 = ' + audio.canPlayType('audio/mpeg'));
  }

  var card = null, btn = null, phrases = null, spoken = null, frame = 0, meta = {};
  // auto: start narration when a card becomes current. A pause turns it off;
  // pressing Play turns it back on.
  var auto = true, current = null, autoTimer = 0, announce = false;
  var AUTO_DELAY = 350; // ms the deck must rest on a card first, so a fast swipe through cards plays nothing

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
    auto = false; // don't keep retrying on every card; Play turns it back on
    stop();
  }
  function play() {
    var session = card, p = audio.play();
    if (!p || !p.catch) return;
    p.catch(function (e) {
      if (card !== session || e.name === 'AbortError') return;
      log('play refused: ' + e.name);
      if (e.name === 'NotAllowedError') stop(); // autoplay policy: not an error
      else fail(e.name + ': ' + e.message);
    });
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

  function start(b, trigger) {
    log('start ' + trigger + ' ' + b.closest('.ic-card').getAttribute('data-id'));
    stop();
    var session = card = b.closest('.ic-card');
    btn = b;
    setButton(b, true);
    audio.src = card.getAttribute('data-audio');
    play();
    timings(card.getAttribute('data-narration')).then(function (m) {
      if (card === session) { phrases = m.phrases; sync(); }
    }, function (e) { if (card === session) fail(e.message); });
    announce = true; // said once audio actually starts, so a blocked start says nothing
    deck.dispatchEvent(new CustomEvent('ic:track', { detail: { name: 'cards_play', card: card, props: { trigger: trigger } } }));
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      if (card !== b.closest('.ic-card')) { auto = true; start(b, 'button'); }
      else if (audio.paused) { auto = true; setButton(b, true); play(); }
      else audio.pause(); // the pause handler turns auto off
    });
    b.hidden = false;
  });
  // Only the current card's button is in the Tab order, so Tab never drags
  // the deck to another card.
  function tabbable(current) { buttons.forEach(function (b) { b.tabIndex = b.closest('.ic-card') === current ? 0 : -1; }); }
  // A narrated card's timings (a few KB) are fetched when it becomes current,
  // so the underline is ready the moment Play is pressed.
  function arrive(c) {
    current = c;
    tabbable(c);
    if (c && c.hasAttribute('data-narration')) timings(c.getAttribute('data-narration')).catch(function () {});
  }
  arrive(deck.querySelector('.ic-card.is-current'));

  audio.addEventListener('playing', function () {
    if (!card) return;
    log('playing ' + card.getAttribute('data-id'));
    if (announce) { announce = false; say('Reading card aloud.'); }
    setButton(btn, true); stopLoop(); loop();
  });
  // Any pause the reader causes (the button, or the system's media controls)
  // turns auto off. stop() clears `card` first, so its own pause doesn't count.
  audio.addEventListener('pause', function () { if (card && !audio.ended) { auto = false; setButton(btn, false); stopLoop(); sync(); } });
  audio.addEventListener('timeupdate', sync);
  audio.addEventListener('seeked', sync);
  audio.addEventListener('ended', function () { if (card) { stop(); say('Finished reading.'); } });
  audio.addEventListener('error', function () { if (card && audio.error) fail('audio failed to load (' + audio.getAttribute('src') + ')'); });

  /* Priming. iOS Safari lets an audio element start without a tap only after
     it has played inside one; other browsers ask for any earlier tap, click
     or key press on the page. So the reader's first such gesture in the deck
     (choosing a path, a chevron, an arrow key, the touch that ends a swipe)
     plays a tenth of a second of silence on the deck's one element. A swipe
     is tried at touchstart as well as touchend: by touchend iOS may have
     classed the touch as a scroll, which is not a gesture. Later
     autoplay, which runs from a timer rather than a gesture, is then allowed.
     It is limited to the deck so a tap elsewhere on the page never takes over
     the phone's audio (other apps pause when a page plays sound). */
  var SILENCE = 'data:audio/mpeg;base64,//NExAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExFMAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKYAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKwAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKwAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
  var primed = false, priming = false, afterPrime = null;
  // Runs fn now, or once an unlock in progress has settled. Starting real
  // audio sooner would swap the element's src and cancel the unlock: on a
  // phone the silent clip can take longer to start than the deck takes to
  // settle, so the first swipe's autoplay would be refused.
  function whenPrimed(fn) { if (priming) afterPrime = fn; else fn(); }
  function prime(e) {
    if (primed || priming || card) return;
    var t = e.target;
    var inDeck = t && t.closest && t.closest('#ic-deck');
    if (e.type === 'keydown' ? !(inDeck || e.key === 'ArrowLeft' || e.key === 'ArrowRight') : !inDeck) return;
    if (inDeck && t.closest('.ic-play')) return; // the button starts real audio itself
    priming = true;
    log('unlock try on ' + e.type);
    audio.src = SILENCE;
    var p = audio.play();
    var done = function (ok) {
      priming = false;
      if (ok) {
        primed = true;
        GESTURES.forEach(function (type) { document.removeEventListener(type, prime, true); });
      }
      if (!card && audio.getAttribute('src') === SILENCE) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
      var fn = afterPrime;
      afterPrime = null;
      if (fn) fn();
    };
    if (p && p.then) p.then(function () { log('unlocked'); done(true); }, function (err) { log('unlock refused: ' + err.name); done(false); });
    else done(true);
  }
  var GESTURES = ['touchstart', 'touchend', 'pointerup', 'click', 'keydown'];
  GESTURES.forEach(function (type) { document.addEventListener(type, prime, true); });

  // Moving to any other card (swipe, keys, chevrons, a path) stops narration,
  // and, while auto is on, starts the new card once the deck rests on it.
  deck.addEventListener('ic:change', function (e) {
    var c = e.detail.card;
    if (card && c !== card) stop();
    arrive(c);
    clearTimeout(autoTimer);
    afterPrime = null;
    var b = c && c.querySelector('.ic-play');
    if (auto && b && card !== c) {
      autoTimer = setTimeout(function () {
        log('autoplay due' + (priming ? ', waiting for unlock' : ''));
        whenPrimed(function () { if (auto && current === c && card !== c) start(b, 'auto'); });
      }, AUTO_DELAY);
    }
  });
})();
