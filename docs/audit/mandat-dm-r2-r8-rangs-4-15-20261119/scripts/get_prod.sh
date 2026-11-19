#!/usr/bin/env bash
# Mandat DM — relevé PROD : GET simples, 1 par seconde, sans suivi de redirection, sans réessai.
# Usage : scripts/get_prod.sh data/urls_get.txt prod_html data/get_journal.tsv
set -euo pipefail
LIST="$1"; OUT="$2"; LOG="$3"; HOST="https://www.automecanik.com"
mkdir -p "$OUT"; printf "n\theure_utc\tpath\tstatut\toctets\tduree_s\tlocation\n" > "$LOG"
n=0
while IFS= read -r p; do
  [ -z "$p" ] && continue
  n=$((n+1)); [ "$n" -gt 120 ] && { echo "plafond 120 atteint" >&2; break; }
  f="$OUT/$(printf '%03d' "$n").html"
  ts=$(date -u +%FT%TZ)
  meta=$(curl -s --compressed -m 25 -A "Mozilla/5.0 (compatible; releve-seo-lecture-seule)" \
         -o "$f" -D "$f.headers" -w '%{http_code}\t%{size_download}\t%{time_total}\t%{redirect_url}' "$HOST$p" || echo -e "000\t0\t0\t")
  printf "%s\t%s\t%s\t%s\n" "$n" "$ts" "$p" "$meta" >> "$LOG"
  sleep 1
done < "$LIST"
