// TEMPORARY. Typography comparison switcher (docs/typography.md). Runs only on
// localhost. ?type=a|b|c picks a pairing, ?type=now shows the live site's type.
// The choice is kept for the tab session so it follows you between pages.
(function(){
  if (!/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(location.hostname)) return;
  var NAMES = { now:'Now', a:'A Literata', b:'B Source Serif', c:'C Atkinson' };
  var root = document.documentElement;
  function get(){ try { return sessionStorage.getItem('type'); } catch (e) { return null; } }
  function apply(t){
    if (t === 'now') delete root.dataset.type; else root.dataset.type = t;
    try { sessionStorage.setItem('type', t); } catch (e) {}
    var u = new URL(location.href); u.searchParams.set('type', t);
    history.replaceState(null, '', u);
    document.querySelectorAll('.type-dev button').forEach(function(b){
      b.setAttribute('aria-pressed', String(b.value === t));
    });
  }
  var q = new URLSearchParams(location.search).get('type');
  var t = NAMES[q] ? q : (NAMES[get()] ? get() : 'now');
  if (t !== 'now') root.dataset.type = t;
  document.addEventListener('DOMContentLoaded', function(){
    var bar = document.createElement('div');
    bar.className = 'type-dev';
    bar.innerHTML = '<span>Type</span>';
    Object.keys(NAMES).forEach(function(k){
      var b = document.createElement('button');
      b.type = 'button'; b.value = k; b.textContent = NAMES[k];
      b.addEventListener('click', function(){ apply(k); });
      bar.appendChild(b);
    });
    document.body.appendChild(bar);
    apply(t);
  });
})();
