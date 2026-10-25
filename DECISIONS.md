# Narration: decisions log

Read-aloud narration with a synchronized phrase underline on insight cards. Every judgement call, with one line of reasoning each. The Insight Cards log follows below.

## What the repo looks like (found before writing code)

- **Build mode.** The legacy GitHub Pages builder (`build_type: legacy`, `main` `/`): github-pages 232, Jekyll 3.10, Liquid 4. No plugins run in production. Locally, `scripts/build-site.sh` builds in Docker.
- **Markdown converter.** kramdown with GFM input. **Card text never goes through it, though.** The include renders `{{ i.title | escape }}` and `{{ i.body | strip | escape }}`, so a card's "rendered Markdown" is plain HTML-escaped text. Narration takes exactly that rendered HTML as input.
- **Asset conventions.** Static files live under `assets/` (`assets/css`, `assets/js`) and are linked with `relative_url`. Collection documents live in `_articles/` (there is no `_posts/`), and `page.slug` is the file name. Static files show up to Liquid in `site.static_files`, with `path` like `/assets/...`. Jekyll can only `include` from `_includes/`.
- **Insight Cards code.** `_includes/insight-cards-valid.html` is the Liquid gate. `_includes/insight-cards.html` renders the cards in default order, hidden until the script runs. `assets/js/insight-cards.js` is one IIFE: paths, navigation, deep links, the `trackEvent` adapter, and an `is-current` class on the current card. `assets/css/insight-cards.css` holds the `--ic-*` tokens. `scripts/validate-cards.js` is the CI validator. Playwright specs in `tests/` run against a static `_site` served by `tests/serve.js`, on Chromium plus iPhone SE WebKit. There was no unit runner.

## Decisions

### Provider and generation

- **Neural2-D returns mark timepoints.** Google's v1beta1 reference documents `enableTimePointing: ["SSML_MARK"]` and `Timepoint {markName, timeSeconds}`, but no page says which voice families support marks. A probe call settled it: `en-US-Neural2-D` returned a timepoint for every mark. The voice stays `en-US-Neural2-D` and is set in one place, `scripts/narration/config.js`.
- **Google is called over REST with `google-auth-library`, not `@google-cloud/text-to-speech`.** It's one small dev dependency, and it reads ADC, including the quota project, automatically. Only `scripts/narration/synthesize.js` imports it.
- **The credentials checkpoint** resolves an ADC token, then lists `en-US` voices on v1beta1. That proves the API is enabled and the voice exists, and it costs nothing. It passed on this machine (quota project `robisit-tts`), so no `SETUP.md` was needed. The script writes one with the exact `gcloud` commands if the check ever fails.
- **Output format.** MP3 at 24 kHz. Google has no channel parameter, so the generator checks every frame header for single-channel mode and fails if it isn't.
- **Duration is measured by walking the MP3 frame headers** (samples ÷ sample rate, skipping ID3 and the Xing/Info frame). That's the decoded length, with no metadata and no ffmpeg dependency. It matched `ffprobe` exactly on the probe and on every generated card, and a unit test cross-checks it when ffprobe is installed.
- **"Last end within 0.5 s of the measured duration" is enforced but tautological.** The spec defines the last end as that duration, so the check can't fail on generated data. It stays as a guard, alongside checks that the last phrase starts before the audio ends and that mark names match phrase ids in order.
- **A timepoint with no `timeSeconds` is read as 0.** proto3 JSON omits zero values. That's Google's encoding of zero, not an estimate.
- **Times are rounded to the millisecond.** Strict increase is checked after rounding.
- **The cache key** is SHA-256 of `{title, body, voice, outputFormat, segmentation}` from the raw front matter.
- **The skip test is a matching metadata hash plus an existing MP3** (spec 5.3). A missing or outdated fragment on a skipped card is rebuilt locally, because it depends only on the text and needs no API call.
- **Writes are atomic per card.** All three files are written to temp names and renamed only after every validation passes, so a failing card leaves nothing behind.
- **The cost table** shows plain-text characters and SSML characters, since Google bills on the SSML sent.

### Where the files live

