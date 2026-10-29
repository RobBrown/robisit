/* Standalone slide HTML for the LinkedIn carousel.
 *
 * One self-contained document: fonts and art are inlined as data: URLs, so
 * rendering needs no network and no file:// font loads (which Chromium treats
 * as cross-origin). Every slide is drawn as the deck's current, lit card:
 * the CRT screen from assets/css/insight-cards.css, scaled up to 1080x1350
 * (4:5, the largest portrait a LinkedIn document shows without cropping),
 * with no motion because this is print.
 *
 * Type sizes are CSS variables (--body, --title) on each slide; render.js
 * steps them down until nothing overflows.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { liquidEscape: esc } = require('../narration/segment');

const FONT_DIR = path.resolve(__dirname, '../../assets/fonts');
// Same families and weight ranges as assets/css/type.css.
const FONTS = [
  { family: 'Atkinson Hyperlegible Next', file: 'atkinson-hyperlegible-next-latin-wght-normal.woff2', style: 'normal', weight: '200 800' },
  { family: 'Atkinson Hyperlegible Next', file: 'atkinson-hyperlegible-next-latin-wght-italic.woff2', style: 'italic', weight: '200 800' },
  { family: 'Atkinson Hyperlegible Mono', file: 'atkinson-hyperlegible-mono-latin-wght-normal.woff2', style: 'normal', weight: '200 800' },
  { family: 'Bebas Neue', file: 'bebas-neue-latin-400-normal.woff2', style: 'normal', weight: '400' },
];

const SLIDE_W = 1080, SLIDE_H = 1350;
const START = { cover: { title: 84, body: 40 }, insight: { title: 60, body: 38 }, closing: { title: 54, body: 36 } };

const fontFaces = () => FONTS.map((f) => `@font-face{font-family:'${f.family}';font-style:${f.style};font-weight:${f.weight};font-display:block;`
  + `src:url(data:font/woff2;base64,${fs.readFileSync(path.join(FONT_DIR, f.file)).toString('base64')}) format('woff2')}`).join('\n');

const CSS = `
@page{size:${SLIDE_W}px ${SLIDE_H}px;margin:0}
:root{
  --font-text:'Atkinson Hyperlegible Next',system-ui,sans-serif;
  --font-mono:'Atkinson Hyperlegible Mono',ui-monospace,monospace;
  --font-brand:'Bebas Neue',Impact,sans-serif;
  /* Tokens copied from assets/css/insight-cards.css (the lit current card). */
  --page:#0a0600;                           /* index.html --bg */
  --glass:#14100a;                          /* --ic-surface */
  --ink:#d4cfc6;                            /* --ic-ink */
  --ink-soft:#b8b09e;                       /* --ic-ink-soft */
  --accent:#ffa000;                         /* --ic-accent, index.html --p */
  --phosphor:#ffe4a0;                       /* --ic-phosphor */
  --scan:rgba(0,0,0,.3);                    /* --ic-scan */
  --tube:rgba(0,0,0,.55);                   /* --ic-tube */
  --bloom:rgba(255,160,0,.05);              /* --ic-bloom */
  --bezel:rgba(210,100,0,.2);               /* --ic-bezel */
  --bezel-on:rgba(210,100,0,.5);            /* --ic-bezel-on */
  --housing:#0e0b06;                        /* --ic-housing */
  --glare:rgba(255,228,160,.045);           /* --ic-glare */
  --halo:rgba(210,100,0,.3);                /* --ic-halo */
  --title-glow:0 0 24px rgba(255,160,60,.22);   /* --ic-title-glow, scaled 2x */
  --readout-glow:0 0 12px rgba(255,160,0,.45);  /* --ic-readout-glow, scaled 2x */
  --pad:72px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--page);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.slide{position:relative;width:${SLIDE_W}px;height:${SLIDE_H}px;overflow:hidden;background:var(--page);break-after:page;page-break-after:always}
