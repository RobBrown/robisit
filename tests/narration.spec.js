// Read-aloud narration on insight cards. Runs on Google Chrome (the "chrome"
// project): Playwright's bundled Chromium cannot decode MP3.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { ROOT, CARDED_URL, cards, insightById, siteColours, settle, captureEvents } = require('./helpers');

const SLUG = 'hello-world-cards';
const URL_PILOT5 = `${CARDED_URL}?path=pilot&card=5`; // the spec's test URL
const pilot = cards.situation.options.find((o) => o.id === 'pilot');
const meta = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/narration', SLUG, `${id}.json`), 'utf8'));
const idAt5 = pilot.order[4];

const audio = (page) => page.evaluate(() => {
  const a = document.querySelector('#ic-deck audio');
  return { paused: a.paused, t: a.currentTime, src: a.getAttribute('src'), ended: a.ended, count: document.querySelectorAll('audio, video').length };
});
const spoken = (page) => page.evaluate(() => [...new Set([...document.querySelectorAll('.is-spoken')].map((s) => s.getAttribute('data-phrase')))]);
const playButton = (page) => page.locator('.ic-card.is-current .ic-play');
const playing = (page, after = 0.1) => page.waitForFunction((t) => {
  const a = document.querySelector('#ic-deck audio');
  return a && !a.paused && a.currentTime > t;
}, after);
// Seeks the deck's audio element and waits until the seek has landed.
const seek = (page, t) => page.evaluate((t) => new Promise((res) => {
  const a = document.querySelector('#ic-deck audio');
  a.addEventListener('seeked', () => requestAnimationFrame(() => res()), { once: true });
  a.currentTime = t;
}), t);
const expected = (m, t) => (m.phrases.find((p, i) => (i === 0 || t >= p.start) && t < p.end) || {}).id;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const can = await page.evaluate(() => document.createElement('audio').canPlayType('audio/mpeg'));
  test.skip(!can, 'This browser cannot play audio/mpeg. Run the narration suite on channel "chrome" (Google Chrome).');
});

test.describe('markup', () => {
  test('every insight card with generated assets has one button; situation and terminal cards have none', async ({ page }) => {
    await page.goto(CARDED_URL);
    for (const c of cards.insights) {
      const card = page.locator(`.ic-insight[data-id="${c.id}"]`);
      await expect(card.locator('button')).toHaveCount(1);
      const b = card.locator('.ic-play');
      await expect(b).toHaveAttribute('aria-label', 'Read this card aloud');
      await expect(b).toHaveAttribute('aria-pressed', 'false');
      await expect(card).toHaveAttribute('data-audio', `/assets/narration/${SLUG}/${c.id}.mp3`);
    }
    await expect(page.locator('.ic-situation .ic-play, .ic-terminal .ic-play')).toHaveCount(0);
    await expect(page.locator('#ic-deck audio')).toHaveCount(1);
    await expect(page.locator('#ic-deck audio')).toHaveAttribute('preload', 'none');
  });

  test('phrase-wrapped cards show exactly the plain render text', async ({ page, request }) => {
    const html = await (await request.get(CARDED_URL)).text();
    for (const c of cards.insights) {
      // Byte-identical once the phrase spans are removed.
      const m = new RegExp(`data-id="${c.id}"[^>]*>[\\s\\S]*?<h2 class="ic-title">([\\s\\S]*?)</h2>\\s*<p class="ic-body">([\\s\\S]*?)</p>`).exec(html);
      const esc = (s) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      expect(m[1].replace(/<\/?span[^>]*>/g, ''), c.id).toBe(esc(c.title));
      expect(m[2].replace(/<\/?span[^>]*>/g, ''), c.id).toBe(esc(c.body.trim()));
      expect(m[2]).toContain('data-phrase="p');
    }
    await page.goto(CARDED_URL);
    for (const c of cards.insights) {
      const card = page.locator(`.ic-insight[data-id="${c.id}"]`);
      await expect(card.locator('.ic-title')).toHaveText(c.title, { useInnerText: false });
      expect(await card.locator('.ic-body').textContent()).toBe(c.body.trim());
    }
  });

  test('phrase spans carry no ARIA and no extra attributes', async ({ page }) => {
    await page.goto(CARDED_URL);
    const attrs = await page.locator('[data-phrase]').evaluateAll((els) => [...new Set(els.flatMap((e) => e.getAttributeNames()))]);
    expect(attrs).toEqual(['data-phrase']);
  });

  test('a card edited after generation falls back to the plain render with no button (fixture build)', async () => {
    const f = path.join(ROOT, '_site-fixtures/thoughts/valid-narration-stale/index.html');
    test.skip(!fs.existsSync(f), 'fixture site not built (npm run build)');
    const html = fs.readFileSync(f, 'utf8');
    const block = (id) => new RegExp(`<div class="ic-card ic-insight"[^>]*data-id="${id}"[\\s\\S]*?</p>`).exec(html)[0];
    expect(block('counter')).not.toContain('ic-play');
    expect(block('counter')).not.toContain('data-phrase');
    expect(block('counter')).toContain('Test card two checks the counter (edited)');
    for (const id of ['hello', 'swipe', 'jump', 'links']) expect(block(id), id).toContain('class="ic-play"');
  });

  test('missing metadata: no button, and no narration assets load (fixture build)', async () => {
    const f = path.join(ROOT, '_site-fixtures/thoughts/valid-full/index.html');
    test.skip(!fs.existsSync(f), 'fixture site not built (npm run build)');
    const html = fs.readFileSync(f, 'utf8');
    expect(html).toContain('id="ic-deck"');
    expect(html).not.toContain('ic-play');
    expect(html).not.toContain('data-phrase');
    expect(html).not.toContain('insight-cards-narration');
  });
});

