#!/usr/bin/env bash
# Mandat DZ — 6.1 : statut HTTP de chaque URL mesurée, en GET seul, sans suivre les redirections, avec l'heure UTC.
# Usage (depuis docs/audit/design-system-revue-20261119) : bash scripts/statuts-dz.sh > mesures/statuts-pages.tsv
set -u
cd "$(dirname "$0")/.."
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
printf 'id\troute\tstatut\tredirection\tduree_s\theure_utc\n'
{ cat scripts/pages-dz.tsv; printf 'commande\t/checkout\n'; } | while IFS=$'\t' read -r id route; do
  t=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  r=$(timeout 30 curl -s -o /dev/null -X GET -A "$UA" -w '%{http_code}\t%{redirect_url}\t%{time_total}' "http://127.0.0.1:3000$route")
  printf '%s\t%s\t%s\t%s\n' "$id" "$route" "$r" "$t"
done
