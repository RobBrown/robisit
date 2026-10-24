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