test.describe('playback', () => {
  test('Play starts audio and underlines p0 within 250 ms', async ({ page }) => {
    await page.goto(URL_PILOT5);
    await settle(page);
    const ms = await page.evaluate(() => new Promise((res) => {
      const b = document.querySelector('.ic-card.is-current .ic-play');
      const t0 = performance.now();
      b.click();
      (function tick() {
        if (document.querySelector('.ic-card.is-current [data-phrase="p0"].is-spoken')) return res(performance.now() - t0);
        if (performance.now() - t0 > 2000) return res(Infinity);
        requestAnimationFrame(tick);
      })();
    }));
    expect(ms).toBeLessThan(250);
    await playing(page);
    await expect(playButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(playButton(page)).toHaveAttribute('aria-label', 'Pause');
    expect((await audio(page)).src).toBe(`/assets/narration/${SLUG}/${idAt5}.mp3`);
  });

  test('at three sampled currentTime values the underlined phrase matches the metadata', async ({ page }) => {
    const m = meta(idAt5);
    await page.goto(URL_PILOT5);
    await settle(page);
    await playButton(page).click();
    await playing(page);
    // While playing: sampled in the same frame as the underline. A sample may
    // straddle a boundary by one frame, so the previous phrase is accepted
    // only within 50 ms of it.
    for (const at of [1.2, 4.5, 8]) {
      await playing(page, at);
      const s = await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => {
        const a = document.querySelector('#ic-deck audio');
        res({ t: a.currentTime, ids: [...new Set([...document.querySelectorAll('.is-spoken')].map((x) => x.getAttribute('data-phrase')))] });
      })));
      expect(s.ids).toHaveLength(1);
      const want = expected(m, s.t);
      if (s.ids[0] !== want) {
        const p = m.phrases.find((x) => x.id === want);
        expect(Math.abs(s.t - p.start), `at ${s.t} underlined ${s.ids[0]}, metadata says ${want}`).toBeLessThan(0.05);
      }
    }
    // Paused at exact times: no tolerance.
    await playButton(page).click();
    for (const p of [m.phrases[2], m.phrases[Math.floor(m.phrases.length / 2)], m.phrases[m.phrases.length - 2]]) {
      await seek(page, (p.start + p.end) / 2);
      expect(await spoken(page)).toEqual([p.id]);
    }
  });

  test('pause freezes the underline; resume continues from the paused position', async ({ page }) => {
    await page.goto(URL_PILOT5);
    await settle(page);
    await playButton(page).click();
    await playing(page, 2);
    await playButton(page).click();
    await expect(playButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(playButton(page)).toHaveAttribute('aria-label', 'Read this card aloud');
    const a1 = await audio(page);
    const s1 = await spoken(page);
    expect(a1.paused).toBe(true);
    expect(s1).toHaveLength(1);
    await page.waitForTimeout(700);
    expect((await audio(page)).t).toBe(a1.t);
    expect(await spoken(page)).toEqual(s1);
    await playButton(page).click();
    await expect(playButton(page)).toHaveAttribute('aria-pressed', 'true');
    const after = await page.evaluate(() => new Promise((res) => {
      const a = document.querySelector('#ic-deck audio');
      const seen = [];
      (function tick() { seen.push(a.currentTime); if (seen.length < 30) requestAnimationFrame(tick); else res(seen); })();
    }));
    expect(Math.min(...after)).toBeGreaterThanOrEqual(a1.t - 0.01);
    expect(Math.max(...after)).toBeGreaterThan(a1.t);
  });

  test('seeking to a time inside p4 underlines p4', async ({ page }) => {
    const p4 = meta(idAt5).phrases[4];
    await page.goto(URL_PILOT5);
    await settle(page);
    await playButton(page).click();
    await playing(page);
    await seek(page, p4.start + (p4.end - p4.start) / 3);
    await expect.poll(() => spoken(page), { timeout: 1000 }).toEqual(['p4']);
  });

  test('completion clears the underline and resets the button; no auto-advance', async ({ page }) => {
    const m = meta(idAt5);
    await page.goto(URL_PILOT5);
    await settle(page);
    const cardBefore = await page.locator('.ic-card.is-current').getAttribute('data-id');
    await playButton(page).click();
    await playing(page);
    await seek(page, m.duration - 0.4);
    await expect(page.locator('#ic-live')).toHaveText('Finished reading.', { timeout: 3000 });
    expect(await spoken(page)).toEqual([]);
    const b = page.locator(`.ic-insight[data-id="${cardBefore}"] .ic-play`);
    await expect(b).toHaveAttribute('aria-pressed', 'false');
    await expect(b).toHaveAttribute('aria-label', 'Read this card aloud');
    await page.waitForTimeout(500);
    expect(await page.locator('.ic-card.is-current').getAttribute('data-id')).toBe(cardBefore);
    expect((await audio(page)).paused).toBe(true);
  });

  // Each route lands on a different card: card 4 (narrated) or the terminal card (not narrated).
  for (const [how, act, narrated] of [
    ['arrow key', async (page) => { await page.keyboard.press('ArrowLeft'); }, true],
    ['chevron', async (page) => { await page.locator('#ic-deck').hover(); await page.locator('.ic-next').click(); }, false],
    ['swipe', async (page) => { await page.locator('.ic-rail').evaluate((el) => el.scrollBy({ left: -el.clientWidth * 0.7, behavior: 'instant' })); }, true],
  ]) {
    test(`card change by ${how} while playing stops audio, clears the underline and resets the button; ${narrated ? 'the new card then plays' : 'the terminal card stays silent'}`, async ({ page }) => {
      await page.goto(URL_PILOT5);
      await settle(page);
      const was = page.locator(`.ic-insight[data-id="${idAt5}"] .ic-play`);
      await was.click();
      await playing(page, 0.5);
      await act(page);
      await expect(was).toHaveAttribute('aria-pressed', 'false');
      await expect(was).toHaveAttribute('aria-label', 'Read this card aloud');
      expect(await page.locator(`.ic-insight[data-id="${idAt5}"] .is-spoken`).count()).toBe(0);
      await settle(page);
      if (narrated) {
        const now = await page.locator('.ic-card.is-current').getAttribute('data-id');
        expect(now).not.toBe(idAt5);
        await playing(page);
        expect((await audio(page)).src).toBe(`/assets/narration/${SLUG}/${now}.mp3`);
        await expect(playButton(page)).toHaveAttribute('aria-pressed', 'true');
        await expect.poll(() => page.locator('.is-spoken').evaluateAll((els) => els.every((e) => e.closest('.ic-card').classList.contains('is-current')))).toBe(true);
      } else {
        await page.waitForTimeout(600);
        const a = await audio(page);
        expect(a.paused).toBe(true);
        expect(a.src).toBeNull();
        expect(await spoken(page)).toEqual([]);
      }
    });
  }

  test('choosing a path while a card plays stops it, and the new first card plays', async ({ page }) => {
    await page.goto(`${CARDED_URL}?card=1`);
    await settle(page);
    const first = await page.locator('.ic-card.is-current').getAttribute('data-id');
    await playButton(page).click();
    await playing(page);
    const opt = cards.situation.options.find((o) => o.order[0] !== first);
    await page.getByRole('radio', { name: opt.label }).click(); // visible at the deck's left edge
    await expect(page.locator(`.ic-insight[data-id="${first}"] .ic-play`)).toHaveAttribute('aria-pressed', 'false');
    await settle(page);
    await playing(page);
    expect((await audio(page)).src).toBe(`/assets/narration/${SLUG}/${opt.order[0]}.mp3`);
    await expect(page.locator('.ic-play[aria-pressed="true"]')).toHaveCount(1);
  });

  test('moving to a narrated card plays it without pressing Play', async ({ page }) => {
    await captureEvents(page);
    await page.goto(URL_PILOT5);
    await settle(page);
    await page.locator('.ic-rail').focus();
    await page.keyboard.press('ArrowLeft');
    await settle(page);
    await playing(page);
    const id = await page.locator('.ic-card.is-current').getAttribute('data-id');
    expect((await audio(page)).src).toBe(`/assets/narration/${SLUG}/${id}.mp3`);
    await expect(playButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => spoken(page)).toHaveLength(1);
    const ev = (await page.evaluate(() => window.__events)).filter((e) => e.name === 'cards_play');
    expect(ev).toEqual([{ name: 'cards_play', props: { card: 4, path: 'pilot', trigger: 'auto' } }]);
  });

  test('after a pause nothing plays on any card until Play is pressed; then moving on plays again', async ({ page }) => {
    await page.goto(URL_PILOT5);
    await settle(page);
    await playButton(page).click();
    await playing(page);
    await playButton(page).click(); // pause
    await page.locator('.ic-rail').focus();
    for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowRight']) {
      await page.keyboard.press(key);
      await settle(page);
      await page.waitForTimeout(600);
      expect((await audio(page)).paused, key).toBe(true);
      expect(await spoken(page)).toEqual([]);
      await expect(page.locator('.ic-play[aria-pressed="true"]')).toHaveCount(0);
    }
    // Play on this card turns it back on: it plays, and so does the next card.
    await playButton(page).click();
    await playing(page);
    await page.locator('.ic-rail').focus();
    await page.keyboard.press('ArrowLeft');
    await settle(page);
    await playing(page);
    expect((await audio(page)).src).toBe(`/assets/narration/${SLUG}/${await page.locator('.ic-card.is-current').getAttribute('data-id')}.mp3`);
  });

  test('a pause on an autoplayed card also keeps every later card silent', async ({ page }) => {
    await page.goto(`${CARDED_URL}?path=pilot&card=2`);
    await settle(page);
    await page.locator('.ic-rail').focus();
    await page.keyboard.press('ArrowRight'); // card 3 autoplays
    await settle(page);
    await playing(page);
    await playButton(page).click(); // pause
    await expect(playButton(page)).toHaveAttribute('aria-pressed', 'false');
    await page.locator('.ic-rail').focus();
    for (let i = 0; i < 2; i++) { await page.keyboard.press('ArrowRight'); await settle(page); }
    await page.waitForTimeout(600);
    expect((await audio(page)).paused).toBe(true);
    await expect(page.locator('.ic-play[aria-pressed="true"]')).toHaveCount(0);
  });

  test('moving quickly through cards plays only the card the deck rests on', async ({ page }) => {
    await captureEvents(page);
    await page.goto(`${CARDED_URL}?path=pilot&card=1`);
    await settle(page);
    await page.locator('.ic-rail').focus();
    // Three quick moves, faster than the deck rests on any card.
    for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80); }
    await settle(page);
    await playing(page);
    const plays = (await page.evaluate(() => window.__events)).filter((e) => e.name === 'cards_play');
    expect(plays).toHaveLength(1);
    expect(plays[0].props.card).toBe(await page.locator('.ic-card.is-current .ic-n').evaluate((n) => parseInt(n.textContent, 10)));
  });

  test('from the situation card, choosing a path starts the first card reading with no Play press', async ({ page }) => {
    await captureEvents(page);
    await page.goto(CARDED_URL);
    await settle(page);
    await page.getByRole('radio', { name: pilot.label }).click();
    await settle(page);
    await playing(page);
    expect((await audio(page)).src).toBe(`/assets/narration/${SLUG}/${pilot.order[0]}.mp3`);
    const plays = (await page.evaluate(() => window.__events)).filter((e) => e.name === 'cards_play');
    expect(plays).toEqual([{ name: 'cards_play', props: { card: 1, path: 'pilot', trigger: 'auto' } }]);
  });

  test('the first gesture in the deck primes the audio element with silence, then card 1 autoplays', async ({ page }) => {
    await page.addInitScript(() => {
      window.__srcs = [];
      const orig = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__srcs.push(this.getAttribute('src')); return orig.apply(this, arguments); };
    });
    await page.goto(CARDED_URL);
    await settle(page);
    await page.locator('.ic-rail').focus();
    await page.keyboard.press('ArrowRight'); // the move from the situation card to card 1
    await settle(page);
    await playing(page);
    const srcs = await page.evaluate(() => window.__srcs);
    expect(srcs[0]).toMatch(/^data:audio\/mpeg;base64,/);
    expect(srcs.slice(1)).toEqual([`/assets/narration/${SLUG}/${cards.default_order[0]}.mp3`]);
    // Priming is silent: one announcement, for the real start only.
    await expect(page.locator('#ic-live')).toHaveText('Reading card aloud.');
    // It happens once: later gestures don't prime again.
    await page.keyboard.press('ArrowRight');
    await settle(page);
    await playing(page);
    expect((await page.evaluate(() => window.__srcs)).filter((x) => x.startsWith('data:'))).toHaveLength(1);
  });

  // iOS model: an element is unlocked only once a play() started in a gesture
  // actually gets going, which on a phone can take a while. Until then, any
  // play() outside a gesture is refused. Here the silent clip takes 1.5 s to
  // start, longer than the deck takes to settle and autoplay to fire.
  test('autoplay waits for a slow unlock instead of cancelling it (first swipe on iPhone)', async ({ page }) => {
    await page.addInitScript(() => {
      let unlocked = false;
      const orig = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        const el = this, src = el.getAttribute('src') || '';
        if (src.startsWith('data:')) {
          return new Promise((res, rej) => setTimeout(() => {
            if (el.getAttribute('src') === src) { unlocked = true; res(); } else rej(new DOMException('interrupted', 'AbortError'));
          }, 1500));
        }
        if (!unlocked) return Promise.reject(new DOMException('needs a gesture', 'NotAllowedError'));
        return orig.apply(el, arguments);
      };
    });
    await page.goto(CARDED_URL);
    await settle(page);
    await page.locator('.ic-rail').focus();
    await page.keyboard.press('ArrowRight'); // the one gesture: first move off the situation card
    await settle(page);
    await page.waitForFunction(() => { const a = document.querySelector('#ic-deck audio'); return !a.paused && a.currentTime > 0.3; }, null, { timeout: 5000 });
    expect((await audio(page)).src).toBe(`/assets/narration/${SLUG}/${cards.default_order[0]}.mp3`);
  });

  test('a touch that starts a swipe in the deck tries the unlock at touchstart', async ({ page }) => {
    await page.addInitScript(() => {
      window.__srcs = [];
      const orig = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__srcs.push(this.getAttribute('src')); return orig.apply(this, arguments); };
    });
    await page.goto(CARDED_URL);
    await settle(page);
    await page.locator('.ic-rail').dispatchEvent('touchstart');
    await expect.poll(() => page.evaluate(() => window.__srcs.length)).toBe(1);
    expect((await page.evaluate(() => window.__srcs))[0]).toMatch(/^data:audio\/mpeg/);
  });

  test('?narration-debug shows an on-screen log; without it there is none', async ({ page }) => {
    await page.goto(`${CARDED_URL}?narration-debug`);
    await settle(page);
    await page.locator('.ic-rail').focus();
    await page.keyboard.press('ArrowRight');
    await settle(page);
    await playing(page);
    const text = await page.locator('body > pre').last().textContent();
    expect(text).toMatch(/unlock try on keydown/);
    expect(text).toMatch(/unlocked/);
    expect(text).toMatch(/start auto/);
    expect(text).toMatch(/playing/);
    await page.goto(CARDED_URL);
    await expect(page.locator('body > pre')).toHaveCount(0);
  });

  test('a tap outside the deck does not prime or play anything', async ({ page }) => {
    await page.addInitScript(() => {
      window.__plays = 0;
      const orig = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__plays++; return orig.apply(this, arguments); };
    });
    await page.goto(URL_PILOT5);
    await settle(page);
    await page.locator('#ic-article p').first().click();
    await page.keyboard.press('a');
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__plays)).toBe(0);
  });

  test('a start the browser blocks (autoplay policy) rests silently, with no warning', async ({ page }) => {
    const warnings = [];
    page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = function () { return Promise.reject(new DOMException('blocked', 'NotAllowedError')); };
    });
    await page.goto(URL_PILOT5);
    await settle(page);
    await page.locator('.ic-rail').focus();
    await page.keyboard.press('ArrowLeft');
    await settle(page);
    await page.waitForTimeout(700);
    await expect(page.locator('.ic-play[aria-pressed="true"]')).toHaveCount(0);
    expect(await spoken(page)).toEqual([]);
    expect(warnings).toEqual([]);
    await expect(page.locator('#ic-live')).not.toHaveText('Reading card aloud.');
  });

  test('rapid switching: 20 card changes in 2 s never leave two sounds or a stale underline', async ({ page }) => {
    await page.goto(`${CARDED_URL}?card=2`);
    await settle(page);
    await page.locator('.ic-rail').focus();
    const log = await page.evaluate(() => new Promise((res) => {
      const a = document.querySelector('#ic-deck audio');
      const rail = document.querySelector('.ic-rail');
      const out = { maxPressed: 0, staleUnderline: false };
      let n = 0;
      const t0 = performance.now();
      (function step() {
        // Press Play on the current card, then change card, every 100 ms.
        const b = rail.querySelector('.ic-card.is-current .ic-play');
        if (b && b.getAttribute('aria-pressed') !== 'true') b.click();
        const key = n % 4 < 2 ? 'ArrowRight' : 'ArrowLeft';
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        n++;
        const check = () => {
          out.maxPressed = Math.max(out.maxPressed, document.querySelectorAll('.ic-play[aria-pressed="true"]').length);
          const s = document.querySelector('.is-spoken');
          if (s && !s.closest('.ic-card').querySelector('.ic-play[aria-pressed="true"]') && !a.paused) out.staleUnderline = true;
        };
        check();
        if (n < 20) setTimeout(step, 100);
        else setTimeout(() => { check(); out.ms = performance.now() - t0; res(out); }, 100);
      })();
    }));
    expect(log.ms).toBeLessThanOrEqual(2200);
    expect(log.maxPressed).toBeLessThanOrEqual(1);
    expect(log.staleUnderline).toBe(false);
    await settle(page);
    // Once the deck rests, exactly the current card plays (autoplay), and nothing else.
    await playing(page);
    const a = await audio(page);
    expect(a.count).toBe(1); // one media element, so two sounds are impossible
    const id = await page.locator('.ic-card.is-current').getAttribute('data-id');
    expect(a.src).toBe(`/assets/narration/${SLUG}/${id}.mp3`);
    await expect(page.locator('.ic-play[aria-pressed="true"]')).toHaveCount(1);
    await expect(playButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.locator('.is-spoken').evaluateAll((els) => els.length > 0 && els.every((e) => e.closest('.ic-card').classList.contains('is-current')))).toBe(true);
  });

  test('missing audio file: button returns to Play, one console warning, navigation still works', async ({ page }) => {
    const warnings = [];
    page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
    await page.route('**/*.mp3', (r) => r.fulfill({ status: 404, body: 'not found' }));
    await page.goto(URL_PILOT5);
    await settle(page);
    await playButton(page).click();
    await expect(playButton(page)).toHaveAttribute('aria-pressed', 'false', { timeout: 3000 });
    await page.waitForTimeout(500);
    expect(warnings.filter((w) => w.includes('[insight-cards] narration'))).toHaveLength(1);
    expect(await spoken(page)).toEqual([]);
    await page.locator('.ic-rail').focus();
    await page.keyboard.press('ArrowLeft');
    await settle(page);
    await expect.poll(() => new URL(page.url()).searchParams.get('card')).toBe('4');
  });

  test('missing timing file: button returns to Play, one console warning', async ({ page }) => {
    const warnings = [];
    page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
    await page.route('**/assets/narration/**/*.json', (r) => r.fulfill({ status: 404, body: '' }));
    await page.goto(URL_PILOT5);
    await settle(page);
    await playButton(page).click();
    await expect(playButton(page)).toHaveAttribute('aria-pressed', 'false', { timeout: 3000 });
    expect((await audio(page)).paused).toBe(true);
    expect(warnings.filter((w) => w.includes('[insight-cards] narration'))).toHaveLength(1);
  });

  test('nothing plays on page load or from a deep link', async ({ page }) => {
    await page.addInitScript(() => {
      window.__plays = 0;
      const orig = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__plays++; return orig.apply(this, arguments); };
    });
    for (const u of [CARDED_URL, URL_PILOT5, `${CARDED_URL}?card=2`]) {
      await page.goto(u);
      await settle(page);
      await page.waitForTimeout(700);
      expect(await page.evaluate(() => window.__plays), u).toBe(0);
      expect(await page.evaluate(() => [...document.querySelectorAll('audio')].every((a) => !a.hasAttribute('src')))).toBe(true);
    }
  });

  test('cards_play fires once with card and path through trackEvent', async ({ page }) => {
    await captureEvents(page);
    await page.goto(URL_PILOT5);
    await settle(page);
    await playButton(page).click();
    await playing(page);
    await playButton(page).click(); // pause
    await playButton(page).click(); // resume: not a new play
    const ev = (await page.evaluate(() => window.__events)).filter((e) => e.name === 'cards_play');
    expect(ev).toEqual([{ name: 'cards_play', props: { card: 5, path: 'pilot', trigger: 'button' } }]);
  });
});

