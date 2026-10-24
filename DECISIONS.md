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
- **`cards_handoff` fires once per page view, with the first route.** Later terminal clicks still scroll but don't count again, so the handoff ratio can't exceed one per view. `card` is the counter position at handoff (`0` on the situation card). `anchor` is the path anchor for `terminal` and `#ic-article` for `link`.
- **`cards_depth` measures from where the reader entered the article to its end.** Measured against the whole article, a terminal reader dropped at a late anchor would instantly be credited with 25–75% depth. That would bias the PRD's terminal-versus-link comparison. It fires once per threshold, and only after reveal.

### Visual design (PRD 6)

- **Palette: the site's, exactly (owner direction, 2026-10-24).** The site is dark-only, warm near-black with amber. It has no ink navy and no light scheme. Every colour in the deck is an existing value from `article.html`, used for the same kind of element it styles on the site. Under both `prefers-color-scheme` values the deck renders the site's single scheme. Tests run both schemes.
- **Tokens.** The site has no CSS custom properties, so `insight-cards.css` defines `--ic-*` tokens whose values are hex literals copied from `article.html`. A test fails if the deck's CSS or computed styles use a colour that isn't in `article.html`.
- **Cards are compact bordered panels (owner direction, 2026-10-24: "stand out more, smaller, solid border").** Cards are `min(80vw, 400px)` wide on a `#1e1a14` surface with a solid 2px `#3d3529` border, a 14px radius and a black drop shadow. The current card's border turns dark amber (`#c06800`, the nav brand colour) via an `is-current` class the script sets. Neighbouring cards' contents drop to 72% opacity. That's the lowest value that keeps the amber counter at AA contrast, and the terminal button is never dimmed. There's no transition (PRD 5.5). Type steps down with the card: body 15.5px/1.65 (16.5px/1.7 above 600px), titles 20px (22px). Secondary text (`resolves`) is `#b8b09e` so it holds contrast when dimmed. Cards take the tallest card's height and no longer stretch to fill the screen. The counter uses the TL;DR label style. Black `rgba()` shadows are the only colours outside the site's hex set.
- **Style: the rest of each deck element borrows an existing site component.** (Superseded for the card box: it was the `.toc` box, `#14100a` fill, `#241f18` border, 6px radius.) The card title and the terminal's `knows` line are `.body h2` (Lora 24px/1.3, 700, `#eae6df`). The card body is `.body p` (Lora 17px/1.8, or 19px/1.85 above 600px). Options are the subscribe input (`#2e2820` border, 4px radius, `#706a5e` on hover). The selected option takes the TL;DR block's 3px amber left rule. "Read the article" on the last card is amber-filled (`#0a0600` on `#ffa000`, owner direction), and turns to amber outline on hover. "Read the full article" is `footer .read-more` (Inter 14px 600, `#b8a47e`). The counter is Inter 13px, like `.date`, but in `#9e9789`, because `.date`'s `#706a5e` fails 4.5:1 contrast on the card surface. The prototype's Google Fonts aren't loaded.
- **Title weight is 700**, the site's h2 weight. The site only loads Lora 400/700.
- **Card height versus the PRD 6.3 cap of 520px.** In the site's type, a card with a ~79-word body measures 546px at 375px wide. That's over the cap but within a 667px screen, so a whole card is still readable without scrolling. Owner direction: the site's style wins. Tests now require cards to fit the screen at 375px, and to be 520px or less from 390px up. To get back under 520px at 375px, card bodies would need to stay under about 70 words.
- **Radius and shadows:** 14px cards with a drop shadow, 6px controls, round chevrons with a 2px border.
- **The selected option** takes an amber border with a 3px amber left rule (PRD 6.3), as in the prototype. The terminal control is the PRD's amber primary.
- **The chevrons' opacity transition was removed.** PRD 5.5 says "no other animation exists".
- **Masthead: the site's own article header, unchanged** (title, date, byline stats, rule), with the deck below it. That replaces the PRD's "title and one line of metadata". The header is shared markup in the layout, so carded and non-carded posts render it identically. Its date and byline contrast failures are pre-existing site issues.