- **The phrase fragment lives at `_includes/narration/<slug>/<cardId>.html`, not under `assets/`.** Jekyll 3.10 can only include from `_includes/` (and `include_relative` rejects `..`). The MP3 and the metadata JSON live under `assets/narration/<slug>/` as specified. The fragment file is wrapped in `{% raw %}` so card text can never be read as Liquid.
- **A fragment is used only when it's still true.** `_includes/insight-cards-narration.html` checks that the card's JSON is in `site.static_files`. It then checks that the fragment, with its tags stripped, equals the plain render (`title | escape`, `body | strip | escape`). If either check fails, the card renders exactly as before, with no button. So editing a card without re-running `npm run narrate` can never show stale text or play audio that doesn't match. A fixture (`tests/fixtures/cards-site/_articles/hello-world-cards.md`, one title edited) proves the fallback.
- **The title and body of one card share one fragment file,** split by `<!--ic-body-->`. The include keeps its own `<h2>` and `<p>` markup, so the fragment carries only phrase spans.
- **Narration CSS and JS are separate files**, loaded only on posts that have narration assets. That gives them their own 6 KB budget and leaves the deck's 10 KB budget meaningful. The deck script gained two hooks and nothing else: it dispatches `ic:change` with the current card element, and it records `ic:track` events through its existing `trackEvent`. No globals, and `trackEvent` stays the single analytics path.

### Segmentation (`scripts/narration/segment.js`, version `v1`)

- **The input is the include's rendered HTML.** The tokenizer keeps tags, decodes entities, drops `href` (so URLs go) and keeps link text. Phrases are character ranges over the decoded text, so the fragment is the original markup with spans inserted. It's byte-identical with the spans removed, by construction and by test.
- **The spec's example ("AI is changing | the relationship between | users and software.") breaks *after* a preposition.** A literal "break before prepositions" rule would give "AI is changing the relationship | between users and software." The example is treated as normative. Long runs are split by scoring every 2-to-5-word split: the chunk count is pulled toward words ÷ 3, sizes are kept even, a break before a conjunction or preposition is free, one before a determiner costs 0.5, any other costs 1, and ending a chunk on "the", "to", "and" (and similar) costs 1.5. Those weights reproduce the example and avoid dangling articles.
- **Protected spans are atoms the splitter can't enter.** These are a whitespace word (which covers hyphenated terms and abbreviations), a number plus a unit from a fixed list, and consecutive capitalised words. A sentence-opening function word ("The", "This") never starts a name.
- **A one-word clause** ("Hello,") joins the next clause, and the result is re-split if needed, so every phrase has 2 to 5 words. The exception is a protected atom that is itself longer than five words, which is never split.
- **No end mark.** The last phrase ends at the measured audio duration, per spec.
- **Phrase spans exclude the spaces between phrases**, so the underline never runs across a gap.

### Playback (`assets/js/insight-cards-narration.js`)

- **One `<audio preload="none">`, created by the script and appended to the deck.** `src` is set on Play. On stop, the script pauses, removes `src` and calls `load()`, so nothing stale can resume. One media element makes two sounds at once impossible.
- **The underline follows `audio.currentTime`.** It updates on `timeupdate` and `seeked`, plus a `requestAnimationFrame` loop while playing. Only the spans entering or leaving `.is-spoken` are touched.
- **The lead-in before the first mark (about 15 ms of silence) counts as p0.** Without this, the underline couldn't appear until audio was actually flowing. Every later phrase uses its exact `[start, end)`.
- **The card's timing JSON (about 2 KB) is prefetched when a narrated card becomes current**, so p0 underlines as soon as Play is pressed (measured well under 250 ms). The MP3 still loads only on Play.
- **A card change stops narration.** The deck's `ic:change` fires on every current-card change, including a path reorder. Narration stops whenever the playing card is no longer current.
- **Autoplay on card change (owner direction, 2026-10-24).** This replaces the original spec's "audio only ever starts from the button" and "nothing plays until the reader presses Play on the new card". When the deck comes to rest on a narrated card, that card starts reading.
  - **Pausing turns autoplay off.** Any pause the reader causes, on any card, whether from the button or the system's media controls, turns it off for the rest of the page view. Nothing then starts until a Play button is pressed, which turns it back on.
  - **No auto-advance.** Playback ending doesn't move to the next card.
  - **Nothing plays on page load or from a deep link.** A shared link shouldn't start talking, and browsers would block most of those starts anyway.
  - **Autoplay waits 350 ms after the deck rests on a card**, so swiping through several cards doesn't start and stop each one.
  - **A start the browser blocks is not an error.** Before any interaction with the page, browsers may refuse it with `NotAllowedError`. It rests silently: no warning, no announcement. On iOS, autoplay is expected to work only after the reader has pressed Play once, which unlocks the deck's single audio element.
  - **A real failure (404, decode) also turns autoplay off**, so a broken file doesn't warn on every card.
  - **The first gesture in the deck primes the audio element (owner direction: autoplay without a first Play press).** The reader always has to move off the situation card to reach an insight card. On their first tap, click or key press in the deck (a path option, a chevron, an arrow key, the touch that ends a swipe), the deck's single audio element plays 0.17 s of embedded silent MP3, about 0.7 KB.
    - **Why this works:** iOS Safari lets an element start from a timer only after it has played inside a gesture. Chrome and Firefox need any earlier page activation, which that same gesture provides.
    - **Limited to the deck,** plus arrow keys anywhere, because playing even silence takes over the phone's audio session and pauses the reader's music. A tap elsewhere on the page never does that.
    - **It runs once, and is silent:** no `cards_play`, no announcement.
    - **Unresolved:** whether the touchend at the end of a pure swipe counts as a gesture on iOS can only be confirmed on a device (VERIFY.md 2a). Chrome on Android doesn't count a scroll as activation, so a reader there who only swipes gets autoplay once they've tapped anything in the deck.
  - **`cards_play` gains `trigger: "button" | "auto"`.** The deck's `ic:track` handler merges extra props into its `{card, path}`. This isn't in PRD 7, but without it the play count can't separate choice from autoplay.