test.describe('accessibility', () => {
  test('button is keyboard operable with a visible focus ring; aria-pressed tracks state; focus never moves', async ({ page }) => {
    await page.goto(URL_PILOT5);
    await settle(page);
    const b = page.locator(`.ic-insight[data-id="${idAt5}"] .ic-play`);
    // Only the current card's button is in the Tab order.
    expect(await page.locator('.ic-play').evaluateAll((els) => els.filter((e) => e.tabIndex === 0).map((e) => e.closest('.ic-card').dataset.id))).toEqual([idAt5]);
    // Keyboard modality (the deck's own Tab order runs through the situation
    // options first, which moves the deck), then focus the button.
    await page.locator('.ic-rail').focus();
    await page.keyboard.press('Shift');
    await b.focus();
    await expect(b).toBeFocused();
    expect(await b.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    const ring = await b.evaluate((el) => { const s = getComputedStyle(el); return [s.outlineStyle, parseFloat(s.outlineWidth)]; });
    expect(ring[0]).not.toBe('none');
    expect(ring[1]).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Enter');
    await playing(page);
    await expect(b).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(1500); // several phrases pass
    await expect(b).toBeFocused();
    await page.keyboard.press('Space');
    await expect(b).toHaveAttribute('aria-pressed', 'false');
    await expect(b).toBeFocused();
  });

  test('one polite announcement on start, one on completion, none per phrase', async ({ page }) => {
    const m = meta(idAt5);
    await page.goto(URL_PILOT5);
    await settle(page);
    await page.evaluate(() => {
      window.__said = [];
      new MutationObserver(() => window.__said.push(document.getElementById('ic-live').textContent))
        .observe(document.getElementById('ic-live'), { childList: true, characterData: true, subtree: true });
    });
    await playButton(page).click();
    await playing(page, 2.5);
    await seek(page, m.duration - 0.3);
    await expect(page.locator('#ic-live')).toHaveText('Finished reading.', { timeout: 3000 });
    expect(await page.evaluate(() => window.__said)).toEqual(['Reading card aloud.', 'Finished reading.']);
    await expect(page.locator('#ic-live')).toHaveAttribute('aria-live', 'polite');
  });

  for (const scheme of ['light', 'dark']) {
    for (const state of ['at rest', 'mid-playback']) {
      test(`axe: zero WCAG 2.2 AA violations with the button present, ${scheme} scheme, ${state}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(URL_PILOT5);
        await settle(page);
        await expect(playButton(page)).toBeVisible();
        if (state === 'mid-playback') { await playButton(page).click(); await playing(page, 1); }
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).include('#ic-deck').analyze();
        expect(r.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`))).toEqual([]);
      });
    }
  }
});

