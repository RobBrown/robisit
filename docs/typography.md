# Typography for robisit.com

Status: comparing three pairings on the `typography-review` branch. Nothing is chosen yet.

## 1. Audit (main @ 2be3f69)

### Faces in use

| Face | Where | Loaded from | Weights / styles |
|---|---|---|---|
| Lora | Article body, h1–h3, TL;DR, listing excerpts and hero quote, card prose and titles | Google Fonts CSS, render-blocking `<link>` | 400, 700, 400 italic |
| Inter | Nav, date, byline, tables, TOC, footer, subscribe form, listing meta and sort bar | Google Fonts | 400, 600 |
| Bebas Neue | "ROB BROWN" wordmark (nav and home), home stat values | Google Fonts | 400 |
| Share Tech Mono | Home labels; card counter, "TL;DR in N cards", buttons (carded posts only) | Google Fonts | 400 |
| Space Mono | All running text on the home page (bio, contact rows) | Google Fonts (preload + print-media swap) | 400, 700 |
| System mono (`ui-monospace`, SF Mono) | Inline and block code in articles | Local | Whatever the OS has |

That is five web families from a third-party CDN. Every page view sends the reader's IP to Google, and articles block rendering on that stylesheet. Lora and Inter come to roughly 125 KB of latin woff2. Bebas Neue and Share Tech Mono add about 14 KB each, and Space Mono adds 2 × ~20 KB on the home page.

### Sizes, leading and measure

- Article body: Lora 19px / 1.85 (mobile 17px / 1.8). The column is 660px minus 48px padding = 612px, about 64–68 characters per line. The measure is good. **The leading is too loose for it:** 1.85 at 64 cpl breaks lines apart, so the eye reads lines instead of paragraphs. 1.6–1.7 is the usual range for this measure.
- Headings: h1 36px, h2 24px, h3 20px, all Lora 700. **h3 is 20px over a 19px body.** Weight alone separates it from the text.
- Insight card prose: Lora 15.5px / 1.65. That is smaller than the article, which suits a short card.
- Home bio: **Space Mono at 0.74rem (≈11.8px) with 1.95 leading.** This is running text set in a wide monospace below 12px, and it is the worst reading experience on the site.
- Home labels (`.sl`, `.ss`, `.lbl`, `.fc`, `.fa`): **0.46–0.5rem, i.e. 7.4–8px.** These are below legibility on most displays, and the 0.32–0.55 opacity on top makes them decoration rather than text.

### Inconsistencies and problems

- **Three monospaces with no system.** Share Tech Mono is used for labels, Space Mono for running text, and the OS mono for code. A reader sees three "machine voices".
- **Faux styles.** `.toc-sub` and the listing `cite` ask for Inter italic, which isn't loaded, so the browser slants roman glyphs. Bold italic Lora isn't loaded either; `stop-building-islands.md` uses `***` twice.
- **Contrast of secondary text** on `#0a0600`: `#706a5e` 3.8:1, `#585249` 2.6:1 (byline, footer stats, listing meta), `#3d3529` 1.7:1 (copyright). The last two fail WCAG AA at these 12–13px sizes. Colour is outside this brief, but it hurts reading more than any typeface choice, so it is noted here.
- **Lora on dark.** Lora is a calligraphic "brushed" serif. Its high stroke contrast and slightly condensed lowercase work in print. Light-on-dark text looks bolder and blooms at the edges (irradiation, or halation for readers with astigmatism; see [Level Access][halation]), and a contrasted face loses its hairlines first. At 19px Lora holds up, but card prose at 15.5px begins to shimmer.

## 2. Research

### What the evidence supports

