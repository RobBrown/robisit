# robisit.com

Personal business card site for Rob Brown. Static HTML and Jekyll on GitHub Pages — no backend, no database, no server.

## How It Works

- **Homepage** (`index.html`) — Single-page business card with contact links
- **Articles** (`_articles/*.md`) — Write in markdown, commit to publish. Jekyll renders them automatically.
- **Listing** (`/content`) — All articles in one place with sort options

## Publishing

Copy `TEMPLATE.md` to `_articles/your-slug.md`, fill in the front matter, write your content, commit and push.

## Email Collection

The subscribe form submits directly to a Google Form. Email addresses are stored in a private Google Sheet. No backend infrastructure involved.
