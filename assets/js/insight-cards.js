/* Insight Cards deck behaviour (PRD v2.1 sections 3, 5, 7, 8). No dependencies.
   The deck markup is rendered by _includes/insight-cards.html. This script
   shows it above the article and handles paths, navigation, deep links, the
   jump into the article and analytics. If it never runs, the page is the
   plain article. */
(function () {
  var deck = document.getElementById('ic-deck');
  var article = document.getElementById('ic-article');
  var dataEl = document.getElementById('ic-data');
  if (!deck || !article || !dataEl || !window.URLSearchParams || !history.replaceState) return;
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
  var head = document.getElementById('ic-head');
  var situation = rail.querySelector('.ic-situation');
  var terminal = rail.querySelector('.ic-terminal');
  var radios = [].slice.call(rail.querySelectorAll('.ic-opt'));
  var options = Array.isArray(data.options) ? data.options : [];
  var offset = situation ? 0 : 1;           // counter n = rail index + offset
  var total = rail.children.length - 1 + offset;
  var reduced = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  var path = null, anchor = data.default_anchor, idx = -1, aim = null, aimTimer, route = null;

  function last() { return rail.children.length - 1; }
  function counter(i) { return i + offset; }
  function isInsight(c) { return c !== situation && c !== terminal; }

  function applyPath(id) {
    var o = options.filter(function (x) { return x.id === id; })[0];
    if (!o || !situation) return false;
    path = o.id; anchor = o.anchor;
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
  }

  function updateURL() {
    var q = new URLSearchParams(location.search);
    q.delete('path'); q.delete('card');
    if (path) q.set('path', path);
    if (rail.children[idx] !== situation) q.set('card', counter(idx));
    var s = q.toString();
    history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash);
  }

  /* Handoff (PRD 5.6). The article is always open (owner direction), so the
     terminal control jumps to the path's anchor. It's recorded once per view. */
  var depthFired = {}, depthQueued = false;
  function handoff() {
    var target = anchor ? document.getElementById(anchor.slice(1)) || article : article;
    if (!route) {
      route = 'terminal';
      trackEvent('cards_handoff', { route: route, card: counter(Math.max(idx, 0)), path: path || 'default', anchor: target === article ? '#ic-article' : anchor });
    }
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  }

  /* Depth (PRD 7): how far through the article the reader has scrolled, from
     its top. route is 'terminal' once the reader has used the terminal
     control, and 'none' before that. */
  function queueDepth() {
    if (depthQueued) return;
    depthQueued = true;
    requestAnimationFrame(function () { depthQueued = false; depth(); });
  }
  function depth() {
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
  terminal.querySelector('.ic-go').addEventListener('click', handoff);
  window.addEventListener('scroll', queueDepth, { passive: true });
  function step(d) { go((aim !== null ? aim : idx) + d); }
  prev.addEventListener('click', function () { step(-1); });
  next.addEventListener('click', function () { step(1); });

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
    clearTimeout(aimTimer);
    aimTimer = setTimeout(function () { aim = null; }, 150);
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; setIdx(nearest()); });
  }, { passive: true });

  window.addEventListener('resize', function () { go(idx, true); });

  /* Boot: show the deck and apply any deep link (PRD 5.7). */
  var q = new URLSearchParams(location.search);
  if (q.get('path')) applyPath(q.get('path'));
  var card = parseInt(q.get('card'), 10);
  var start = Math.max(0, Math.min(isNaN(card) ? 0 : card - offset, last()));
  deck.hidden = false;
  head.hidden = false;
  go(start, true);
  aim = null;
  setIdx(start, true);
})();
