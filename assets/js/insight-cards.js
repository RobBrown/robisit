/* TL;DR card deck behaviour (Insight Cards, PRD v2.1). No dependencies.
   The markup is rendered by _includes/insight-cards.html. This script shows
   the TL;DR / Full article switch, keeps exactly one of the two views on the
   page, and handles paths, navigation, deep links, the switch between views
   and analytics. If it never runs, the page is the plain article. */
(function () {
  var deck = document.getElementById('ic-deck');
  var article = document.getElementById('ic-article');
  var dataEl = document.getElementById('ic-data');
  if (!deck || !article || !dataEl || !window.URLSearchParams || !history.pushState) return;
  var data;
  try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }

  /* Analytics adapter boundary (PRD 7). Cloudflare Web Analytics has no custom
     events, so events go to window.insightCardsAnalytics(name, props) when a
     page defines it, and to the console otherwise. See DECISIONS.md. */
  function trackEvent(name, props) {
    var adapter = typeof window.insightCardsAnalytics === 'function' ? window.insightCardsAnalytics : consoleAdapter;
    try { adapter(name, props); } catch (e) { /* analytics must never break reading */ }
  }
  function consoleAdapter(name, props) {
    if (window.console) console.log('[insight-cards] ' + name + ' ' + JSON.stringify(props));
  }

  var rail = deck.querySelector('.ic-rail');
  var prev = deck.querySelector('.ic-prev');
  var next = deck.querySelector('.ic-next');
  var live = document.getElementById('ic-live');
  var sw = document.getElementById('ic-switch');
  var tabs = { tldr: document.getElementById('ic-tab-tldr'), article: document.getElementById('ic-tab-article') };
  var panels = { tldr: deck, article: article };
  var situation = rail.querySelector('.ic-situation');
  var terminal = rail.querySelector('.ic-terminal');
  var radios = [].slice.call(rail.querySelectorAll('.ic-opt'));
  var options = Array.isArray(data.options) ? data.options : [];
  var offset = situation ? 0 : 1;           // counter n = rail index + offset
  var total = rail.children.length - 1 + offset;
  var reduced = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  var path = null, idx = -1, aim = null, aimTimer, route = null;

  function last() { return rail.children.length - 1; }
  function counter(i) { return i + offset; }
  function isInsight(c) { return c !== situation && c !== terminal; }

  function applyPath(id) {
    var o = options.filter(function (x) { return x.id === id; })[0];
    if (!o || !situation) return false;
    path = o.id;
    var cards = [].slice.call(rail.children);
    o.order.forEach(function (key) {
      for (var i = 0; i < cards.length; i++) if (cards[i].getAttribute('data-id') === key) rail.insertBefore(cards[i], terminal);
    });
    [].forEach.call(rail.children, function (c, i) {
      if (c === situation) return;
      c.setAttribute('aria-label', counter(i) + ' of ' + total);
      c.querySelector('.ic-n').textContent = counter(i) + '/' + total;
    });
    radios.forEach(function (r) { r.setAttribute('aria-checked', r.getAttribute('data-path') === id ? 'true' : 'false'); });
    changed();
    return true;
  }

  // Cards snap to the rail's start edge (the text column), set by its scroll-padding.
  function pad() { return parseFloat(getComputedStyle(rail).scrollPaddingLeft) || 0; }

  function go(i, instant) {
    i = Math.max(0, Math.min(last(), i));
    var c = rail.children[i];
    aim = i;
    rail.scrollTo({ left: c.offsetLeft - pad(), behavior: instant || reduced.matches ? 'auto' : 'smooth' });
  }

  // The current card is the one nearest the start edge; at the far end of the
  // rail, where the last cards can't reach that edge, it's the last card.
  function nearest() {
    if (rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 2) return last();
    var edge = rail.scrollLeft + pad(), best = 0, bd = Infinity;
    [].forEach.call(rail.children, function (c, i) {
      var d = Math.abs(c.offsetLeft - edge);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  function setIdx(i, quiet) {
    if (i === idx) return;
    if (rail.children[idx]) rail.children[idx].classList.remove('is-current');
    idx = i;
    var c = rail.children[i];
    c.classList.add('is-current');
    var focused = document.activeElement;
    prev.disabled = i === 0;
    next.disabled = i === last();
    // A chevron that disables itself under focus hands focus to its sibling, keeping Tab order intact.
    if ((focused === prev || focused === next) && focused.disabled) (focused === prev ? next : prev).focus({ preventScroll: true });
    if (!quiet) {
      live.textContent = c === situation ? c.querySelector('.ic-title').textContent
        : 'Card ' + counter(i) + ' of ' + total + '. ' + c.querySelector(c === terminal ? '.ic-knows' : '.ic-title').textContent;
    }
    if (isInsight(c)) trackEvent('cards_reached', { card: counter(i), path: path || 'default' });
    updateURL();
    changed();
  }

  /* Narration hooks (insight-cards-narration.js): 'ic:change' tells it the
     current card may have changed; it sends 'ic:track' events, recorded here
     with the card's position and the path, and 'ic:next' when a card has
     finished reading and the deck should move on. */
  function changed() { deck.dispatchEvent(new CustomEvent('ic:change', { detail: { card: deck.hidden ? null : rail.children[idx] } })); }
  deck.addEventListener('ic:track', function (e) {
    var i = [].indexOf.call(rail.children, e.detail.card);
    if (i < 0) return;
    var props = { card: counter(i), path: path || 'default' };
    for (var k in e.detail.props) props[k] = e.detail.props[k];
    trackEvent(e.detail.name, props);
  });

  function updateURL() {
    var q = new URLSearchParams(location.search);
    q.delete('path'); q.delete('card');
    if (path) q.set('path', path);
    if (rail.children[idx] !== situation) q.set('card', counter(idx));
    var s = q.toString();
    history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash);
  }

  /* Views. The tabs, the terminal control, find in page, links and
     back/forward all go through setView. The hidden article is
     hidden="until-found", so find in page reaches it. The hash names the
     view: #tldr, #article, or a section of the article. */
  var view = null, want = null, anim = null;
  function isOpen() { return view === 'article'; }
  // The element a #fragment in the URL points at, when it is inside the article.
  function hashTarget() {
    var id = location.hash.slice(1), t = null;
    try { t = id && document.getElementById(decodeURIComponent(id)); } catch (e) { /* malformed escape */ }
    return t && article.contains(t) ? t : null;
  }
  function viewFromHash() {
    if (location.hash === '#tldr') return 'tldr';
    return location.hash === '#article' || hashTarget() ? 'article' : 'tldr';
  }
  // mode 'push' for a deliberate switch (one history entry), 'replace' otherwise.
  function writeHash(v, mode) {
    if (viewFromHash() === v && location.hash) return;
    history[mode + 'State'](null, '', location.pathname + location.search + '#' + v);
  }

  function select(v) {
    for (var k in tabs) {
      tabs[k].setAttribute('aria-selected', k === v ? 'true' : 'false');
      tabs[k].tabIndex = k === v ? 0 : -1;
    }
  }
  function show(v) {
    view = v;
    // Keep the scroll position: with nothing between the deck and the article,
    // the browser otherwise resets it when one replaces the other.
    var y = window.scrollY;
    deck.hidden = v !== 'tldr';
    // until-found hides the text; aria-hidden drops the empty panel from the tree too.
    if (v === 'article') { article.removeAttribute('hidden'); article.removeAttribute('aria-hidden'); }
    else { article.setAttribute('hidden', 'until-found'); article.setAttribute('aria-hidden', 'true'); }
    if (window.scrollY !== y) window.scrollTo(0, y);
    if (v === 'tldr') go(idx, true); // the rail loses its scroll position while hidden
    changed();
  }

  // The page stays where it is. A section link scrolls to its section, and the
  // terminal control brings the article's start back into view if it is above
  // the screen. Focus moves to the view's start.
  function land(v, o) {
    var t = o.land || o.top && sw.getBoundingClientRect().top < 0 && sw;
    if (t) t.scrollIntoView({ block: 'start', behavior: 'instant' });
    if (o.focus === false) return;
    var f = o.focus || o.land || panels[v];
    if (!f.hasAttribute('tabindex')) f.setAttribute('tabindex', '-1');
    f.focus({ preventScroll: true });
  }

  /* CRT transition (index.html crt-off, quicker): the old view collapses to a
     bright line mid-screen and the new view opens from the line. Instant under reduced motion; a new
     switch cuts it short. */
  var OFF = [
    { transform: 'scaleY(1)', filter: 'brightness(1)', opacity: 1 },
    { transform: 'scaleY(1)', filter: 'brightness(1.3)', opacity: 0.5, offset: 0.12 },
    { transform: 'scaleY(1)', filter: 'brightness(1)', opacity: 0.9, offset: 0.22 },
    { transform: 'scaleY(.012)', filter: 'brightness(3)', opacity: 1, offset: 0.62 },
    { transform: 'scale(0, .004)', filter: 'brightness(6)', opacity: 0 }
  ];
  var ON = [
    { transform: 'scale(.4, .004)', filter: 'brightness(6)', opacity: 0 },
    { transform: 'scale(1, .004)', filter: 'brightness(4)', opacity: 1, offset: 0.25 },
    { transform: 'scale(1, 1)', filter: 'brightness(1.6)', opacity: 1, offset: 0.62 },
    { transform: 'none', filter: 'brightness(1)', opacity: 1 }
  ];
  // Scale about the middle of the viewport, wherever the view starts and ends.
  function centre(el) {
    var r = el.getBoundingClientRect();
    var y = Math.max(0, Math.min(r.height, window.innerHeight / 2 - r.top));
    el.style.transformOrigin = '50% ' + y + 'px';
  }
  function settled(a, el) { if (anim === a) anim = null; el.style.transformOrigin = ''; }
  function stopAnim() {
    if (!anim) return;
    var a = anim;
    anim = null;
    a.cancel();
    deck.style.transformOrigin = article.style.transformOrigin = '';
  }

  function setView(v, o) {
    o = o || {};
    if (o.history) writeHash(v, o.history);
    if (v === 'article' && o.route && !route) {
      route = o.route;
      trackEvent('cards_handoff', { route: route, card: counter(Math.max(idx, 0)), path: path || 'default', anchor: '#ic-article' });
    }
    if (v === want && !anim) return land(v, o); // already showing it
    if (v === want) return;                     // already on its way
    want = v;
    select(v);
    stopAnim();
    if (v === view || o.instant || reduced.matches || !deck.animate) { if (v !== view) show(v); return land(v, o); }
    var from = panels[view], to = panels[v];
    centre(from);
    var off = anim = from.animate(OFF, { duration: 260, easing: 'ease-in', fill: 'forwards' });
    off.onfinish = function () {
      if (anim !== off) return;
      show(v);
      off.cancel();
      from.style.transformOrigin = '';
      land(v, o);
      centre(to);
      var on = anim = to.animate(ON, { duration: 340, easing: 'ease-out' });
      on.onfinish = function () { settled(on, to); };
      on.oncancel = function () { settled(on, to); };
    };
  }

  // Back and forward, and links to #tldr, #article or a section.
  function sync() {
    var t = hashTarget(), v = viewFromHash();
    if (t && want === 'article') return; // a link within the article: the browser scrolls
    setView(v, t ? { land: t, focus: false } : {});
  }

  /* Depth (PRD 7): how far through the article the reader has scrolled, from
     its top, counted only while it is open. route is the control the reader
     first opened it with ('button' or 'terminal'), and 'none' before that. */
  var depthFired = {}, depthQueued = false;
  function queueDepth() {
    if (depthQueued) return;
    depthQueued = true;
    requestAnimationFrame(function () { depthQueued = false; depth(); });
  }
  function depth() {
    if (!isOpen()) return;
    var y = window.pageYOffset, top = article.getBoundingClientRect().top + y;
    var span = article.offsetHeight, seen = y + window.innerHeight - top;
    var pct = span > 0 ? seen / span * 100 : 100;
    [25, 50, 75, 100].forEach(function (d) {
      if (pct >= d && !depthFired[d]) { depthFired[d] = true; trackEvent('cards_depth', { depth: d, route: route || 'none' }); }
    });
  }

  radios.forEach(function (r) {
    r.addEventListener('click', function () {
      var id = r.getAttribute('data-path');
      if (applyPath(id)) { trackEvent('cards_path', { path: id }); go(1); }
    });
  });
  for (var k in tabs) (function (v) {
    tabs[v].addEventListener('click', function () { setView(v, { route: 'switch', history: 'push' }); });
  })(k);
  // Arrow keys, Home and End move between the two tabs and switch the view.
  sw.addEventListener('keydown', function (e) {
    var v = { ArrowLeft: 'other', ArrowRight: 'other', Home: 'tldr', End: 'article' }[e.key];
    if (!v || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    if (v === 'other') v = want === 'tldr' ? 'article' : 'tldr';
    tabs[v].focus();
    setView(v, { route: 'switch', history: 'push', focus: tabs[v] });
  });
  // "Read The Full Article" on the last card opens the article at its start.
  terminal.querySelector('.ic-go').addEventListener('click', function () {
    setView('article', { route: 'terminal', history: 'push', top: true });
  });
  // Find in page reveals the article itself and scrolls to the match.
  article.addEventListener('beforematch', function () { setView('article', { history: 'replace', instant: true, focus: false }); });
  window.addEventListener('popstate', sync);
  window.addEventListener('hashchange', sync);
  function step(d) { go((aim !== null ? aim : idx) + d); }
  prev.addEventListener('click', function () { step(-1); });
  next.addEventListener('click', function () { step(1); });
  deck.addEventListener('ic:next', function () { step(1); });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    var r = deck.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= window.innerHeight) return;
    e.preventDefault();
    step(e.key === 'ArrowRight' ? 1 : -1);
  });

  var queued = false;
  rail.addEventListener('scroll', function () {
    if (deck.hidden) return;
    clearTimeout(aimTimer);
    aimTimer = setTimeout(function () { aim = null; }, 150);
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; setIdx(nearest()); });
  }, { passive: true });

  window.addEventListener('resize', function () { if (!deck.hidden) go(idx, true); });
  window.addEventListener('scroll', queueDepth, { passive: true });

  /* Boot: show the switch and the deck, apply any deep link (PRD 5.7), then
     open the view the hash names, TL;DR by default. */
  var q = new URLSearchParams(location.search);
  if (q.get('path')) applyPath(q.get('path'));
  var card = parseInt(q.get('card'), 10);
  var start = Math.max(0, Math.min(isNaN(card) ? 0 : card - offset, last()));
  sw.hidden = false;
  deck.hidden = false;
  article.setAttribute('role', 'tabpanel');
  article.setAttribute('aria-labelledby', 'ic-tab-article');
  go(start, true);
  aim = null;
  setIdx(start, true);
  want = viewFromHash();
  select(want);
  show(want);
  if (!location.hash) writeHash(want, 'replace');
})();
