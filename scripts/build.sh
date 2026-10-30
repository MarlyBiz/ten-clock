#!/bin/sh
# Copy only the site files into dist/ (what Cloudflare serves). Usage: sh scripts/build.sh && npx wrangler deploy
set -e
cd "$(dirname "$0")/.."
rm -rf dist && mkdir dist
mkdir -p node_modules  # gives npx wrangler a writable local cache dir (gitignored)
cp index.html styles.css app.js time.js skycal.js sw.js favicon.svg manifest.webmanifest _headers dist/
cp -r icons dist/
cp -r assets dist/
echo "dist/ ready: $(ls dist | tr '\n' ' ')"
