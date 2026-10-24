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

- **Palette: the site's, not the prototype's.** The site is dark-only, warm near-black with amber. It has no ink navy and no light scheme. PRD "ink navy for text" maps to the site's ink (`#d4cfc6`, headings `#eae6df`). Amber is `#ffa000`. Under both `prefers-color-scheme` values the deck renders the site's single scheme, because a light deck on a dark page would read as a second product (PRD 6.1). Tests run both schemes.
- **Tokens.** The site has no CSS custom properties, so `insight-cards.css` defines `--ic-*` tokens whose values are hex literals copied from `article.html`. A test fails if the deck's CSS or computed styles use a colour that isn't in `article.html`.
- **Typefaces.** Card titles, bodies and options are in Lora. The counter, primary button and reveal link are in Inter. This mirrors the site's own split (Lora for prose, Inter for UI text). The prototype's Google Fonts (Source Serif/Sans) are not loaded.
- **Title weight is 700, not the prototype's 600**, because the site only loads Lora 400/700.
- **Sizes.** Card body is 16px/1.55 (17px above 600px), smaller than the article's 17–19px/1.8. That's what keeps the longest 85-word body under the 520px cap at 375px wide.
- **Radius.** Cards use 6px (the site's `.toc` box). Options and buttons use 4px (the site's subscribe form). No shadows.
- **The selected option has an amber left rule only** (PRD 6.3). The prototype also turned the whole border amber.
- **The chevrons' opacity transition was removed.** PRD 5.5 says "no other animation exists".
- **Masthead.** It's the site's own `<h1>` plus one `.date` line ("July 6, 2026 · 27 min read"). The byline stats (reads, LinkedIn, Bluesky) move to the top of the collapsed article, since the masthead allows one line of metadata. The masthead date uses `#9e9789` instead of the site's `#706a5e`, which fails 4.5:1 contrast.

### Deck behaviour and markup (PRD 3, 5, 8)

- **Cards are server-rendered** by Liquid in the default order, not built in JS as in the prototype. The card text is in the HTML, and the script only reorders nodes for a path.
- **No-JS fallback.** The deck and reveal link ship with the `hidden` attribute, and the script unhides them and collapses the article. No JS, or a failed script, leaves the plain article (PRD 10, ACC-11) without needing `<noscript>`.
- **The script loads synchronously right after the article**, not deferred, so the collapse happens before first paint as far as possible. It's 3 KB gzipped.
- **Geometry.** Cards are `min(86vw, 560px)` wide. The rail's padding centres the first and last card so a neighbour's edge always shows (the prototype left-aligned the first card). At 375px about 14px of the next card shows.
- **Height.** `min-height: min(520px, first-screen space)` is measured by script. There is no `max-height`: at 200% zoom (ACC-09) cards grow rather than scroll internally. The 520px cap at default size is enforced by test.
- **The reveal link is just below the fold on a 375×667 screen.** There, the masthead (this title runs three lines) plus a ~500px card exceed the first screen. It is on the first screen at 390×844 and 1280×800, which the tests check.
- **Each situation option is a tabbable `role="radio"` button** (the prototype's pattern), not a roving-tabindex radio group, because arrow keys belong to deck navigation (PRD 5.3, ACC-01).
- **Arrow keys** are ignored when a modifier is held (Alt+Left is browser Back) and inside form fields. They act only while the deck is on screen, and repeated presses during a smooth scroll queue from the target card, not the current one.
- **A disabled chevron hands focus to its sibling.** Without this, Tab looped back into the deck and never reached the reveal link. The keyboard test caught it.
- **The live region stays silent on page load.** On change it announces "Card n of N." plus the card's title (or the terminal's `knows` line).
- **Deep links.** An unknown `path` is ignored and `card` is clamped to the deck. Other query parameters (e.g. `utm_*`) and the hash are preserved. Without a situation card, `card=1` is the first insight.
- **The deck stays above the article after reveal.** The article can't be re-collapsed (PRD 5.6).

### Content

- **The card copy is the prototype's `DATA`, used verbatim as instructed, and marked DRAFT.** It doesn't match the published whitepaper. See "PRD/brief issues" in the PR.
- **Anchors mapped to the post's real kramdown ids:**
  - `#not-a-migration` → `#ai-adoption--new-tool`
  - `#the-board-question` → `#perspective-1-business`
  - `#governance` → `#perspective-4-governance`
  - `#meridian` → `#applying-the-framework-at-meridian`
  - Each is the closest real section to the prototype's intent.

### Testing

- **"iPhone SE emulation" uses Playwright's `iPhone SE (3rd gen)`** (375×667, WebKit). Playwright's plain `iPhone SE` is the 320px first-generation model.
- **axe scope.** The reading layer (masthead, deck, reveal link) must have zero WCAG 2.2 AA violations. The whole page may show only the site's pre-existing contrast failures in nav, byline, TOC and footer (`.brand`, `.stat`, `.toc-sub`, `.copy`). Those are on every post today and are flagged rather than restyled, since restyling them would change non-carded posts.
- **Screenshots for the review package** come from `tests/screenshots.spec.js` and are written to `test-results/screenshots/`.
