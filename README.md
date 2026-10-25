# robisit.com

Personal business card site for Rob Brown. Static HTML and Jekyll on GitHub Pages. No backend, no database, no server.

## How It Works

- **Homepage** (`index.html`) — Single-page business card with contact links
- **Articles** (`_articles/*.md`) — Write in markdown, commit to publish. Jekyll renders them automatically.
- **Listing** (`/content`) — All articles in one place with sort options

## Publishing

Copy `TEMPLATE.md` to `_articles/your-slug.md`, fill in the front matter, write your content, commit and push.

## Card narration

Insight cards can be read aloud with the spoken phrase underlined. After adding
or editing a post's `cards` block, run:

    npm run narrate -- <post-slug>

It calls Google Cloud Text-to-Speech (Application Default Credentials; see
`SETUP.md` if the credentials check fails) and writes audio and timings to
`assets/narration/<slug>/` and phrase markup to `_includes/narration/<slug>/`.
Commit those files. Unchanged cards are skipped with no API call. A card whose
text changed after generation simply shows no Play button until you re-run it.

## Email Collection

The subscribe form submits directly to a Google Form. Email addresses are stored in a private Google Sheet. No backend infrastructure involved.
