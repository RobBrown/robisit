# Insight Cards: design brief

Restyling the TL;DR card deck so it belongs to robisit.com. Appearance only:
behaviour, navigation, the YAML schema and the article reveal are unchanged.

## What the site already does

**Home page (`index.html`)** is the source of the look.

- Palette as CSS custom properties on `body`: `--bg #0a0600`, phosphor amber
  `--p #ffa000`, `--p-dim #c06800`, `--p-text #ffe4a0`, glow ramps
  `--p-r1..r5` (`255,160,60` down to `120,50,0`), and a full green theme
  (`body.green`, `--p #00c800`, `--p-text #a0e8a0`).
- Type: Bebas Neue for the name and stats, Share Tech Mono for every label,
  readout and link, Space Mono for the bio.
- The panel (`.card`): square corners, 1px border at `rgba(--p-r2, .2)`,
  translucent dark fill, and four corner brackets (13px, 1.5px amber; top-left
  and bottom-right at .7, the other two at .35). This bracket is the site's
  signature.
- Phosphor: the name glows with a five-step amber `text-shadow` stack,
  scanlines are burned over it, and it flickers on a 6s step cycle.
- Atmosphere behind the panel: a canvas grid, a slow scanline sweep band and a
  radial vignette, all fixed to the viewport.
- Labels (`.eyebrow`): mono, uppercase, tracked .3em, amber, with a 22px rule in
  front.
- Links (`.ci`): mono, 1px tinted border, faint tinted fill; on hover a 2px
  amber rule grows on the left and the row nudges 3px right.
- Motion: staggered fade-ups on load, a typewriter bio with a block cursor
  blinking at 1.4 Hz, and a CRT power-off (`crt-off`, a vertical collapse to a
  bright line) when leaving the page.

**Article layout (`_layouts/article.html`)** is calmer and editorial: Lora
for prose and headings, Inter for UI text, a warm near-black page with
`#d4cfc6` text, `#14100a` surfaces, `#1e1a14` rules, 4-6px radii, amber for
labels and accents. Its only CRT elements are the glowing, flickering
"ROB BROWN" brand in the nav and the amber TL;DR label.

## Diagnosis: why the cards feel foreign

1. **The silhouette is an app card.** A 14px radius, a 2px solid grey border
   and a soft drop shadow is the default card of every component library. No
   panel on the site is shaped like this: home is square with brackets, the
   article uses 4-6px.
2. **The surface is flat.** `#1e1a14` is the menu-hover colour, a UI fill, not
   glass. Nothing suggests a screen: no depth at the edges, no phosphor.
3. **The "current" signal is a border colour change.** The site signals focus
   with light (glow, brackets, a lit rule), not with an outline swap.
4. **No terminal voice.** The counter, the TL;DR label and the button are all
   Inter. The home page speaks in Share Tech Mono everywhere a machine would
   speak; the cards never do, so the deck has no link to the home page at all.
5. **Controls are generic.** The options are rounded grey boxes and the
   chevrons are round floating buttons. The site already has a better option
   row (`.ci`) and never uses circles.
6. **The green situation card is a one-off trick.** A blurred 1px green trace
   on an otherwise amber, rounded card reads as a different component, not as
   the same screen switched to its green phosphor.

## Direction: a screen in the article

Each card is a small CRT screen set into the page. It borrows the home
panel's colours, glow and type, but not its square shape: the cards should
remind you of the picture tube itself. The prose stays in Lora so it reads exactly like the article
around it. The machine speaks only where a machine would: the counter, the
labels, the buttons.

- **Tube and bezel.** The glass has soft, slightly elliptical corners
  (26px by 30px), like a CRT face. Around it, a dark housing ring with a fine
  tinted outer edge stands in for the monitor's bezel. Both are drawn with
  shadows, so they take no layout space.
- **Glass.** The fill is the site surface `#14100a`, with inset black
  shadows that darken the edges like a curved tube, a faint amber bloom at the
  centre (5%), a faint reflection at the upper left, and 1px scanlines every
  3px. All of it sits in the card's own background, under the text, so it
  never reduces contrast.
