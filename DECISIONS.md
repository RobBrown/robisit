# Narration: decisions log

Read-aloud narration with a synchronized phrase underline on insight cards. Every judgement call, with one line of reasoning each. The Insight Cards log follows below.

## What the repo looks like (found before writing code)

- **Build mode.** The legacy GitHub Pages builder (`build_type: legacy`, `main` `/`): github-pages 232, Jekyll 3.10, Liquid 4. No plugins run in production. Locally, `scripts/build-site.sh` builds in Docker.
- **Markdown converter.** kramdown with GFM input. **Card text never goes through it, though.** The include renders `{{ i.title | escape }}` and `{{ i.body | strip | escape }}`, so a card's "rendered Markdown" is plain HTML-escaped text. Narration takes exactly that rendered HTML as input.
- **Asset conventions.** Static files live under `assets/` (`assets/css`, `assets/js`) and are linked with `relative_url`. Collection documents live in `_articles/` (there is no `_posts/`), and `page.slug` is the file name. Static files show up to Liquid in `site.static_files`, with `path` like `/assets/...`. Jekyll can only `include` from `_includes/`.
- **Insight Cards code.** `_includes/insight-cards-valid.html` is the Liquid gate. `_includes/insight-cards.html` renders the cards in default order, hidden until the script runs. `assets/js/insight-cards.js` is one IIFE: paths, navigation, deep links, the `trackEvent` adapter, and an `is-current` class on the current card. `assets/css/insight-cards.css` holds the `--ic-*` tokens. `scripts/validate-cards.js` is the CI validator. Playwright specs in `tests/` run against a static `_site` served by `tests/serve.js`, on Chromium plus iPhone SE WebKit. There was no unit runner.

## Decisions

### Provider and generation

- **Neural2-D returns mark timepoints.** Google's v1beta1 reference documents `enableTimePointing: ["SSML_MARK"]` and `Timepoint {markName, timeSeconds}`, but no page says which voice families support marks. A probe call settled it: `en-US-Neural2-D` returned a timepoint for every mark. The voice is set in one place, `scripts/narration/config.js`.
- **The voice is now `en-US-Casual-K` (owner choice, 2026-10-24),** replacing `en-US-Neural2-D`. Every family was probed for mark timepoints on 2026-10-24.
  - **Return them:** Neural2, Wavenet, News, Casual, Standard.
  - **Don't:** Studio ("`<mark>` tags are not currently supported"), Chirp HD (rejects the request) and Chirp 3 HD (accepts SSML but returns no timepoints). None of those can drive the underline.
  - **Regeneration:** the voice is part of the cache key, so `npm run narrate` regenerated all five cards (4,753 SSML characters).
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

- **Narration is generated in CI (owner request, 2026-10-24).** Running `npm run narrate` on a laptop broke the site rule "push markdown, site updates". `.github/workflows/narrate.yml` runs on every push to `main` that touches a post or the narration code (and on manual dispatch, with optional force). It runs `narrate --check`, then `narrate --all`. It commits only `assets/narration` and `_includes/narration`, as github-actions[bot], then requests a Pages build: pushes made with `GITHUB_TOKEN` don't start one.
  - **Keyless auth.** Workload Identity Federation: pool `github`, OIDC provider `robisit` in `robisit-tts`, accepting only `assertion.repository == 'RobBrown/robisit' && assertion.ref == 'refs/heads/main'`. It maps to `narration-ci@robisit-tts.iam.gserviceaccount.com`, whose only project role is `roles/serviceusage.serviceUsageConsumer`. The provider and account names are repo variables, not secrets. No key exists anywhere.
  - **Failures never block publishing.** Generation failures become a warning; the article is already live without Play buttons.
  - **Verified end to end on 2026-10-24.** One card's files were removed. The dispatched run made 1 API call and committed the three files (732c924). The Pages build ran, and the live page showed all five buttons.
  - **The cost of committing to `main`:** the owner must pull before their next push.

### Where the files live