### Deck behaviour and markup (PRD 3, 5, 8)

- **Cards are server-rendered** by Liquid in the default order, not built in JS as in the prototype. The card text is in the HTML, and the script only reorders nodes for a path.
- **No-JS fallback.** The deck and reveal link ship with the `hidden` attribute, and the script unhides them and collapses the article. No JS, or a failed script, leaves the plain article (PRD 10, ACC-11) without needing `<noscript>`.
- **The script loads synchronously right after the article**, not deferred, so the collapse happens before first paint as far as possible. It's 3 KB gzipped.
- **Geometry, as in the prototype (owner direction).** Cards snap to the start edge, so the current card always lines up with the text column and the next card shows to its right (about 40px on a phone, more on desktop, where it's dimmed). The last card sits at the column's right edge. Arrow keys, chevrons and deep links scroll to the same edge, using the rail's `scroll-padding`. Above 600px wide the rail fades its clipped edges into the page. Chevrons are round and sit over the card edges, as in the prototype. PRD 5.2's ~86%/560px width is overridden by the owner's call for smaller cards.
- **Height.** All cards in a deck share the height of the tallest (the rail stretches them). There's no `max-height`, so at 200% zoom (ACC-09) cards grow rather than scroll internally.
- **The reveal link is below the fold on a first load at 375×667 (832px), 390×844 (806px) and 1280×800 (835px)**, because the site header takes ~295px above the deck. It is on the first screen at 1280×900 and 1440×900, which the tests check.
- **Each situation option is a tabbable `role="radio"` button** (the prototype's pattern), not a roving-tabindex radio group, because arrow keys belong to deck navigation (PRD 5.3, ACC-01).
- **Arrow keys** are ignored when a modifier is held (Alt+Left is browser Back) and inside form fields. They act only while the deck is on screen, and repeated presses during a smooth scroll queue from the target card, not the current one.
- **A disabled chevron hands focus to its sibling.** Without this, Tab looped back into the deck and never reached the reveal link. The keyboard test caught it.
- **The live region stays silent on page load.** On change it announces "Card n of N." plus the card's title (or the terminal's `knows` line).
- **Deep links.** An unknown `path` is ignored and `card` is clamped to the deck. Other query parameters (e.g. `utm_*`) and the hash are preserved. Without a situation card, `card=1` is the first insight.
- **The deck stays above the article after reveal.** The article can't be re-collapsed (PRD 5.6).

### Content

- **No existing article gets cards.** Cards aren't applied retroactively (owner direction, 2026-10-24). The whitepaper's draft block was removed, and that post is byte-identical to the pre-change build again. A test checks that no article other than the test page renders a deck.
- **The test page is `_articles/hello-world-cards.md`** (`/thoughts/hello-world-cards/`). It's an obvious "Hello, World" page: five test cards, three paths, a terminal card and a short placeholder body with one heading per path anchor. Card bodies are 76–79 words, close to the ceiling on purpose, so the fit tests mean something. The `pilot` path id is kept so `?path=pilot&card=3` still works.
- **The test page is unlisted.** The new `unlisted: true` front matter key hides it from `/content` (a `where_exp` filter; the listing is otherwise byte-identical) and adds `<meta name="robots" content="noindex">`. It's still reachable by URL so the deck can be tested in production.

### Testing

- **"iPhone SE emulation" uses Playwright's `iPhone SE (3rd gen)`** (375×667, WebKit). Playwright's plain `iPhone SE` is the 320px first-generation model.
- **axe scope.** The deck and reveal link must have zero WCAG 2.2 AA violations. The whole page may show only the site's pre-existing contrast failures in the nav brand, header date, byline stats, TOC subtitle and footer (`.brand`, `.date`, `.stat`, `.toc-sub`, `.copy`). Those are on every post today and are flagged rather than restyled, since restyling them would change every post.
- **Screenshots for the review package** come from `tests/screenshots.spec.js` and are written to `test-results/screenshots/`.