- **No single best font.** In Wallace et al. (ACM TOCHI 2022), each reader's fastest font beat their slowest by about 35% in words per minute, with no loss of comprehension, and the fastest font differed from person to person ([paper][wallace], [Adobe Research][wallace-adobe]). So the job is to pick a face from the well-made, open-aperture, generous-x-height group and set it well. Searching for a mythical "most readable font" is wasted effort.
- **Size above the critical print size matters more than the face.** Reading speed plateaus once x-height clears the critical print size; sizes in normal publishing sit in the "fluent" range ([Legge & Bigelow 2011][legge]). This argues for a sensible body size, and for never setting labels at 7–8px.
- **Fixed-width type reads slower than proportional type at normal sizes.** Mansfield, Legge & Bane (1996) found proportional Times faster than fixed-width Courier for normally sighted readers once print was above the critical size ([paper][mansfield]). This supports the brief's rule: mono for labels and code, never for running text. The home bio breaks that rule today.
- **Character distinction** (Il1, O0, rn/m, b/c) is the explicit design goal of Atkinson Hyperlegible, from the Braille Institute; the 2025 *Next* release added weights and a mono ([Braille Institute via All About Vision][atkinson-aav], [Adobe Fonts][atkinson-next]). The evidence is the designers' own description plus low-vision client feedback. There is no independent reading-speed study.
- **Literata** was commissioned by Google from TypeTogether for Google Play Books. The brief was sustained reading on many screens and rendering systems, and the design is a Scotch/old-style hybrid with sturdy, low-contrast serifs ([TypeTogether][literata], [Reading typography blog][literata-reading]).
- **Light on dark.** Irradiation makes light strokes look heavier and fuzzier. Practical mitigations are an off-white text colour (the site already does this with `#d4cfc6`), avoiding hairline contrast, and avoiding extra-tight tracking ([Level Access][halation]). The evidence is mostly accessibility practice rather than controlled studies.

### Candidates by role

| Role | Candidate | For | Against |
|---|---|---|---|
| Body | **Literata** | Built for screen reading; sturdy low-contrast serifs survive dark backgrounds; real italic; variable 200–900; OFL | Larger file than Lora (≈52 KB per style) |
| Body | **Source Serif 4** | Fournier-style transitional with clear forms and good numerals; variable; OFL; renders evenly on Windows ClearType | Slightly cooler and more "corporate" than the room wants |
| Body | Lora (current) | Already familiar | Calligraphic contrast shimmers on dark at small sizes; condensed lowercase |
| Body | Newsreader | Lovely optical sizes | Optical sizes needed to look right, which doubles the payload; text cut is close to Source Serif |
| Body | Charter / XCharter | Superb at low resolution | No variable font; italics are weaker; limited web licensing for Bitstream Charter |
| Headings | Literata (heavier) | One family, fewer bytes | Less contrast with the body |
| Headings | **Fraunces** | Soft, wonky "Old Style" display serif in the Windsor/Cooper tradition: it *is* the 1970s office, without being a terminal | Too characterful for anything below 20px; use it only for h1–h3 |
| UI | **IBM Plex Sans** | IBM's corporate sans, which is the right office for this site; open apertures; distinct Il1 | Its italic would cost another 50 KB, so the UI has no italic |
| UI | Inter (current) | Excellent at 12–14px | Neutral to the point of anonymity; no period flavour |
| UI | **Atkinson Hyperlegible Next** | Maximal character distinction | Quirky shapes become visible in long paragraphs |
| Mono | **IBM Plex Mono** | Typewriter warmth, real italics, distinct 0/O and 1/l; matches Plex Sans; 15 KB | Static weights only (ship 400 only) |
| Mono | **JetBrains Mono** | Tall x-height, built for code at small sizes; variable | Feels like an IDE, not an office |
| Mono | Atkinson Hyperlegible Mono | Pairs with Atkinson; very distinct | Young; less character |
| Mono | Share Tech Mono (current labels) | Strong "readout" look | No bold or italic; narrow, thin strokes; only good uppercase-tracked |
| Mono | VT323, IBM 3270, Departure Mono | Very period | Imitate a terminal, which the brief rules out; pixel faces blur at fractional sizes |
| Wordmark | Bebas Neue (keep) | It is the brand; used only as a logo | Not a text face; never extend it beyond the wordmark and stat numerals |