- **Phosphor headings.** Card titles take the home page's `--p-text`
  (`#ffe4a0`) with a soft amber glow. Body text stays `#d4cfc6` Lora, the
  article's own body colour, with no glow.
- **Terminal readouts.** The counter, the "TL;DR in N cards" label and both
  "Read The Full Article" buttons use Share Tech Mono, uppercase and tracked,
  as on the home page. The label gets the home eyebrow's leading rule.
- **The current card is lit, not outlined.** Its border and bezel edge light
  up and a faint phosphor halo appears around it. Neighbours stay dimmed as
  now.
- **Flicker.** The current card's lit bezel flickers like the nav brand: three
  brief dips on a 7-second step cycle, never more than one a second. Only the
  bezel flickers; text never does.
- **Power-on.** When a card becomes current, a dim amber line opens vertically
  across the glass and fades, about 0.45s: the home page's `crt-off` played
  in reverse, once per card change. The text is fully there from the first
  frame; the effect is on a layer that ends transparent.
- **The green screen.** The situation card is the home page's green theme:
  green bezel, halo and bloom, and options styled as the home `.ci` rows in
  green. The selected option takes the lit left rule and green text. (This
  changes the selected option from amber to green; see below.) The prompt
  keeps the amber phosphor of the other titles, so every card's heading
  reads the same.
- **Controls.** Options become `.ci` rows. Chevrons become small square
  terminal keys. The amber-filled primary button stays, squared off and set
  in mono.
- **Read-aloud highlight.** The spoken phrase keeps its ink-coloured
  underline and gains a faint phosphor glow, as if the beam is passing over it.
  Both come from tokens (`--ic-spoken-glow`), so the highlight can be retuned
  in one place.

**Motion and reduced motion.** The motion is the power-on (one pulse per
card change, low amplitude), the bezel flicker on the current card, and short
hover transitions copied from `.ci`. Dimming a card's text is instant. Under `prefers-reduced-motion: reduce` all of
it is off: cards are simply lit or dimmed, which is the full static design.
The flicker's dips are at least a second apart and are partial (to 40-80%
brightness) on a thin border, and each power-on belongs to a different card,
so the 3-per-second limit cannot be reached, even by swiping fast.

**Tokens.** New values are added as `--ic-*` custom properties in
`insight-cards.css`, each commented with its source in `index.html`.
`--ic-mono` is Share Tech Mono, a font the site already uses. It is loaded
only on carded posts.

## What I am deliberately not doing

- **Flicker on text.** Text that flickers while you read it for a minute is
  tiring, and it is a flash risk. Only the bezel flickers.
- **The home page's square panel and corner brackets.** Tried first and
  rejected in review: the cards should look like the tube, not like the home
  panel.
- **Scanlines over the text.** The home page burns them over the name, which is
  display type. Over 16px body copy they cut contrast and blur letterforms.
  Here they sit under the text.
- **A moving sweep band.** It's the home page's best effect, but on a card
  you are reading, motion behind the words pulls the eye. Easy to add as an
  option if you want to see it.
- **Segmented progress or dots.** The counter already says where you are and
  the next card always shows at the edge. The PRD rejected dots for the same
  reason, and the deck takes no extra controls.
- **Channel-change transitions, noise grain, barrel distortion, chromatic
  fringing.** Costume. They would also fight the native scroll-snap motion
  and, for distortion, make text non-crisp.
- **Mono or Bebas for card text.** Mono prose is slow to read and Bebas is
  all-caps display. The prose stays Lora so the cards and the article read as
  one voice.
- **Changing the counter format** ("3/8"). It is set by the script; the
  readout feel comes from type alone, so no behaviour changes.

## Superseded rules

The PRD (5.5, 6) and `DECISIONS.md` said: no animation of any kind, every
colour a hex value from `article.html`, a low-contrast border with a radius,
and selected options in amber. This design replaces those by owner direction
(2026-10-25). `DECISIONS.md` records the new rules, and the tests enforce
them: colours only from `article.html` or the home page's amber and green
themes, `--ic-serif`, `--ic-sans` or `--ic-mono` type, no motion at all under
`prefers-reduced-motion: reduce`, and flicker only on the current card at no
more than one dip a second.