.slide:last-child{break-after:auto;page-break-after:auto}
.card{
  position:absolute;inset:56px;display:flex;flex-direction:column;gap:36px;padding:var(--pad);
  color:var(--ink);font-family:var(--font-text);line-height:1.5;
  background:
    radial-gradient(ellipse 70% 45% at 22% 8%,var(--glare),transparent 70%),
    repeating-linear-gradient(to bottom,transparent 0 4px,var(--scan) 4px 5px),
    radial-gradient(ellipse 110% 80% at 50% 40%,var(--bloom),transparent 70%),
    var(--glass);
  border:2px solid var(--bezel);border-radius:56px / 64px;
  box-shadow:inset 0 0 112px var(--tube),inset 0 0 28px var(--tube),
    0 0 0 10px var(--housing),0 0 0 12px var(--bezel),0 28px 60px -16px rgba(0,0,0,.9);
}
/* The lit bezel of the current card. */
.card::before{
  content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;
  box-shadow:0 0 0 2px var(--bezel-on),0 0 0 10px var(--housing),0 0 0 12px var(--bezel-on),0 0 60px -8px var(--halo);
}
.title{margin:0;font-weight:700;font-size:var(--title);line-height:1.2;color:var(--phosphor);text-shadow:var(--title-glow);text-wrap:balance;overflow-wrap:break-word}
.body{margin:0;font-size:var(--body);line-height:1.5;color:var(--ink);overflow-wrap:break-word}
.n{
  position:absolute;top:var(--pad);right:var(--pad);margin:0;
  font-family:var(--font-mono);font-size:30px;line-height:1.2;letter-spacing:.16em;text-transform:uppercase;
  color:var(--accent);text-shadow:var(--readout-glow);font-variant-numeric:tabular-nums;white-space:nowrap;
}
.insight .title{padding-right:170px}
.closing .title{padding-right:170px}
.closing .body{color:var(--ink-soft)}

/* Art: only the room the text leaves, as on the site (.ic-art). */
.art{
  flex:1 1 0;min-height:0;max-height:320px;margin:auto -36px -12px;
  background:center bottom/contain no-repeat;opacity:.78;
  -webkit-mask-image:linear-gradient(90deg,transparent,black 14%,black 86%,transparent);
  mask-image:linear-gradient(90deg,transparent,black 14%,black 86%,transparent);
}

.eyebrow{
  display:flex;align-items:center;gap:20px;margin:0;
  font-family:var(--font-mono);font-size:28px;line-height:1.2;letter-spacing:.3em;text-transform:uppercase;
  color:var(--accent);text-shadow:var(--readout-glow);
}
.eyebrow::before{content:"";flex:none;width:44px;height:2px;background:var(--accent)}
.cover .mid{margin:auto 0;display:flex;flex-direction:column;gap:44px}
.cover .title{padding-right:0}
.cover .body{color:var(--ink)}
.cover .foot{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}
.byline{margin:0;font-family:var(--font-brand);font-size:72px;line-height:1;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);text-shadow:var(--title-glow)}
.swipe{margin:0;font-family:var(--font-mono);font-size:26px;line-height:1.2;letter-spacing:.24em;text-transform:uppercase;color:var(--ink-soft);white-space:nowrap}

.closing .end{margin-top:auto;display:flex;flex-direction:column;gap:32px;padding-top:36px;border-top:2px solid var(--bezel-on)}
.url{margin:0;font-family:var(--font-mono);font-size:32px;line-height:1.35;color:var(--accent);text-shadow:var(--readout-glow);overflow-wrap:anywhere}
.follow{margin:0;font-size:40px;line-height:1.25;font-weight:700;color:var(--ink)}
`;

function slideHtml(s) {
  const start = START[s.kind];
  const vars = `--title:${start.title}px;--body:${start.body}px`;
  const counter = s.n ? `<p class="n">${s.n}/${s.total}</p>` : '';
  let inner;
  if (s.kind === 'cover') {
    inner = `<p class="eyebrow">${esc(s.readout)}</p>
<div class="mid"><h1 class="title">${esc(s.title)}</h1><p class="body">${esc(s.hook)}</p></div>
<div class="foot"><p class="byline">${esc(s.byline)}</p><p class="swipe">Swipe →</p></div>`;
  } else if (s.kind === 'insight') {
    const art = s.art
      ? `<div class="art" aria-hidden="true" style="background-image:url(data:image/webp;base64,${fs.readFileSync(s.art).toString('base64')})"></div>`
      : '';
    inner = `${counter}<h2 class="title">${esc(s.title)}</h2><p class="body">${esc(s.body)}</p>${art}`;
  } else {
    inner = `${counter}<h2 class="title">${esc(s.knows)}</h2><p class="body">${esc(s.resolves)}</p>
<div class="end"><p class="url">${esc(s.url)}</p><p class="follow">${esc(s.follow)}</p></div>`;
  }
  return `<section class="slide ${s.kind}" data-kind="${s.kind}" style="${vars}"><div class="card">${inner}</div></section>`;
}

function renderHtml(slides) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Carousel</title>
<style>
${fontFaces()}
${CSS}
</style></head><body>
${slides.map(slideHtml).join('\n')}
</body></html>
`;
}

module.exports = { renderHtml, FONTS, FONT_DIR, SLIDE_W, SLIDE_H };
