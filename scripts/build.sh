#!/bin/sh
# Copy only the site files into dist/ (what Cloudflare serves). Usage: sh scripts/build.sh && npx wrangler deploy
set -e
cd "$(dirname "$0")/.."
rm -rf dist && mkdir dist
cp index.html styles.css app.js time.js sw.js favicon.svg manifest.webmanifest _headers dist/
echo "dist/ ready: $(ls dist | tr '\n' ' ')"