- **Play on a card that isn't current** (its button can be clicked at the deck edge) plays that card. Any later card change stops it as usual.
- **Errors** (MP3 404 or decode failure, metadata fetch failure, a rejected `play()`) log one `console.warn` and return to rest. Each failure warns once, and navigation is untouched.
- **Pausing** sets `aria-pressed="false"` and the label back to "Read this card aloud", and the underline stays where it is. Resuming is not a new `cards_play`.
- **Announcements go through the deck's existing polite live region (`#ic-live`).** It says "Reading card aloud." once audio actually starts, so a blocked autoplay says nothing, and "Finished reading." on completion. Nothing per phrase.
- **Only the current card's button is in the Tab order** (`tabindex=-1` on the others). Without this, Tab walked into the other cards' buttons and scrolled the deck to them, and five extra stops broke the existing ACC-01 Tab test. The deck's own Tab order still runs through the situation options first (pre-existing behaviour).
- **The button stays `hidden` until the script confirms `canPlayType('audio/mpeg')`.** Without the script, or in a browser that can't play MP3, no dead control is shown.

### Visual

- **The button sits in the counter row, just left of the counter, both right-aligned.** The spec says "right-aligned opposite the counter", which assumes a left-aligned counter. Here the counter is top-right (owner direction), so "right-aligned" wins and the counter keeps its exact position on every card. The terminal card has no button, and its counter doesn't move either.
- **A 30 px round outline button** (above WCAG 2.2's 24 px target minimum) with a 14 px play or pause glyph in ink, a `--ic-edge` border and the deck's existing amber focus ring. Narrated titles reserve 76 px on the right so text never runs under it. Cards still fit 375×667 with no internal scroll, in every path.
- **The underline** is `text-decoration: underline` in `currentColor` (each line's own ink: `#eae6df` for titles, `#d4cfc6` for bodies), `0.08em` thick and offset `0.22em` for Lora. No transitions or animation.
- **"Both themes".** The site is dark-only, so the light-scheme runs check that nothing changes under `prefers-color-scheme: light`, as for the deck.

### Testing

- **Unit tests use Node's built-in runner** (`npm run test:unit`, `tests/unit/*.test.js`), since the repo had none. Playwright ignores `tests/unit/`.
- **The narration Playwright suite runs on Google Chrome** (project `chrome`, `channel: "chrome"`). Every narration test first checks `canPlayType('audio/mpeg')` and skips with a message if it's empty. The bundled Chromium project ignores `narration.spec.js`.
- **`tests/serve.js` now answers HTTP Range requests and serves `audio/mpeg`**, as GitHub Pages does. Chrome needs ranges to seek.
- **One existing test was amended:** "insight cards show counter, title and body and nothing else". It encoded PRD 3.4's "cards carry no controls", which this spec explicitly amends with exactly one control. It now accepts exactly one `.ic-play` on a narrated card and nothing else. Every other existing test is unchanged.
- **"Underlines p0 within 250 ms"** is timed in the page from `click()` to the first frame with p0 underlined.
- **The rapid-switch test** presses Play and then changes card every 100 ms, 20 times. It checks that no more than one button is ever pressed and that there's never an underline on a card that isn't playing. Once the deck rests, it checks that there is one media element and that exactly the current card plays (autoplay).

---

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
