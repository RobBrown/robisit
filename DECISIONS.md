# Insight Cards: decisions log

Every judgement call made while building Insight Cards (PRD v2.1), with one line of reasoning each.

## What the repo looks like (found before writing code)

- **Build mode: legacy GitHub Pages builder.** `gh api repos/RobBrown/robisit/pages` returns `"build_type": "legacy"`, source `main` `/`. There's no `.github/` directory and no custom workflow (the only Action is GitHub's own `pages-build-deployment`). Custom Ruby plugins won't run in production, so no Jekyll plugin was written.
- **Jekyll version.** The `Gemfile` pins `github-pages` (no version). Pages currently runs `github-pages 232`, Jekyll 3.10.0, kramdown 2.4.0 with `kramdown-parser-gfm` 1.1.0, Liquid 4.0.4, and Ruby 3.3.4 (from pages.github.com/versions.json).
- **Markdown converter.** kramdown with GFM input (the github-pages default). It auto-generates heading ids with the GFM algorithm: lowercase, strip non-word characters, spaces become hyphens. For example, `## AI Adoption ≠ New Tool` becomes `id="ai-adoption--new-tool"`. These ids come from a real build, not hand-written anchors.
- **Layout.** One layout, `_layouts/article.html`, used by the `articles` collection (`_articles/*.md`, permalink `/thoughts/:name/`). All CSS is inline in that file. No external stylesheet, no `_includes/`, no `_sass/`.
- **Design tokens.** There are none as CSS custom properties. The palette is hex literals in `article.html`: a single dark scheme on warm near-black `#0a0600`, text `#d4cfc6`/`#eae6df`, muted `#9e9789`/`#706a5e`/`#585249`, rules `#1e1a14`/`#241f18`/`#2e2820`, surface `#14100a`, accent amber `#ffa000`, link `#b8a47e`. Typefaces: Lora for prose and headings, Inter for UI text (date, byline, buttons), Bebas Neue for the brand mark. The site has no light scheme and no `prefers-color-scheme` rules anywhere.
- **Analytics on the site today.** PostHog (inline snippet in the layout). No Cloudflare beacon. `curl -I https://robisit.com` shows `server: GitHub.com` with no Cloudflare proxy in front, so Cloudflare's automatic Web Analytics injection and Zaraz aren't available either.
- **Existing scripts in the layout** run on `.body`: `[subscribe]` and `[contents]` marker replacement. The `[contents]` script only assigns an id to a heading that lacks one, so it never changes kramdown's ids.
- **Local build.** No Ruby toolchain is usable on the host (system Ruby 2.6 is too old for github-pages 232). The site builds in Docker (`ruby:3.3` + `bundle exec jekyll build`), via `scripts/build-site.sh`.

## Decisions

### Build, validation and CI

- **No Jekyll plugin.** The legacy builder won't run one. Build-time gating is a Liquid include (`_includes/insight-cards-valid.html`) that mirrors PRD 4.2 and decides whether the deck renders. The warnings come from `scripts/validate-cards.js` in CI. Two copies of the rules is the price of no plugins. The fixture site tests run both copies against the same 20 cases.
- **Anchors are checked against rendered output.** The Liquid gate looks for `<hN id="…">` in the page's rendered `content`. The Node validator reads the built `_site` HTML when given `--site`, and otherwise falls back to a port of kramdown-parser-gfm's id algorithm. A test checks that the port matches Jekyll's real ids on every existing post.
- **The CI job builds with the github-pages gem** so anchors are checked against real ids. If the Jekyll build fails, it falls back to derived ids instead of failing. The job never fails on card warnings (PRD 4.3/4.4). `Gemfile.lock` is gitignored in this repo, so `setup-ruby` resolves gems fresh each run.
- **Tests serve the Jekyll build statically** (`tests/serve.js` over `_site/`) rather than running `jekyll serve`. The output is identical, Playwright restarts faster, and the host needs no Ruby. `npm run build` runs Jekyll in Docker.
- **Dev tooling is excluded from the Jekyll output** (`_config.yml` `exclude`). The baseline snapshot test confirms this changed no published page.
- **Non-carded snapshots are committed** under `tests/fixtures/baseline/`. They're from the pre-change build of every non-carded article, the home page and `/content`. If one of those pages changes on purpose later, its snapshot needs regenerating.
- **`js-yaml` is a dev dependency** for the validator and tests only. Nothing ships to readers.