- **The phrase fragment lives at `_includes/narration/<slug>/<cardId>.html`, not under `assets/`.** Jekyll 3.10 can only include from `_includes/` (and `include_relative` rejects `..`). The MP3 and the metadata JSON live under `assets/narration/<slug>/` as specified. The fragment file is wrapped in `{% raw %}` so card text can never be read as Liquid.
- **A fragment is used only when it's still true.** `_includes/insight-cards-narration.html` checks that the card's JSON is in `site.static_files`. It then checks that the fragment, with its tags stripped, equals the plain render (`title | escape`, `body | strip | escape`). If either check fails, the card renders exactly as before, with no button. So editing a card without re-running `npm run narrate` can never show stale text or play audio that doesn't match. A fixture (`tests/fixtures/cards-site/_articles/hello-world-cards.md`, one title edited) proves the fallback.
- **The title and body of one card share one fragment file,** split by `<!--ic-body-->`. The include keeps its own `<h2>` and `<p>` markup, so the fragment carries only phrase spans.
- **Narration CSS and JS are separate files**, loaded only on posts that have narration assets. That gives them their own 6 KB budget and leaves the deck's 10 KB budget meaningful. The deck script gained two hooks and nothing else: it dispatches `ic:change` with the current card element, and it records `ic:track` events through its existing `trackEvent`. No globals, and `trackEvent` stays the single analytics path.

### Spend cap (owner request, 2026-10-24: "At $50 the functionality should stop")

- **A budget alone can't stop spending; it only sends notifications.** So the budget "robisit-tts spend cap" (50 CAD, the billing account's currency, scoped to `robisit-tts`, with thresholds at 50/90/100% emailed to billing admins) publishes to the Pub/Sub topic `budget-cap`. The Cloud Run function `spend-cap` (`ops/spend-cap/`) disables `texttospeech.googleapis.com` once `costAmount >= budgetAmount`.
- **Disabling the API, not unlinking billing.** Unlinking billing would stop every service in the project and can lose resources. Disabling only Text-to-Speech stops the only thing that costs money and is undone with a single `gcloud services enable`. The published MP3s are static files on GitHub Pages, so readers notice nothing.
- **Its own service account, `spend-cap@`, with only Service Usage Admin.** `narration-ci@` has only Service Usage Consumer, so CI can't re-enable the API by itself. Re-enabling is a deliberate owner action.
- **A malformed or below-budget message does nothing.** The decision is a pure function (`overBudget`), unit-tested. The trigger doesn't retry, so a failure can't loop, and the next budget notification (several a day) retries naturally.
- **Lag.** Billing data arrives hours late, so actual spend can overshoot 50 CAD somewhat. At Text-to-Speech prices (a few CAD per million characters) and this site's volume, that overshoot is small.
- **Verified 2026-10-24** with hand-published messages: 12.5 of 50 left the API on; 50 of 50 disabled it, and `narrate --check` then failed with "API … disabled"; `gcloud services enable` restored it and the check passed.
- **Deployment** is `ops/spend-cap/deploy.sh` (idempotent; owner credentials). `ops/` is excluded from the Jekyll build.

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
  - **Auto-advance (owner direction, 2026-10-25; replaces "no auto-advance").** When a card finishes reading, the deck waits 1 s, then moves to the next card (`ic:next`, handled like the next chevron). That move is an ordinary card change, so the next narrated card autoplays after the usual 350 ms rest. The terminal card has no narration, so the run ends there. Nothing moves if the reader pauses, presses Play again or changes card during that second.
  - **Nothing plays on page load or from a deep link.** A shared link shouldn't start talking, and browsers would block most of those starts anyway.
  - **Autoplay waits 350 ms after the deck rests on a card**, so swiping through several cards doesn't start and stop each one.
  - **A start the browser blocks is not an error.** Before any interaction with the page, browsers may refuse it with `NotAllowedError`. It rests silently: no warning, no announcement. On iOS, autoplay is expected to work only after the reader has pressed Play once, which unlocks the deck's single audio element.
  - **A real failure (404, decode) also turns autoplay off**, so a broken file doesn't warn on every card.
  - **The first gesture in the deck primes the audio element (owner direction: autoplay without a first Play press).** The reader always has to move off the situation card to reach an insight card. On their first tap, click or key press in the deck (a path option, a chevron, an arrow key, the touch that ends a swipe), the deck's single audio element plays 0.17 s of embedded silent MP3, about 0.7 KB.
    - **Why this works:** iOS Safari lets an element start from a timer only after it has played inside a gesture. Chrome and Firefox need any earlier page activation, which that same gesture provides.
    - **Limited to the deck,** plus arrow keys anywhere, because playing even silence takes over the phone's audio session and pauses the reader's music. A tap elsewhere on the page never does that.
    - **It runs once, and is silent:** no `cards_play`, no announcement.
    - **The first swipe's unlock was being cancelled by our own autoplay (owner report, 2026-10-24).** On iPhone, a first swipe stayed silent, but swiping right, left, right then autoplayed. So the swipe's touchend does start the unlock. The silent clip just takes a moment to get going on the phone. Autoplay fired as soon as the deck settled, swapped the element's `src` and cancelled the unlock before it took. Swiping back to the situation card unlocked cleanly, because nothing autoplays there. **Fix:** autoplay now waits for an unlock in progress to settle (`whenPrimed`). A test models iOS (unlock only once the silent clip starts, 1.5 s late). It failed before the fix and passes after. The owner re-checked on the phone: still silent after one swipe.
    - **The unlock is also tried at `touchstart` (2026-10-24).** By `touchend`, iOS may already have classed the touch as a scroll, and a scroll isn't a gesture. `touchstart` comes before that decision, and Howler.js unlocks on it for the same reason. **Checked on iPhone (owner, 2026-10-24): one swipe off the situation card now starts card 1 reading, with no tap.** The temporary `?narration-debug` log used to check this has been removed.
  - **`cards_play` gains `trigger: "button" | "auto"`.** The deck's `ic:track` handler merges extra props into its `{card, path}`. This isn't in PRD 7, but without it the play count can't separate choice from autoplay.
