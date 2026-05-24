#!/usr/bin/env bash
# Vérifie les verdicts empiriques (G9, ADR-081) pour détecter ceux expirés.
#
# Lit tous les fichiers ledger/verdicts/*.md du vault (canon-mirrors local ou
# vault distant), extrait `expires_at` du frontmatter YAML, alerte si expirés.
#
# Verdict expiré → escalation via __seo_event_log (réutilise observabilité
# existante, pas de nouveau canary externe — cf. memory feedback_no_external_canary_when_internal_observability_exists).
#
# Usage : scripts/governance/check-verdict-expirations.sh [verdicts-dir]
#   ex.  scripts/governance/check-verdict-expirations.sh /opt/automecanik/governance-vault/ledger/verdicts
#
# Exit 0 = aucun verdict expiré, 1 = ≥1 verdict expiré nécessite re-instrumentation
#
# Cron suggéré : weekly (lundi 09:00) via .github/workflows/governance-checks.yml

set -euo pipefail

VERDICTS_DIR="${1:-/opt/automecanik/governance-vault/ledger/verdicts}"
TODAY=$(date +%F)

if [ ! -d "$VERDICTS_DIR" ]; then
  echo "INFO: $VERDICTS_DIR n'existe pas encore (aucun verdict formalisé)"
  exit 0
fi

EXPIRED=0
SOON=0

shopt -s nullglob
for verdict in "$VERDICTS_DIR"/*.md; do
  # Extract expires_at from frontmatter (between --- ... ---)
  expires=$(awk '
    /^---$/ { count++; next }
    count == 1 && /^expires_at:/ { sub(/^expires_at: */, ""); gsub(/["'"'"']/, ""); print; exit }
  ' "$verdict")

  [ -z "$expires" ] && {
    echo "WARN: $verdict sans expires_at (header G9 incomplet)"
    continue
  }

  id=$(awk '
    /^---$/ { count++; next }
    count == 1 && /^id:/ { sub(/^id: */, ""); gsub(/["'"'"']/, ""); print; exit }
  ' "$verdict")

  # Compare dates (lexicographique YYYY-MM-DD)
  if [[ "$expires" < "$TODAY" ]]; then
    echo "EXPIRED: $id ($verdict) — expired_at=$expires < today=$TODAY"
    blocks=$(awk '
      /^---$/ { count++; next }
      count == 1 && /^blocks_until_expiry:/ { flag=1; next }
      flag && /^  - / { sub(/^  - /, ""); print; }
      flag && !/^  / { flag=0 }
    ' "$verdict")
    if [ -n "$blocks" ]; then
      echo "         → DO_NOT_START qui doivent passer OPEN_FOR_REVIEW :"
      echo "$blocks" | sed 's/^/         - /'
    fi
    EXPIRED=$((EXPIRED+1))
  elif [[ "$expires" < $(date -d "$TODAY + 14 days" +%F) ]]; then
    echo "SOON: $id ($verdict) — expires_at=$expires (≤14j)"
    SOON=$((SOON+1))
  fi
done

echo ""
echo "Summary: $EXPIRED expired, $SOON expiring within 14 days"

if [ "$EXPIRED" -gt 0 ]; then
  echo ""
  echo "ACTION REQUIRED: ré-instrumenter ces verdicts ou faire passer les DO_NOT_START qu'ils bloquent à OPEN_FOR_REVIEW."
  echo "Référence canon : ADR-081 G9 + ledger/rules/rules-governance-process.md (vault)"
  exit 1
fi

exit 0