test.describe('design and budgets', () => {
  test('the underline is a plain underline in the text\'s ink colour, not amber', async ({ page }) => {
    await page.goto(URL_PILOT5);
    await settle(page);
    await playButton(page).click();
    await playing(page, 0.5);
    const s = await page.locator('.is-spoken').first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { line: cs.textDecorationLine, colour: cs.textDecorationColor, ink: cs.color, bg: cs.backgroundColor,
        thick: cs.textDecorationThickness, offset: cs.textUnderlineOffset, anim: cs.animationName, trans: cs.transitionDuration };
    });
    expect(s.line).toBe('underline');
    expect(s.colour).toBe(s.ink);
    expect(siteColours().has(s.colour)).toBe(true);
    expect(s.colour).not.toBe('rgb(255, 160, 0)');
    expect(s.bg).toBe('rgba(0, 0, 0, 0)');
    expect(s.anim).toBe('none');
    expect(s.trans).toBe('0s');
    expect(parseFloat(s.offset)).toBeGreaterThan(0);
  });

  test('every colour the button and underline use is from the site token set', async ({ page }) => {
    await page.goto(URL_PILOT5);
    await settle(page);
    await playButton(page).hover();
    const css = fs.readFileSync(path.join(ROOT, 'assets/css/insight-cards-narration.css'), 'utf8');
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b|rgba?\(|hsla?\(|@import|@font-face|transition|animation/i);
    const allowed = siteColours();
    const used = await page.locator('.ic-play, .ic-play *').evaluateAll((els) => [...new Set(els.flatMap((el) => {
      const cs = getComputedStyle(el);
      // fill only paints on SVG content.
      return [cs.color, cs.borderTopColor, el instanceof SVGElement ? cs.fill : ''].filter((v) => /^rgb\(/.test(v));
    }))]);
    expect(used.filter((c) => !allowed.has(c))).toEqual([]);
  });

  for (const width of [375, 1280]) {
    test(`${width}px: no card scrolls internally with the button showing, and the counter keeps its place`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 375 ? 667 : 800 });
      for (const q of ['', '?path=basics', '?path=order', '?path=pilot']) {
        await page.goto(CARDED_URL + q);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('.ic-play').first()).toBeVisible();
        const bad = await page.locator('.ic-card').evaluateAll((els) => els.filter((e) => e.scrollHeight > e.clientHeight + 1
          || Math.max(...[...e.children].map((c) => c.getBoundingClientRect().bottom)) > e.getBoundingClientRect().bottom).map((e) => e.getAttribute('aria-label')));
        expect(bad, q).toEqual([]);
        const geo = await page.locator('.ic-insight').evaluateAll((els) => els.map((c) => {
          const card = c.getBoundingClientRect(), n = c.querySelector('.ic-n').getBoundingClientRect();
          const b = c.querySelector('.ic-play').getBoundingClientRect(), t = c.querySelector('.ic-title').getBoundingClientRect();
          return { gap: card.right - n.right, sameRow: Math.abs((b.top + b.bottom) / 2 - (n.top + n.bottom) / 2), clear: b.right <= n.left, w: b.width, h: b.height, overTitle: b.left < t.right - parseFloat(getComputedStyle(c.querySelector('.ic-title')).paddingRight) };
        }));
        for (const g of geo) {
          expect(g.gap).toBeLessThan(32);
          expect(g.sameRow).toBeLessThan(3);
          expect(g.clear).toBe(true);
          expect(g.overTitle).toBe(false);
          expect(Math.min(g.w, g.h)).toBeGreaterThanOrEqual(24); // WCAG 2.2 target size
        }
        const hs = await page.locator('.ic-card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
        expect(Math.max(...hs)).toBeLessThanOrEqual(Math.min(520, page.viewportSize().height));
      }
    });
  }

  test('narration CSS and JS are under 6 KB gzipped; deck assets stay under 10 KB', async () => {
    const gz = (f) => zlib.gzipSync(fs.readFileSync(path.join(ROOT, f)), { level: 9 }).length;
    const deck = { css: gz('assets/css/insight-cards.css'), js: gz('assets/js/insight-cards.js') };
    const narration = { css: gz('assets/css/insight-cards-narration.css'), js: gz('assets/js/insight-cards-narration.js') };
    const sizes = { deck: { ...deck, total: deck.css + deck.js }, narration: { ...narration, total: narration.css + narration.js } };
    console.log(`gzip sizes: ${JSON.stringify(sizes)}`);
    fs.mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'test-results/narration-sizes.json'), JSON.stringify(sizes));
    expect(sizes.deck.total).toBeLessThan(10 * 1024);
    expect(sizes.narration.total).toBeLessThan(6 * 1024);
  });

  test('no credentials or Google client code reach the browser or the built site', async () => {
    const files = [];
    const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(js|css|html|json)$/.test(f)) files.push(p); } };
    walk(path.join(ROOT, '_site'));
    for (const f of files) {
      const s = fs.readFileSync(f, 'utf8');
      expect(s, f).not.toMatch(/AIza[0-9A-Za-z_-]{35}|"private_key"|refresh_token|client_secret|ya29\.|texttospeech\.googleapis|google-auth-library/);
    }
  });
});

test.describe('screenshots', () => {
  const OUT = path.join(ROOT, 'test-results', 'screenshots');
  for (const width of [375, 1280]) {
    for (const scheme of ['light', 'dark']) {
      test(`narration screenshots ${width} ${scheme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 375 ? 667 : 800 });
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(URL_PILOT5);
        await page.evaluate(() => document.fonts.ready);
        await settle(page);
        await page.mouse.move(0, 0);
        await page.screenshot({ path: path.join(OUT, `narration-${width}-${scheme}-1-rest.png`) });
        await playButton(page).click();
        await playing(page, 3.2);
        await page.mouse.move(0, 0);
        expect((await spoken(page)).length).toBe(1);
        await page.screenshot({ path: path.join(OUT, `narration-${width}-${scheme}-2-playing.png`) });
      });
    }
  }
});

// Keeps the helper import honest if the article's cards change.
test('the test URL lands on an insight card with narration', async ({ page }) => {
  await page.goto(URL_PILOT5);
  await expect(page.locator('.ic-card.is-current')).toHaveAttribute('data-id', idAt5);
  expect(insightById[idAt5]).toBeTruthy();
});