### Analytics (PRD 7)

- **Cloudflare Web Analytics has no custom events.** Cloudflare's FAQ (developers.cloudflare.com/web-analytics/faq/), asked whether custom events are supported, answers: "Not yet, but we may add support for this in the future." On top of that, robisit.com isn't on Cloudflare at all: responses come from `server: GitHub.com` and no beacon is present.
- **So the events go through `trackEvent(name, props)` with an adapter boundary.** A page can define `window.insightCardsAnalytics = function (name, props) {…}`. If none is defined, events are logged to the console as `[insight-cards] name {props}`. Adapter errors are swallowed so analytics can never break reading.
- **Getting these events into Cloudflare would need Cloudflare Zaraz.** That means moving robisit.com's DNS to Cloudflare with proxying on (orange cloud), enabling Zaraz, and setting the adapter to `(n, p) => window.zaraz && zaraz.track(n, p)`. Zaraz custom events land in Zaraz's own reporting or a configured tool, not the Web Analytics dashboard.
- **Not wired to PostHog**, even though it is already on the site, because PRD 7 says "no cookies, no identifiers" and PostHog keeps a distinct id. It's a one-line adapter (`posthog.capture(n, p)`) if Rob prefers it. That's his call.
- **`path` is `"default"`** when the reader hasn't picked a situation, so every event carries a path.
- **`cards_handoff` has one route, `terminal`, and fires once per page view** (the article is always open; see below). Later clicks still jump but don't count again. `card` is the counter position at the time of the click, and `anchor` is the path's anchor.
- **`cards_depth` is tracked from page load against the whole article.** It fires once per threshold (25/50/75/100). `route` is `"none"` until the reader uses the terminal control and `"terminal"` after, so readers who jumped in can be compared with readers who scrolled. The PRD's terminal-versus-link comparison no longer applies, because there is no link.

### Visual design (PRD 6, with owner direction of 2026-10-24)

- **Palette: the site's.** The site is dark-only, warm near-black with amber, and has no light scheme. Every colour in the deck is an existing hex value from `article.html`. The only exception is black `rgba()` drop shadows, as on the site's menu. `insight-cards.css` names the values as `--ic-*` tokens, each commented with where the site uses it. Tests fail on any other colour, under both `prefers-color-scheme` values.
- **Type.** Lora (prose) and Inter (labels, buttons), already loaded by the site. Titles are 700, the site's h2 weight. Nothing extra is loaded.
- **Cards: compact bordered panels.** Cards are `min(80vw, 400px)` wide on `#1e1a14`, with a solid 2px `#3d3529` border, a 14px radius and a drop shadow. This overrides PRD 5.2's ~86% and 560px. The card text is 15.5px/1.65 (16.5px/1.7 above 600px), with 20px (22px) titles. Every card in a deck takes the tallest card's height. With ~79-word bodies that's 468px at 375px wide and 406px on desktop, inside PRD 6.3's 520px cap from 375px up.
- **The current card leads.** Its border turns dark amber (`#c06800`, the nav brand colour) through an `is-current` class the script sets. Its neighbours' contents drop to 72% opacity, the lowest value that keeps the amber counter at AA contrast. The terminal button is never dimmed. Secondary text (`resolves`) is `#b8b09e` so it holds contrast when dimmed. There are no transitions (PRD 5.5).
- **Counter.** Amber, in the site's TL;DR label style, in the card's top-right corner level with the title. Every card's title starts at the same height. The situation card has no visible counter ("Start" was removed), but its group label is still "Start" for screen readers.
- **Controls.** Options are 6px-radius boxes. The selected one takes an amber border with a 3px amber left rule (PRD 6.3). "Read the article" on the last card is amber-filled (`#0a0600` on `#ffa000`) and turns to an amber outline on hover. The chevrons are round.
- **Section labels.** "TL;DR in N cards" above the deck and "Full Article Published on <date>" below it use the site's TL;DR label style (Inter 14px 600, tracked, amber), with the second part in muted text. The deck region is labelled by the TL;DR heading. These labels replace the PRD's ban on lede and hint text, by owner direction. The "Full Article" line is never hidden, so without JavaScript it is the post's date line.
- **Masthead on carded posts.** The layout adds `class="ic-page"` to `<article>` and leaves out the date, view counts and header rule (inline `{% unless ic_valid %}`). The top padding (28px, 16px on phones) and the gap under the title are tighter. Posts without cards are byte-identical to before, and the baseline tests check this. The same header could go site-wide later, but that would change every post.

