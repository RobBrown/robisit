# robisit.com

Personal business card site for Rob Brown. Static HTML and Jekyll on GitHub Pages. No backend, no database, no server.

## How It Works

- **Homepage** (`index.html`) — Single-page business card with contact links
- **Articles** (`_articles/*.md`) — Write in markdown, commit to publish. Jekyll renders them automatically.
- **Listing** (`/content`) — All articles in one place with sort options

## Publishing

Copy `TEMPLATE.md` to `_articles/your-slug.md`, fill in the front matter, write your content, commit and push.

## Card narration

Insight cards are read aloud with the spoken phrase underlined. You don't need
to do anything: when a post with a `cards` block reaches `main`, the
**Narrate cards** GitHub Action generates the audio, timings and phrase markup,
commits them to `main`, and republishes. The Play buttons appear a few minutes
after your push. Unchanged cards are skipped with no API call.

Because the Action commits to `main`, **pull before your next push**
(`git pull`), or that push will be rejected.

To run it by hand instead (needs Google Cloud Application Default
Credentials on your machine; if the check fails it writes `SETUP.md` with the
exact `gcloud` steps):

    npm run narrate -- <post-slug>     # one post
    npm run narrate -- --all           # every carded post
    npm run narrate -- --check         # credentials only

The voice is set in `scripts/narration/config.js`. Changing it regenerates
every card on the next run. A card whose text changed after generation shows
no Play button until it is regenerated.

## Email Collection

The subscribe form submits directly to a Google Form. Email addresses are stored in a private Google Sheet. No backend infrastructure involved.