- **Play on a card that isn't current** (its button can be clicked at the deck edge) plays that card. Any later card change stops it as usual.
- **Errors** (MP3 404 or decode failure, metadata fetch failure, a rejected `play()`) log one `console.warn` and return to rest. Each failure warns once, and navigation is untouched.
- **Pausing** sets `aria-pressed="false"` and the label back to "Read this card aloud", and the underline stays where it is. Resuming is not a new `cards_play`.
- **Announcements go through the deck's existing polite live region (`#ic-live`).** It says "Reading card aloud." once audio actually starts, so a blocked autoplay says nothing, and "Finished reading." on completion. Nothing per phrase.
- **Only the current card's button is in the Tab order** (`tabindex=-1` on the others). Without this, Tab walked into the other cards' buttons and scrolled the deck to them, and five extra stops broke the existing ACC-01 Tab test. The deck's own Tab order still runs through the situation options first (pre-existing behaviour).
- **The button stays `hidden` until the script confirms `canPlayType('audio/mpeg')`.** Without the script, or in a browser that can't play MP3, no dead control is shown.

### Visual

- **The button sits in the counter row, just left of the counter, both right-aligned.** The spec says "right-aligned opposite the counter", which assumes a left-aligned counter. Here the counter is top-right (owner direction), so "right-aligned" wins and the counter keeps its exact position on every card. The terminal card has no button, and its counter doesn't move either.
- **A 30 px square outline button** (above WCAG 2.2's 24 px target minimum), 2px radius to match the chevrons, with a 14 px play or pause glyph in ink and a tinted amber border; it turns amber on hover and while playing. It keeps the deck's amber focus ring. Narrated titles reserve 76 px on the right so text never runs under it. Cards still fit 375×667 with no internal scroll, in every path.
- **The underline** is `text-decoration: underline` in `currentColor` (each line's own ink), `0.08em` thick and offset `0.22em` for Lora, plus a faint phosphor glow (`--ic-spoken-glow`, set in `insight-cards.css`) as if the beam is passing over the phrase. No transitions or animation. The highlight is tuned through that one token.
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
- **`cards_handoff` has two routes and fires once per page view.** `button` is "Read The Full Article" under the deck, and `terminal` is the last card's control (the article starts collapsed; see below). Only the first one used counts, and later clicks still open and jump. `card` is the counter position at the time of the click. `anchor` is the path's anchor for `terminal`, and `#ic-article` for `button`.
- **`cards_depth` is tracked against the whole article, only while it is open.** It fires once per threshold (25/50/75/100). `route` is the control that first opened the article (`"button"` or `"terminal"`), or `"none"` if it was opened another way (a section link, find in page).

### Visual design (PRD 6, with owner direction of 2026-10-24; restyled as CRT screens 2026-10-25)

- **CRT restyle (owner direction, 2026-10-25).** The cards were restyled to belong to the site's CRT look, with appearance only changing: behaviour, navigation, schema and reveal are untouched. The brief, diagnosis and rejected options are in `docs/insight-cards-design.md`. The bullets below describe the result and replace the earlier palette, type, card, motion and control rules.

- **Palette: the site's.** Every colour is either a hex value from `article.html` or a channel triple from the home page's amber and green themes (`index.html`, `body` and `body.green`), at any alpha, plus black shadows. `insight-cards.css` names them as `--ic-*` tokens, each commented with its source. Tests check every computed colour, including `::before`/`::after` and `text-shadow`, under both `prefers-color-scheme` values, and every literal in the CSS.
- **Type.** Card prose and titles stay in Lora, so the cards read like the article. The machine voice (counter, "TL;DR in N cards", both "Read The Full Article" buttons, chevrons) is Share Tech Mono, uppercase and tracked as on the home page. Share Tech Mono is added to the layout's Google Fonts request only on carded posts; other posts are unchanged.
- **Cards: CRT screens.** Cards are `min(80vw, 400px)` wide (overriding PRD 5.2's ~86% and 560px). The glass is `#14100a` with 1px scanlines every 3px, a 5% phosphor bloom at the centre, inset black shadows that darken the edges, and a faint reflection at the upper left, all as background under the text so contrast is unaffected. The face has elliptical 26px/30px corners like a picture tube (owner direction: rounded like a CRT, not the home page's square panel). A 5px `#0e0b06` housing ring with a 1px tinted outer edge is drawn with shadows, so it takes no layout space; the rail gap is 18px so neighbouring rings don't touch. Text is 15.5px/1.65 (16.5px/1.7 above 600px), with 20px (22px) titles. Every card takes the tallest card's height, inside PRD 6.3's 520px cap from 375px up.
- **The current card is lit.** Its border, ring and a soft halo light up in amber, on a `::before` layer of their own (shadows at `inset:0`, which never count as overflow). Its neighbours' contents drop to 72% opacity, instantly; every text colour, the amber counter included, stays at or above 4.8:1 when dimmed. The terminal button is never dimmed. Card titles are the home page's phosphor `#ffe4a0` with a faint amber glow; body text is the article's `#d4cfc6`; `resolves` is `#b8b09e`.
- **Motion (replaces PRD 5.5's "no other animation", owner direction 2026-10-25).** All of it is inside `prefers-reduced-motion: no-preference`; under reduce, nothing animates or transitions and the static lit/dimmed design is complete. (1) Power-on: when a card becomes current, a dim line opens across the glass and fades over 0.45s, the home page's `crt-off` reversed, on an `::after` layer that ends transparent. (2) Flicker: the current card's lit bezel layer dips in opacity on a 7s step cycle, like the nav brand, three dips per cycle, never more than one a second. Only its opacity animates, so it's cheap. Text never flickers. (3) The bezel layer fades in and out over 0.25s, and options take the home `.ci` hover (background, border, 3px nudge). A 0.25s fade on the dimmed card contents was tried and removed: it raced Playwright's scroll-into-view before clicks and broke the narration suite, and the power-on already marks arrival.
- **Counter.** A terminal readout: amber Share Tech Mono 13px with a faint glow, in the card's top-right corner level with the title. The format ("3/8") is unchanged. Every card's title starts at the same height. The situation card has no visible counter ("Start" was removed), but its group label is still "Start" for screen readers.
- **Controls.** Options are the home page's link rows (`.ci`): square, a 1px tinted border and faint tinted fill, with a 2px left rule that grows on hover and stays lit when selected. On the green situation card they are green, and the selected option's text is the green theme's `#a0e8a0` (this replaces PRD 6.3's amber selection). "Read The Full Article", on the last card and under the deck, is amber-filled (`#0a0600` on `#ffa000`), 2px radius, in mono, and turns to an amber outline on hover. The chevrons are 36px square keys.
- **The situation card** is the same screen in the home page's green theme: green bloom, bezel, halo, power-on and options. Its title keeps the cards' amber phosphor (owner direction, 2026-10-25: "I don't like it green").
- **Section labels.** "TL;DR in N cards" above the deck is the home page's eyebrow: Share Tech Mono 13px, uppercase, tracked, amber, after a 22px amber rule. It labels the deck region. Below the deck, "Published on <date>" is in muted Inter 14px under the "Read The Full Article" button (owner direction, 2026-10-25; it replaced "Full Article Published on <date>"). The date line is never hidden, so without JavaScript it is the post's date line. These labels replace the PRD's ban on lede and hint text, by owner direction.
- **Masthead on carded posts.** The layout adds `class="ic-page"` to `<article>` and leaves out the date, view counts and header rule (inline `{% unless ic_valid %}`). The top padding (28px, 16px on phones) and the gap under the title are tighter. Posts without cards are byte-identical to before, and the baseline tests check this. The same header could go site-wide later, but that would change every post.

### Deck behaviour and markup (PRD 3, 5, 8)

- **The article starts collapsed (owner direction, 2026-10-25; replaces "the article is open on load").** A "Read The Full Article" button, a copy of the terminal control, sits under the deck at all times so the reader always sees the way in. It opens the article and jumps to its top. The terminal control opens it and jumps to the path's anchor. Both move focus to the target and scroll, instantly under reduced motion. The button carries `aria-controls` and `aria-expanded`, and stays after opening, so pressing it again jumps back to the top.
  - **Collapsed with `hidden="until-found"`, set by the script.** Find in page can still search the article and opens it on a match (`beforematch`). Browsers without `until-found` treat it as `hidden`, and the controls still open it. The HTML never ships it collapsed.
  - **A link to a section opens it.** If the URL's `#fragment` points into the article, on load or later (`hashchange`), the article opens so the link lands.
- **Cards are server-rendered** by Liquid in the default order, not built in JS as in the prototype. The card text is in the HTML, and the script only reorders nodes for a path.
- **No-JS fallback.** The TL;DR heading, the deck and the button under it ship with the `hidden` attribute, and the script unhides them and collapses the article. With no JS, or a failed script, the page is the plain, open article plus the "Published on" date line (PRD 10, ACC-11).
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

## Typography (2026-10-25)

- **One reading family: Atkinson Hyperlegible Next** for body, headings, UI and card text; **Atkinson Hyperlegible Mono** for labels, counters, buttons and code; **Bebas Neue** only for the wordmark and home stat numerals (owner choice of pairing C from three compared live; see `docs/typography.md`). This replaces Lora, Inter, Share Tech Mono and Space Mono, including the deck's Lora prose and Share Tech Mono readouts described above.
- **Self-hosted, no font CDN.** Latin-subset variable woff2 in `assets/fonts/`, `@font-face` and tokens in `assets/css/type.css`. The roman text face is preloaded.
- **The home page changed.** Its running text left the monospace and no text is below 10px. This intentionally overrides the "index.html must not change" constraint, by owner direction (the review covered the home page).
- **Baselines regenerated.** The byte-identical baseline fixtures for non-carded pages (`tests/fixtures/baseline/`) were rebuilt from this change, which touches every page. The perf test no longer allows Google Fonts hosts.


## View switch (owner brief, 2026-10-25)

Supersedes "The article starts collapsed" and the TL;DR label in "Section labels" above.

- **The TL;DR heading is now a two-tab switch**, "TL;DR · N cards" and "Full article" (`#ic-switch`, `role="tablist"`). The deck and the article are its tab panels, and exactly one is on the page: the other is `hidden` (the article `hidden="until-found"` plus `aria-hidden`, so Chrome drops even the empty panel from the accessibility tree and find in page still reaches it). TL;DR is the default. It keeps the eyebrow look: mono, uppercase, after the 22px amber rule; the selected tab is amber with an amber rule under it, the other muted. Arrow keys, Home and End move between tabs and switch (automatic activation); only the selected tab is in the Tab order.
- **One code path.** The tabs, the terminal control, "Read The Full Article" under the deck, find in page, links into the article and back/forward all call `setView`. The separate reveal logic is gone. The button under the deck belongs to the TL;DR view and hides with it; it no longer carries `aria-expanded`.
- **Hash and history.** `#tldr` or `#article` (a section id also means the article). Load sets `#tldr` with `replaceState` when there is no hash; each deliberate switch is one `pushState` entry; `popstate`/`hashchange` re-sync the view. Deck navigation still only `replaceState`s `?path`/`?card`.
- **Scroll and focus.** After a switch the switch sits 12px from the top of the viewport and focus moves to the new panel with `preventScroll`. Two exceptions: arrow keys on the tabs keep focus on the tab, and **the terminal control still lands on the path's anchor** (PRD 5.6), scrolled to the top and focused, since that anchor is the point of choosing a path.
- **CRT transition.** The old view collapses to a bright line across the middle of the viewport and goes dark (index.html `crt-off`, 260ms), the page scrolls while the screen is dark, and the new view opens out of the same line (340ms). Web Animations, scaled about the viewport's middle so it reads the same on a long article. Instant under reduced motion; a second switch mid-transition cuts it short.
- **Analytics.** `cards_handoff` gains `route: 'switch'` for the Full article tab. Still once per page view.
- **Budget.** CSS + JS is about 10.0 KB gzipped against the 10 KB budget (PRD 10), with little headroom left.
