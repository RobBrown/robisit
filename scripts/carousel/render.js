/* Renders carousel slides to a PDF with Playwright's Chromium.
 *
 * Waits for the inlined fonts and fails if any is missing (never a silent
 * fallback face), shrinks each slide's type until nothing overflows, then
 * prints one 1080x1350 px page per slide.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { renderHtml, SLIDE_W, SLIDE_H } = require('./template');

const FONT_CHECKS = [
  ['Atkinson Hyperlegible Next', '700 20px'],
  ['Atkinson Hyperlegible Next', '400 20px'],
  ['Atkinson Hyperlegible Mono', '400 20px'],
  ['Bebas Neue', '400 20px'],
];
const BODY_FLOOR = 28, TITLE_FLOOR = 44;

/* In-page overflow measurement, shared by the fit loop and the spec. Returns
   one entry per problem: { slide, el, why }. Text blocks must fit their own box
   and sit inside the card's content box; everything must sit inside the card
   and the slide (1 px tolerance). Art is exempt from the content-box rule only:
   it bleeds sideways into the padding, as on the site. */
function measure(tol) {
  const problems = [];
  document.querySelectorAll('.slide').forEach((slide, idx) => {
    const sr = slide.getBoundingClientRect();
    if (Math.round(sr.width) !== 1080 || Math.round(sr.height) !== 1350) problems.push({ slide: idx, el: 'slide', why: `size ${sr.width}x${sr.height}` });
    const card = slide.querySelector('.card');
    const cr = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    const box = {
      l: cr.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft),
      r: cr.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight),
      t: cr.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop),
      b: cr.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom),
    };
    if (card.scrollHeight > card.clientHeight + tol || card.scrollWidth > card.clientWidth + tol) {
      problems.push({ slide: idx, el: 'card', why: `scroll ${card.scrollWidth}x${card.scrollHeight} > ${card.clientWidth}x${card.clientHeight}` });
    }
    card.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      const name = `${el.tagName.toLowerCase()}.${el.className}`;
      const isArt = el.classList.contains('art');
      if (r.width === 0 && r.height === 0) return;
      if (r.left < sr.left - tol || r.right > sr.right + tol || r.top < sr.top - tol || r.bottom > sr.bottom + tol) {
        problems.push({ slide: idx, el: name, why: 'outside slide' });
      }
      if (r.left < cr.left - tol || r.right > cr.right + tol || r.top < cr.top - tol || r.bottom > cr.bottom + tol) {
        problems.push({ slide: idx, el: name, why: 'outside card' });
      }
      if (!isArt && (r.left < box.l - tol || r.right > box.r + tol || r.top < box.t - tol || r.bottom > box.b + tol)) {
        problems.push({ slide: idx, el: name, why: 'outside content box' });
      }
      if (!isArt && (el.scrollHeight > el.clientHeight + tol || el.scrollWidth > el.clientWidth + tol)) {
        problems.push({ slide: idx, el: name, why: `text overflows its block (${el.scrollWidth}x${el.scrollHeight} > ${el.clientWidth}x${el.clientHeight})` });
      }
    });
  });
  return problems;
}

const checkOverflow = (page, tol = 1) => page.evaluate(measure, tol);

// Steps each slide's type down until it fits; returns the final sizes per slide.
async function fit(page) {
  return page.evaluate(({ measureSrc, bodyFloor, titleFloor }) => {
    const measureFn = new Function(`return (${measureSrc})`)();
    const sizes = [];
    const slides = [...document.querySelectorAll('.slide')];
    slides.forEach((slide, idx) => {
      const mine = () => measureFn(1).filter((p) => p.slide === idx);
      const get = (v) => parseFloat(slide.style.getPropertyValue(v));
      let guard = 200;
      while (mine().length && guard-- > 0) {
        const body = get('--body'), title = get('--title');
        if (body <= bodyFloor && title <= titleFloor) break;
        slide.style.setProperty('--body', `${Math.max(bodyFloor, body - 2)}px`);
        slide.style.setProperty('--title', `${Math.max(titleFloor, title - 4)}px`);
      }
      const left = mine();
      if (left.length) throw new Error(`slide ${idx + 1} (${slide.dataset.kind}) does not fit at the minimum type size: ${left.map((p) => `${p.el} ${p.why}`).join('; ')}`);
      sizes.push({ slide: idx + 1, kind: slide.dataset.kind, body: get('--body'), title: get('--title') });
    });
    return sizes;
  }, { measureSrc: measure.toString(), bodyFloor: BODY_FLOOR, titleFloor: TITLE_FLOOR });
}

async function assertFonts(page) {
  await page.evaluate(() => document.fonts.ready);
  for (const [family, spec] of FONT_CHECKS) {
    const ok = await page.evaluate((f) => document.fonts.check(f), `${spec} "${family}"`);
    if (!ok) throw new Error(`font not loaded: ${family}`);
  }
}

async function renderPdf(slides, { browser } = {}) {
  let launched = null;
  if (!browser) launched = browser = await require('@playwright/test').chromium.launch();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carousel-'));
  let context = null;
  try {
    context = await browser.newContext({ viewport: { width: SLIDE_W, height: SLIDE_H }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.emulateMedia({ media: 'print' });
    const file = path.join(dir, 'deck.html');
    fs.writeFileSync(file, renderHtml(slides));
    await page.goto(`file://${file}`);
    await assertFonts(page);
    const sizes = await fit(page);
    const pdf = await page.pdf({
      width: `${SLIDE_W}px`, height: `${SLIDE_H}px`, printBackground: true, preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return { pdf, pages: slides.length, fit: sizes };
  } finally {
    if (context) await context.close();
    if (launched) await launched.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { renderPdf, checkOverflow, assertFonts, fit, FONT_CHECKS };
