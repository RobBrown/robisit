#!/usr/bin/env bash
# Build the site with the same gem set GitHub Pages uses (github-pages gem,
# Jekyll 3.10). Runs in Docker so no Ruby toolchain is needed on the host.
# Output: _site/
set -euo pipefail
cd "$(dirname "$0")/.."
docker volume create robisit-gems >/dev/null
docker run --rm \
  -v "$PWD":/site -v robisit-gems:/usr/local/bundle -w /site \
  -e JEKYLL_ENV=production \
  ruby:3.3 bash -c 'bundle install --quiet && bundle exec jekyll build --quiet -d _site'

# Fixture site for validation tests: the real layout, includes and assets
# rendering deliberately valid and invalid cards blocks. Output: _site-fixtures/
mkdir -p _includes assets
docker run --rm \
  -v "$PWD/tests/fixtures/cards-site":/site \
  -v "$PWD/_layouts":/site/_layouts:ro -v "$PWD/_includes":/site/_includes:ro -v "$PWD/assets":/site/assets:ro \
  -v "$PWD/Gemfile":/site/Gemfile:ro \
  -v "$PWD/_site-fixtures":/out \
  -v robisit-gems:/usr/local/bundle -w /site \
  ruby:3.3 bash -c 'bundle install --quiet && bundle exec jekyll build --quiet -d /out && rm -f Gemfile.lock'