### Deck behaviour and markup (PRD 3, 5, 8)

- **The article is open on load** (owner direction). This overrides PRD 5.6's collapsed article. The deck sits above it as a TL;DR, there's no reveal link, and the terminal control jumps to the path's anchor. It moves focus there and scrolls, instantly under reduced motion.
- **Cards are server-rendered** by Liquid in the default order, not built in JS as in the prototype. The card text is in the HTML, and the script only reorders nodes for a path.
- **No-JS fallback.** The TL;DR heading and the deck ship with the `hidden` attribute, and the script unhides them. With no JS, or a failed script, the page is the plain article plus the "Full Article" date line (PRD 10, ACC-11).
- **The script loads synchronously right after the article**, so the deck appears before first paint and the page doesn't shift. It's about 3 KB gzipped.
- **Geometry, as in the prototype.** Cards snap to the start edge, so the current card always lines up with the text column and the next card shows to its right. The last card sits at the column's right edge. Arrow keys, chevrons and deep links scroll to the same edge, using the rail's `scroll-padding`. Above 600px wide the rail fades its clipped edges into the page. The chevrons sit over the card edges.
- **First screen.** On a 375×667 phone, the whole first card is on the first screen (tested at 375×667, 1280×800 and 1440×900). There's no `max-height`, so at 200% zoom (ACC-09) cards grow rather than scroll internally.
- **Each situation option is a tabbable `role="radio"` button** (the prototype's pattern), not a roving-tabindex radio group, because arrow keys belong to deck navigation (PRD 5.3, ACC-01).
- **Arrow keys** are ignored when a modifier is held (Alt+Left is browser Back) and inside form fields. They act only while the deck is on screen, and repeated presses during a smooth scroll queue from the target card, not the current one.
- **A disabled chevron hands focus to its sibling**, so Tab never loops back into the deck.
- **The live region stays silent on page load.** On change it announces "Card n of N." plus the card's title (or the terminal's `knows` line).
- **Deep links.** An unknown `path` is ignored and `card` is clamped to the deck. Other query parameters (e.g. `utm_*`) and the hash are preserved. Without a situation card, `card=1` is the first insight.

### Content

- **No existing article gets cards.** Cards aren't applied retroactively (owner direction, 2026-10-24). The whitepaper's draft block was removed, and that post is byte-identical to the pre-change build again. A test checks that no article other than the test page renders a deck.
- **The test page is `_articles/hello-world-cards.md`** (`/thoughts/hello-world-cards/`). It's an obvious "Hello, World" page: five test cards (one per behaviour: hello, counter, swipe, jump, links), three paths, a terminal card and a short placeholder body with one heading per path anchor. Card bodies are 76–79 words, close to the ceiling on purpose, so the fit tests mean something. The `pilot` path id is kept so `?path=pilot&card=3` still works.
- **The test page is unlisted.** The new `unlisted: true` front matter key hides it from `/content` (a `where_exp` filter; the listing is otherwise byte-identical) and adds `<meta name="robots" content="noindex">`. It's still reachable by URL so the deck can be tested in production.

### Testing

- **"iPhone SE emulation" uses Playwright's `iPhone SE (3rd gen)`** (375×667, WebKit). Playwright's plain `iPhone SE` is the 320px first-generation model.
- **axe scope.** The deck and both TL;DR labels must have zero WCAG 2.2 AA violations. The whole page may show only the site's pre-existing contrast failures in the nav brand, TOC subtitle and footer (`.brand`, `.toc-sub`, `.copy`). Those are on every post today and are flagged rather than restyled, since restyling them would change every post.
- **Screenshots for the review package** come from `tests/screenshots.spec.js` and are written to `test-results/screenshots/`.
