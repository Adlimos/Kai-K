#!/bin/bash
# Builds bundle.html (single self-contained file) and injects the Google Fonts link,
# which html-inline cannot inline itself.
set -e
cd "$(dirname "$0")"
rm -rf dist bundle.html .parcel-cache
pnpm exec parcel build index.html --dist-dir dist --no-source-maps
pnpm exec html-inline dist/index.html > bundle.html
FONT='<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gloock\&family=Instrument+Sans:ital,wdth,wght@0,75..100,400..700;1,75..100,400..700\&display=swap">'
sed -i "s#</title>#</title>${FONT}#" bundle.html
echo "bundle.html: $(du -h bundle.html | cut -f1)"