Rejected outright: Berkeley Mono and Söhne (commercial licences, no free self-hosting), Space Mono for running text (see Mansfield), and any pixel or VT-style face for anything but a logo.

## 3. Shortlist

All three are self-hosted, use the latin subset and the variable weight axis, and are OFL-licensed. Bebas Neue stays as the wordmark in all three. Payloads are for an article page; a face downloads only when a page uses it.

### A. Reading Room (recommended)

Literata body and headings · IBM Plex Sans UI · IBM Plex Mono labels and code.

- Body 19px / 1.7 (mobile 17.5 / 1.65); headings Literata 650 with slight negative tracking.
- ≈ 52 + 54 (italic) + 46 + 15 = **≈167 KB**, about the same as today, with no third-party request.
- Why: Literata was designed for exactly this job (long reading on screens), and its sturdier serifs hold up better than Lora's hairlines on warm dark glass. Plex gives a single, coherent machine voice for UI, labels and code. It also has a real 1970s-office lineage (IBM corporate type) without imitating a terminal. One serif family keeps the page calm for twenty minutes.

### B. Phosphor Press

Source Serif 4 body · Fraunces headings · Inter UI · JetBrains Mono labels and code.

- Body 19.5px / 1.68; headings Fraunces 600.
- ≈ 51 + 52 + 37 + 48 + 40 = **≈228 KB**.
- Why consider it: Fraunces carries the most atmosphere, a soft 70s display serif, and it is confined to headings, so reading isn't affected. The cost is two serif voices and the heaviest payload.

### C. Hyperlegible

Atkinson Hyperlegible Next for everything · Atkinson Hyperlegible Mono.

- Body 18.5px / 1.65; headings 700.
- ≈ 34 + 38 + 18 = **≈90 KB**, the lightest.
- Why consider it: it has the best character distinction and one family to maintain. Against it: a sans for long-form reading is fine on screens, but the face's deliberate quirks (the slab on `l`, the open `1`) become noticeable over several thousand words, and it has the least period warmth.

## 4. Also changed in every candidate (independent of the face)

- Body leading tightened from 1.85 to 1.65–1.7.
- The TL;DR label uses the mono, like the card deck's labels.
- Home page: the bio and contact rows move from Space Mono to the UI face at ≈14px; labels use the pairing's mono and nothing is set below 10px.
- No faux italics: where the chosen UI face ships no italic, those lines are set upright.

## Sources

- Wallace et al., *Towards Individuated Reading Experiences*, ACM TOCHI 2022: [PDF][wallace], [Adobe Research][wallace-adobe]
- Legge & Bigelow, *Does print size matter for reading?*, Journal of Vision 2011: [PMC][legge]
- Mansfield, Legge & Bane, *Psychophysics of reading XV: font effects in normal and low vision*, 1996: [PDF][mansfield]
- Atkinson Hyperlegible: [All About Vision][atkinson-aav], [Adobe Fonts (Next)][atkinson-next]
- Literata: [TypeTogether][literata], [University of Reading typography blog][literata-reading]
- Halation and astigmatism: [Level Access][halation]

[wallace]: https://jeffhuang.com/papers/Readability_TOCHI22.pdf
[wallace-adobe]: https://research.adobe.com/publication/towards-individuated-reading-experiences-different-fonts-increase-reading-speed-for-different-individuals
[legge]: https://pmc.ncbi.nlm.nih.gov/articles/PMC3428264
[mansfield]: https://legge.dl8.umn.edu/sites/legge.psych.umn.edu/files/files/media/mansfield96_psychophysics_of_reading_xv-_font_effects_in_normal_and_low_vision.pdf
[atkinson-aav]: https://www.allaboutvision.com/low-vision/atkinson-hyperlegible-typeface/
[atkinson-next]: https://fonts.adobe.com/fonts/atkinson-hyperlegible-next
[literata]: https://type-together.com/Literata
[literata-reading]: https://blogs.reading.ac.uk/typography-at-reading/2015/05/
[halation]: https://www.levelaccess.com/blog/accessibility-for-people-with-astigmatism/
