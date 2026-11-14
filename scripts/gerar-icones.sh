#!/usr/bin/env bash
# Gera public/icon-192.png e public/icon-512.png a partir de public/icone.svg.
# Usa um Chromium headless (Chrome, Chromium ou Brave); rode de novo sempre que mudar o icone.svg.
set -euo pipefail
cd "$(dirname "$0")/.."
NAV=$(command -v chromium || command -v chromium-browser || command -v google-chrome || command -v brave || true)
[ -n "$NAV" ] || { echo "Instale o Chrome/Chromium/Brave para gerar os ícones." >&2; exit 1; }
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
for t in 192 512; do
  printf '<!doctype html><html><body style="margin:0;background:#121012"><img src="%s" width="%s" height="%s" style="display:block"></body></html>' \
    "file://$PWD/public/icone.svg" "$t" "$t" > "$TMP/i.html"
  "$NAV" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --window-size="$t,$t" --screenshot="$PWD/public/icon-$t.png" "file://$TMP/i.html" >/dev/null 2>&1
done
file public/icon-192.png public/icon-512.png
